import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../projects/projects.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { StoreService } from './store.service';
import { KIND_CLASSES, KIND_HELP, KIND_LABELS, MOVEMENT_LABELS, INCOMING, Product, ProductInput, ProductKind, ReceiptSource } from './store.types';

type Tab = 'stock' | 'catalogue' | 'movements' | 'purchases';
type Action = 'receive' | 'issue' | 'transfer' | 'count' | 'product' | 'store';

@Component({
    selector: 'store-page',
    templateUrl: './store.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, AddButtonComponent, SlideOverComponent, UserSwitchComponent],
})
export class StoreComponent {
    readonly kinds = Object.keys(KIND_LABELS) as ProductKind[];
    readonly kindLabels = KIND_LABELS;
    readonly kindClasses = KIND_CLASSES;
    readonly kindHelp = KIND_HELP;
    readonly moveLabels = MOVEMENT_LABELS;
    readonly incoming = INCOMING;

    tab = signal<Tab>('stock');
    storeId = signal('S-1');
    action = signal<Action | null>(null);
    message = signal<{ text: string; ok: boolean } | null>(null);
    error: string | null = null;

    // Filters
    search = signal('');
    kindFilter = signal<'all' | ProductKind>('all');
    categoryFilter = signal('all');

    // Forms
    receiveSource: ReceiptSource = 'manual';
    receiveRef = '';
    receiveDate = DateTime.now().toISODate();
    receiveNote = '';
    receiveLines = [{ productId: '', qty: 1, unitCost: 0 }];
    moveProductId = '';
    moveQty: number | null = null;
    moveProjectId = '';
    moveToStore = '';
    moveNote = '';
    countQty: number | null = null;
    editingProduct: Product | null = null;
    productForm: ProductInput = this._blankProduct();
    storeForm = { name: '', type: 'project' as 'office' | 'project', projectId: '', location: '' };

