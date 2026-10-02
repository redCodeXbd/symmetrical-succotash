import { computed, effect, Injectable, signal, untracked } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { CategoryService } from 'app/core/categories/categories.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FundsService } from '../treasury/funds/funds.service';
import { VendorsService } from '../vendors/vendors.service';
import {
    INCOMING,
    PricePoint,
    PriceStats,
    VendorQuote,
    Movement,
    MovementType,
    Product,
    ProductInput,
    ReceiptLine,
    ReceiptSource,
    Store,
    StockRow,
    StoreType,
} from './store.types';

/**
 * In-memory store for Stores (office and project), the product catalogue and stock movements. Stock is never
 * typed in: it is worked out from the movement ledger (received, issued, transferred, counted). The cost of
 * one unit is the running average of what the store paid. Each method returns an error message, or null on success.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
    private _stores = signal<Store[]>(this._seedStores());
    private _products = signal<Product[]>(this._seedProducts());
    private _movements = signal<Movement[]>(this._seedMovements());

    constructor(
        private _access: AccessService,
        private _categories: CategoryService,
        private _funds: FundsService,
        private _vendors: VendorsService,
        private _expenses: ExpensesService
    ) {
        // Goods bought through an approved purchase expense join the product list on their own.
        effect(
            () => {
                const purchases = this._expenses.approvedPurchases();
                untracked(() => this._addPurchasedProducts(purchases));
            },
            { allowSignalWrites: true }
        );
    }

    readonly stores = this._stores.asReadonly();
    readonly products = this._products.asReadonly();
    readonly movements = computed(() => [...this._movements()].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));

    /** Product categories, managed in Configuration > Categories. */
    readonly categories = computed(() => this._categories.names('store-items'));

    store(id: string): Store | null {
        return this._stores().find((s) => s.id === id) ?? null;
    }

    product(id: string): Product | null {
        return this._products().find((p) => p.id === id) ?? null;
    }

    productName(id: string): string {
        return this.product(id)?.name ?? id;
    }

    storeName(id: string | null): string {
        return this.store(id ?? '')?.name ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Stock
    // -----------------------------------------------------------------------------------------------------

    /** Stock of every product that has ever been in this store, at running average cost. */
    stock(storeId: string): StockRow[] {
        const state = this._replay(storeId);
        return this._products()
            .filter((p) => state.has(p.id) || p.active)
            .map((product) => {
                const s = state.get(product.id) ?? { qty: 0, avg: 0 };
                return { product, qty: s.qty, avgCost: s.avg, value: s.qty * s.avg, low: product.minStock > 0 && s.qty < product.minStock };
            })
            .filter((r) => r.qty > 0 || state.has(r.product.id));
    }

    qtyIn(storeId: string, productId: string): number {
        return this._replay(storeId).get(productId)?.qty ?? 0;
    }

    avgCostIn(storeId: string, productId: string): number {
        return this._replay(storeId).get(productId)?.avg ?? 0;
    }

    totalValue(storeId: string): number {
        return this.stock(storeId).reduce((s, r) => s + r.value, 0);
    }

    movementsOf(storeId: string): Movement[] {
        return this.movements().filter((m) => m.storeId === storeId);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Price history: what we paid for a product each time, from expenses, purchase orders and stock received by hand
    // -----------------------------------------------------------------------------------------------------

    /** Every price paid for the item, newest first. Receipts from an expense or an order are not counted twice. */
    priceHistoryByName(name: string): PricePoint[] {
        const key = name.trim().toLowerCase();
        if (!key) {
            return [];
        }
        const product = this._products().find((p) => p.name.trim().toLowerCase() === key);
        const points: PricePoint[] = [];
        for (const e of this._expenses.approvedPurchases()) {
            for (const i of e.items.filter((x) => x.name.trim().toLowerCase() === key && x.unitCost > 0)) {
                const supplier = e.vendorId ? (this._vendors.vendorName(e.vendorId) || e.payee) : e.payee;
                points.push({ date: e.date, price: i.unitCost, qty: i.qty, unit: i.unit, source: 'expense', ref: e.id, supplier: supplier || '-' });
            }
        }
        for (const o of this._vendors.allOrders().filter((x) => x.status !== 'cancelled')) {
            for (const l of o.lines.filter((x) => x.name.trim().toLowerCase() === key && x.price > 0)) {
                points.push({ date: o.date.slice(0, 10), price: l.price, qty: l.qty, unit: l.unit, source: 'purchase_order', ref: o.number, supplier: this._vendors.vendorName(o.vendorId) });
            }
        }
        if (product) {
            for (const m of this._movements().filter((x) => x.productId === product.id && x.type === 'receive' && x.source === 'manual' && x.unitCost > 0)) {
                points.push({ date: m.date.slice(0, 10), price: m.unitCost, qty: m.qty, unit: product.unit, source: 'hand', ref: m.id, supplier: '-' });
            }
        }
        return points.sort((a, b) => b.date.localeCompare(a.date));
    }

    priceHistory(productId: string): PricePoint[] {
        return this.priceHistoryByName(this.product(productId)?.name ?? '');
    }

    priceStatsByName(name: string): PriceStats | null {
        const points = this.priceHistoryByName(name);
        if (points.length === 0) {
            return null;
        }
        const last = points[0];
        const previous = points.find((p, i) => i > 0 && p.price !== last.price) ?? points[1] ?? null;
        const prices = points.map((p) => p.price);
        return {
            count: points.length,
            last,
            previous,
            change: previous ? ((last.price - previous.price) / previous.price) * 100 : null,
            lowest: points.reduce((m, p) => (p.price < m.price ? p : m)),
            highest: points.reduce((m, p) => (p.price > m.price ? p : m)),
            average: prices.reduce((s, n) => s + n, 0) / prices.length,
        };
    }

    priceStats(productId: string): PriceStats | null {
        return this.priceStatsByName(this.product(productId)?.name ?? '');
    }

    /** What vendors list the item at right now, cheapest first. */
    vendorQuotes(productId: string): VendorQuote[] {
        const key = (this.product(productId)?.name ?? '').trim().toLowerCase();
        return this._vendors
            .allProducts()
            .filter((p) => p.name.trim().toLowerCase() === key)
            .map((p) => ({ vendor: p.vendorName, price: p.price, unit: p.unit }))
            .sort((a, b) => a.price - b.price);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Links to other features
    // -----------------------------------------------------------------------------------------------------

    /** Expenses and purchase orders whose goods went into stock. Projects skip them: the cost arrives on issue. */
    stockedRefs(): Set<string> {
        return new Set(this._movements().filter((m) => m.type === 'receive' && m.source !== 'manual' && m.ref).map((m) => m.ref));
    }

    hasProjectActivity(projectId: string): boolean {
        return this._movements().some((m) => m.projectId === projectId) || this._stores().some((s) => s.projectId === projectId);
    }

    /** What stock issued to a project cost, one line per issue. */
    projectIssueCosts(projectId: string): { date: string; source: 'store'; ref: string; label: string; amount: number }[] {
        return this._movements()
            .filter((m) => m.type === 'issue' && m.projectId === projectId)
            .map((m) => ({
                date: m.date,
                source: 'store' as const,
                ref: m.id,
                label: `${this.productName(m.productId)} x ${m.qty} from ${this.storeName(m.storeId)}`,
                amount: m.qty * m.unitCost,
            }));
    }

    /** Expenses that can be bought into stock: paid fund requests, and approved purchases entered in Expenses. */
    expenseOptions() {
        const stocked = this.stockedRefs();
        const requests = this._funds
            .requests()
            .filter((r) => r.paidAmount > 0 && !stocked.has(r.id))
            .map((r) => ({ id: r.id, label: `${r.id} · ${r.purpose} · BDT ${r.paidAmount.toLocaleString('en-US')}`, amount: r.paidAmount, lines: [] as { name: string; qty: number; unit: string; price: number }[] }));
        const purchases = this._expenses.purchaseOptions(stocked).map((e) => ({
            id: e.id,
            label: `${e.id} · ${e.description || e.payee} · BDT ${e.amount.toLocaleString('en-US')}`,
            amount: e.amount,
            lines: e.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, price: i.unitCost })),
        }));
        return [...purchases, ...requests];
    }

    /** Purchase orders to product vendors that are not in stock yet. */
    purchaseOrderOptions() {
        const stocked = this.stockedRefs();
        return this._vendors
            .allOrders()
            .filter((o) => o.status !== 'cancelled' && !stocked.has(o.id))
            .map((o) => ({ id: o.id, label: `${o.number} · BDT ${o.total.toLocaleString('en-US')}`, lines: o.lines }));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Stores and catalogue
    // -----------------------------------------------------------------------------------------------------

    addStore(name: string, type: StoreType, projectId: string | null, location: string, branchId: string | null = null, managerId: string | null = null): string | { id: string } {
        if (!this._access.can('store.catalog') && !this._access.can('company.create')) {
            return 'You do not have permission to add stores.';
        }
        if (!name.trim()) {
            return 'Enter the store name.';
        }
        if (type === 'project' && !projectId) {
            return 'Choose the project this store belongs to.';
        }
        if (this._stores().some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
            return 'A store with this name already exists.';
        }
        const store: Store = { id: this._nextId('S-', this._stores().map((s) => s.id), 1), name: name.trim(), type, projectId: type === 'project' ? projectId : null, location: location.trim(), branchId, managerId };
        this._stores.update((list) => [...list, store]);
        return { id: store.id };
    }

    /** Place a warehouse under a branch and name its manager. */
    setStoreOrg(id: string, branchId: string | null, managerId: string | null): string | null {
        if (!this._access.can('company.edit')) {
            return 'You do not have permission to edit warehouses.';
        }
        this._stores.update((list) => list.map((s) => (s.id === id ? { ...s, branchId, managerId } : s)));
        return null;
    }

    addProduct(input: ProductInput): string | { id: string } {
        if (!this._access.can('store.catalog')) {
            return 'You do not have permission to change the catalogue.';
        }
        const error = this._validateProduct(input);
        if (error) {
            return error;
        }
        const product: Product = { ...this._cleanProduct(input), id: this._nextId('PRD-', this._products().map((p) => p.id), 1001) };
        this._products.update((list) => [...list, product]);
        return { id: product.id };
    }

    updateProduct(id: string, input: ProductInput): string | null {
        if (!this._access.can('store.catalog')) {
            return 'You do not have permission to change the catalogue.';
        }
        const error = this._validateProduct(input, id);
        if (error) {
            return error;
        }
        this._products.update((list) => list.map((p) => (p.id === id ? { ...p, ...this._cleanProduct(input) } : p)));
        return null;
    }

    /** Products follow a category when it is renamed in Configuration. */
    renameCategory(from: string, to: string): void {
        this._products.update((list) => list.map((p) => (p.category === from ? { ...p, category: to } : p)));
    }

    categoryUsage(name: string): number {
        return this._products().filter((p) => p.category === name).length;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Stock actions
    // -----------------------------------------------------------------------------------------------------

    receive(storeId: string, lines: ReceiptLine[], source: ReceiptSource, ref: string, date: string, note: string): string | null {
        if (!this._access.can('store.receive')) {
            return 'You do not have permission to receive stock.';
        }
        if (!this.store(storeId)) {
            return 'Choose a store.';
        }
        if (source !== 'manual' && !ref) {
            return source === 'expense' ? 'Choose the expense these items were bought with.' : 'Choose the purchase order.';
        }
        const clean = lines.filter((l) => l.productId && Number(l.qty) > 0);
        if (clean.length === 0) {
            return 'Add at least one item with a quantity.';
        }
        if (clean.some((l) => !(Number(l.unitCost) >= 0))) {
            return 'Costs cannot be negative.';
        }
        const when = DateTime.fromISO(date).toISO();
        clean.forEach((l) => this._push({ type: 'receive', storeId, productId: l.productId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0, source, ref, note, date: when }));
        return null;
    }

    issue(storeId: string, productId: string, qty: number, projectId: string | null, note: string): string | null {
        if (!this._access.can('store.issue')) {
            return 'You do not have permission to issue stock.';
        }
        const product = this.product(productId);
        const error = this._checkQty(storeId, productId, qty);
        if (error) {
            return error;
        }
        if (product?.kind === 'asset') {
            return 'Assets are not consumed. Move them to another store with a transfer.';
        }
        this._push({ type: 'issue', storeId, productId, qty, unitCost: this.avgCostIn(storeId, productId), projectId, note });
        return null;
    }

    transfer(fromId: string, toId: string, productId: string, qty: number, note: string): string | null {
        if (!this._access.can('store.transfer')) {
            return 'You do not have permission to transfer stock.';
        }
        if (!this.store(toId) || fromId === toId) {
            return 'Choose a different store to move the stock to.';
        }
        const error = this._checkQty(fromId, productId, qty);
        if (error) {
            return error;
        }
        const cost = this.avgCostIn(fromId, productId);
        this._push({ type: 'transfer_out', storeId: fromId, productId, qty, unitCost: cost, counterStoreId: toId, note });
        this._push({ type: 'transfer_in', storeId: toId, productId, qty, unitCost: cost, counterStoreId: fromId, note });
        return null;
    }

    /** Sets the counted quantity; the difference is recorded as an adjustment. */
    count(storeId: string, productId: string, counted: number, note: string): string | null {
        if (!this._access.can('store.adjust')) {
            return 'You do not have permission to adjust stock.';
        }
        if (!(counted >= 0)) {
            return 'The counted quantity cannot be negative.';
        }
        const current = this.qtyIn(storeId, productId);
        const diff = counted - current;
        if (diff === 0) {
            return 'The count matches the stock. Nothing to adjust.';
        }
        if (!note.trim()) {
            return 'Say why the count differs.';
        }
        this._push({ type: diff > 0 ? 'adjust_in' : 'adjust_out', storeId, productId, qty: Math.abs(diff), unitCost: this.avgCostIn(storeId, productId), note });
        return null;
    }

    /**
     * Adds a product for every purchased item the list does not have yet. Parts go in as consumables under
     * "Spare parts"; other purchases are supply items. Nothing is added twice, and existing products are untouched.
     */
    private _addPurchasedProducts(purchases: { id: string; categoryName: string; items: { name: string; unit: string }[] }[]): void {
        const known = new Set(this._products().map((p) => p.name.trim().toLowerCase()));
        const added: Product[] = [];
        let max = this._products().reduce((m, p) => Math.max(m, Number(p.id.slice(4)) || 0), 1000);
        for (const purchase of purchases) {
            const isParts = /part/i.test(purchase.categoryName);
            for (const item of purchase.items) {
                const key = item.name.trim().toLowerCase();
                if (!key || known.has(key)) {
                    continue;
                }
                known.add(key);
                const categories = this.categories();
                added.push({
                    id: `PRD-${++max}`,
                    sku: '',
                    name: item.name.trim(),
                    category: isParts ? (categories.find((c) => /spare|part/i.test(c)) ?? categories[0] ?? 'Other') : (categories[0] ?? 'Other'),
                    kind: isParts ? 'consumable' : 'supply',
                    unit: item.unit || 'pcs',
                    description: `Added automatically from ${purchase.categoryName} ${purchase.id}. Check the category and kind.`,
                    minStock: 0,
                    active: true,
                    addedFrom: purchase.id,
                });
            }
        }
        if (added.length > 0) {
            this._products.update((list) => [...list, ...added]);
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    /** Walks the ledger of one store in date order, keeping quantity and average cost per product. */
    private _replay(storeId: string): Map<string, { qty: number; avg: number }> {
        const state = new Map<string, { qty: number; avg: number }>();
        const list = this._movements()
            .filter((m) => m.storeId === storeId)
            .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
        for (const m of list) {
            const s = state.get(m.productId) ?? { qty: 0, avg: 0 };
            if (INCOMING.includes(m.type)) {
                const qty = s.qty + m.qty;
                s.avg = qty > 0 ? (s.qty * s.avg + m.qty * m.unitCost) / qty : 0;
                s.qty = qty;
            } else {
                s.qty = Math.max(s.qty - m.qty, 0);
            }
            state.set(m.productId, s);
        }
        return state;
    }

    private _checkQty(storeId: string, productId: string, qty: number): string | null {
        if (!this.store(storeId) || !this.product(productId)) {
            return 'Choose a store and a product.';
        }
        if (!(qty > 0)) {
            return 'Enter a quantity above zero.';
        }
        const have = this.qtyIn(storeId, productId);
        return qty > have ? `Only ${have} ${this.product(productId)?.unit} in stock here.` : null;
    }

    private _push(m: Partial<Movement> & Pick<Movement, 'type' | 'storeId' | 'productId' | 'qty' | 'unitCost'>): void {
        const movement: Movement = {
            id: this._nextId('MV-', this._movements().map((x) => x.id), 1),
            date: DateTime.now().toISO(),
            projectId: null,
            counterStoreId: null,
            source: null,
            ref: '',
            note: '',
            by: this._access.user().name,
            ...m,
        };
        movement.note = movement.note.trim();
        this._movements.update((list) => [...list, movement]);
    }

    private _cleanProduct(input: ProductInput): ProductInput {
        const t = (v: string) => v.trim();
        return { ...input, sku: t(input.sku), name: t(input.name), category: t(input.category), unit: t(input.unit) || 'pcs', description: t(input.description), minStock: Number(input.minStock) || 0 };
    }

    private _validateProduct(input: ProductInput, ignoreId?: string): string | null {
        if (!input.name.trim()) {
            return 'Enter the product name.';
        }
        if (!input.category.trim()) {
            return 'Choose a category.';
        }
        const sku = input.sku.trim().toLowerCase();
        if (sku && this._products().some((p) => p.id !== ignoreId && p.sku.toLowerCase() === sku)) {
            return 'This SKU is already used by another product.';
        }
        return this._products().some((p) => p.id !== ignoreId && p.name.toLowerCase() === input.name.trim().toLowerCase())
            ? 'A product with this name already exists.'
            : null;
    }

    private _nextId(prefix: string, ids: string[], start: number): string {
        const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), start - 1);
        return `${prefix}${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    private _seedStores(): Store[] {
        return [
            { id: 'S-1', name: 'Head Office Store', type: 'office', projectId: null, location: 'Head Office, Dhaka', branchId: 'U-1', managerId: null },
            { id: 'S-2', name: 'Chattogram Site Store', type: 'project', projectId: 'P-2001', location: 'BSCIC Industrial Area, Chattogram', branchId: 'U-2', managerId: null },
        ];
    }

    private _seedProducts(): Product[] {
        const p = (id: string, sku: string, name: string, category: string, kind: Product['kind'], unit: string, minStock: number, description: string): Product => ({ id, sku, name, category, kind, unit, description, minStock, active: true });
        return [
            p('PRD-1001', 'ELE-CT-300', 'GI cable tray 300 mm', 'Electrical', 'supply', 'pcs', 10, 'Hot-dip galvanised perforated tray, 2.5 m length.'),
            p('PRD-1002', 'ELE-LG-120', 'Copper lug 120 sq mm', 'Electrical', 'consumable', 'pcs', 50, 'Tinned copper crimp lug for 120 sq mm cable.'),
            p('PRD-1003', 'ELE-PE-806', 'Panel enclosure 800x600', 'Electrical', 'supply', 'pcs', 2, 'Wall-mount powder-coated enclosure with back plate.'),
            p('PRD-1004', 'SAF-HM-01', 'Safety helmet', 'Safety', 'consumable', 'pcs', 10, 'Industrial safety helmet with chin strap.'),
            p('PRD-1005', 'TLS-KT-01', 'Hand tool kit', 'Tools & equipment', 'asset', 'set', 1, 'Insulated 40-piece electrician kit.'),
            p('PRD-1006', 'TLS-MM-01', 'Digital multimeter', 'Tools & equipment', 'asset', 'pcs', 1, 'True RMS, CAT III 600 V.'),
            p('PRD-1007', 'OFF-A4-80', 'A4 paper ream', 'Office supplies', 'consumable', 'ream', 5, '80 gsm, 500 sheets.'),
            p('PRD-1008', 'ELE-TP-18', 'Insulation tape', 'Electrical', 'consumable', 'roll', 20, 'PVC electrical tape, 18 mm.'),
        ];
    }

    private _seedMovements(): Movement[] {
        const base = { date: '', projectId: null, counterStoreId: null, source: null, ref: '', note: '', by: 'Sara Khan' };
        let n = 0;
        const m = (type: MovementType, days: number, storeId: string, productId: string, qty: number, unitCost: number, extra: Partial<Movement> = {}): Movement => ({
            ...base, id: `MV-${++n}`, type, date: this._daysAgo(days), storeId, productId, qty, unitCost, ...extra,
        });
        return [
            m('receive', 30, 'S-1', 'PRD-1001', 40, 4200, { source: 'purchase', ref: 'PO-7001', note: 'Steelcraft delivery' }),
            m('receive', 30, 'S-1', 'PRD-1002', 200, 185, { source: 'purchase', ref: 'PO-7001' }),
            m('receive', 5, 'S-1', 'PRD-1005', 2, 3000, { source: 'expense', ref: 'FR-1020', by: 'Nadia Rahman' }),
            m('receive', 5, 'S-1', 'PRD-1006', 2, 2000, { source: 'expense', ref: 'FR-1020', by: 'Nadia Rahman' }),
            m('receive', 25, 'S-1', 'PRD-1007', 20, 420, { source: 'manual', note: 'Opening stock' }),
            m('receive', 25, 'S-1', 'PRD-1008', 50, 60, { source: 'manual', note: 'Opening stock' }),
            m('receive', 25, 'S-1', 'PRD-1004', 30, 450, { source: 'manual', note: 'Opening stock' }),
            m('transfer_out', 20, 'S-1', 'PRD-1001', 10, 4200, { counterStoreId: 'S-2' }),
            m('transfer_in', 20, 'S-2', 'PRD-1001', 10, 4200, { counterStoreId: 'S-1' }),
            m('transfer_out', 20, 'S-1', 'PRD-1002', 60, 185, { counterStoreId: 'S-2' }),
            m('transfer_in', 20, 'S-2', 'PRD-1002', 60, 185, { counterStoreId: 'S-1' }),
            m('transfer_out', 19, 'S-1', 'PRD-1006', 1, 2000, { counterStoreId: 'S-2' }),
            m('transfer_in', 19, 'S-2', 'PRD-1006', 1, 2000, { counterStoreId: 'S-1' }),
            m('issue', 18, 'S-1', 'PRD-1001', 15, 4200, { projectId: 'P-2001', note: 'Panel room trays' }),
            m('issue', 18, 'S-1', 'PRD-1002', 60, 185, { projectId: 'P-2001' }),
            m('issue', 10, 'S-2', 'PRD-1001', 8, 4200, { projectId: 'P-2001', note: 'Cable routing' }),
            m('issue', 10, 'S-2', 'PRD-1002', 40, 185, { projectId: 'P-2001' }),
            m('issue', 3, 'S-1', 'PRD-1007', 5, 420, { note: 'Office use' }),
        ];
    }
}