    selected = computed(() => this.service.store(this.storeId()));
    stock = computed(() => this.service.stock(this.storeId()));
    shownStock = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.stock().filter(
            (r) =>
                (this.kindFilter() === 'all' || r.product.kind === this.kindFilter()) &&
                (this.categoryFilter() === 'all' || r.product.category === this.categoryFilter()) &&
                (!q || [r.product.name, r.product.sku].some((v) => v.toLowerCase().includes(q)))
        );
    });
    shownProducts = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.service
            .products()
            .filter(
                (p) =>
                    (this.kindFilter() === 'all' || p.kind === this.kindFilter()) &&
                    (this.categoryFilter() === 'all' || p.category === this.categoryFilter()) &&
                    (!q || [p.name, p.sku, p.description].some((v) => v.toLowerCase().includes(q)))
            );
    });
    lowCount = computed(() => this.stock().filter((r) => r.low).length);
    itemCount = computed(() => this.stock().filter((r) => r.qty > 0).length);
    movements = computed(() => this.service.movementsOf(this.storeId()).slice(0, 200));
    /** Receipts that came from an expense or a vendor order, newest first. */
    purchases = computed(() => this.service.movements().filter((m) => m.type === 'receive' && m.source !== 'manual'));

    constructor(
        public service: StoreService,
        public access: AccessService,
        public projects: ProjectsService
    ) {}

    get otherStores() {
        return this.service.stores().filter((s) => s.id !== this.storeId());
    }

    get receiveOptions() {
        return this.receiveSource === 'expense' ? this.service.expenseOptions() : this.service.purchaseOrderOptions();
    }

    get issuableProducts() {
        return this.stock().filter((r) => r.qty > 0 && r.product.kind !== 'asset').map((r) => r.product);
    }

    get movableProducts() {
        return this.stock().filter((r) => r.qty > 0).map((r) => r.product);
    }

    get moveStock(): number {
        return this.service.qtyIn(this.storeId(), this.moveProductId);
    }

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.message.set(null);
    }

    chooseStore(id: string): void {
        this.storeId.set(id);
        this.message.set(null);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Actions
    // -----------------------------------------------------------------------------------------------------

    open(action: Action, product?: Product): void {
        this.error = null;
        this.message.set(null);
        this.action.set(action);
        this.moveProductId = product?.id ?? '';
        this.moveQty = null;
        this.moveNote = '';
        this.moveProjectId = '';
        this.moveToStore = '';
        this.countQty = null;
        if (action === 'receive') {
            this.receiveSource = 'manual';
            this.receiveRef = '';
            this.receiveNote = '';
            this.receiveDate = DateTime.now().toISODate();
            this.receiveLines = [{ productId: '', qty: 1, unitCost: 0 }];
        } else if (action === 'product') {
            this.editingProduct = product ?? null;
            this.productForm = product ? { ...product } : this._blankProduct();
        } else if (action === 'store') {
            this.storeForm = { name: '', type: 'project', projectId: '', location: '' };
        }
    }

    close(): void {
        this.action.set(null);
    }

    /** Choosing a purchase order fills the lines from it; an expense only sets the reference. */
    onSourceChange(): void {
        this.receiveRef = '';
        this.receiveLines = [{ productId: '', qty: 1, unitCost: 0 }];
    }

    onRefChange(): void {
        if (this.receiveSource !== 'purchase') {
            return;
        }
        const po = this.service.purchaseOrderOptions().find((o) => o.id === this.receiveRef);
        if (po) {
            this.receiveLines = po.lines.map((l) => ({
                productId: this.service.products().find((p) => p.name.toLowerCase() === l.name.toLowerCase())?.id ?? '',
                qty: l.qty,
                unitCost: l.price,
            }));
        }
    }

    addLine(): void {
        this.receiveLines = [...this.receiveLines, { productId: '', qty: 1, unitCost: 0 }];
    }

    removeLine(i: number): void {
        this.receiveLines = this.receiveLines.filter((_, x) => x !== i);
        if (this.receiveLines.length === 0) {
            this.addLine();
        }
    }

    get receiveTotal(): number {
        return this.receiveLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
    }

    submit(): void {
        let error: string | null = null;
        let done = '';
        const store = this.storeId();
        switch (this.action()) {
            case 'receive':
                error = this.service.receive(
                    store,
                    this.receiveLines.map((l) => ({ productId: l.productId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0 })),
                    this.receiveSource,
                    this.receiveRef,
                    this.receiveDate,
                    this.receiveNote
                );
                done = 'Stock received.';
                break;
            case 'issue':
                error = this.service.issue(store, this.moveProductId, Number(this.moveQty), this.moveProjectId || null, this.moveNote);
                done = this.moveProjectId ? 'Issued to the project. Its cost now counts in the project costing.' : 'Issued for office use.';
                break;
            case 'transfer':
                error = this.service.transfer(store, this.moveToStore, this.moveProductId, Number(this.moveQty), this.moveNote);
                done = 'Stock transferred.';
                break;
            case 'count':
                error = this.service.count(store, this.moveProductId, Number(this.countQty), this.moveNote);
                done = 'Stock count saved.';
                break;
            case 'product': {
                const result = this.editingProduct ? this.service.updateProduct(this.editingProduct.id, this.productForm) : this.service.addProduct(this.productForm);
                error = typeof result === 'string' ? result : null;
                done = this.editingProduct ? 'Product saved.' : 'Product added to the catalogue.';
                break;
            }
            case 'store': {
                const f = this.storeForm;
                const result = this.service.addStore(f.name, f.type, f.projectId || null, f.location);
                error = typeof result === 'string' ? result : null;
                if (typeof result !== 'string') {
                    this.storeId.set(result.id);
                }
                done = 'Store added.';
                break;
            }
        }
        this.error = error;
        if (!error) {
            this.action.set(null);
            this.message.set({ text: done, ok: true });
        }
    }

    get heading(): string {
        const names: Record<Action, string> = {
            receive: 'Receive stock',
            issue: 'Issue stock',
            transfer: 'Transfer stock',
            count: 'Stock count',
            product: this.editingProduct ? 'Edit product' : 'New product',
            store: 'New store',
        };
        return names[this.action() ?? 'receive'];
    }

    private _blankProduct(): ProductInput {
        return { sku: '', name: '', category: '', kind: 'consumable', unit: 'pcs', description: '', minStock: 0, active: true };
    }
}
