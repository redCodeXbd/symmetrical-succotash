import { computed, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ApprovalStep } from 'app/core/access/access.types';
import {
    DueRequest,
    HistoryEvent,
    PoStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
    VendorInput,
    VendorInvoice,
    VendorPayment,
    VendorProduct,
} from './vendors.types';

const money = (n: number) => `BDT ${n.toLocaleString('en-US')}`;

/**
 * In-memory store for Vendors, their products, purchase orders, invoices, payments and due payment
 * requests. Replace the methods with API calls once there is a backend. Who may see or change what is
 * decided here from the acting user's permissions: staff with "View all" see every vendor; a vendor
 * user sees only the vendor they are linked to. Each method returns an error message, or null on success.
 */
@Injectable({ providedIn: 'root' })
export class VendorsService {
    private _vendors = signal<Vendor[]>(this._seedVendors());
    private _products = signal<VendorProduct[]>(this._seedProducts());
    private _orders = signal<PurchaseOrder[]>(this._seedOrders());
    private _invoices = signal<VendorInvoice[]>(this._seedInvoices());
    private _payments = signal<VendorPayment[]>(this._seedPayments());
    private _requests = signal<DueRequest[]>(this._seedRequests());

    constructor(private _access: AccessService) {}

    readonly vendors = computed(() => {
        const all = this._vendors();
        if (this._access.can('vendors.view_all')) {
            return all;
        }
        const own = this._access.user().vendorId;
        return all.filter((v) => v.id === own);
    });

    /** A vendor user acts for one vendor; staff act for the company. */
    get isVendorUser(): boolean {
        return !this._access.can('vendors.view_all') && !!this._access.user().vendorId;
    }

    vendor(id: string): Vendor | null {
        return this.vendors().find((v) => v.id === id) ?? null;
    }

    usersOf(vendorId: string) {
        return this._access.users().filter((u) => u.vendorId === vendorId);
    }

    productsOf(id: string): VendorProduct[] {
        return this._own(this._products(), id);
    }
    ordersOf(id: string): PurchaseOrder[] {
        return this._own(this._orders(), id);
    }
    invoicesOf(id: string): VendorInvoice[] {
        return this._own(this._invoices(), id);
    }
    paymentsOf(id: string): VendorPayment[] {
        return this._own(this._payments(), id);
    }
    requestsOf(id: string): DueRequest[] {
        return this._own(this._requests(), id);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Money
    // -----------------------------------------------------------------------------------------------------

    /** Approved invoices: what we owe in total. */
    invoiced(id: string): number {
        return this.invoicesOf(id).filter((i) => i.status === 'approved').reduce((s, i) => s + i.amount, 0);
    }

    paid(id: string): number {
        return this.paymentsOf(id).reduce((s, p) => s + p.amount, 0);
    }

    due(id: string): number {
        return Math.max(this.invoiced(id) - this.paid(id), 0);
    }

    pendingRequested(id: string): number {
        return this.requestsOf(id).filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
    }

    /** What a vendor may still ask for: the due amount not already asked for. */
    requestable(id: string): number {
        return Math.max(this.due(id) - this.pendingRequested(id), 0);
    }

    /** Everything that happened with this vendor, newest first. */
    history(id: string): HistoryEvent[] {
        const events: HistoryEvent[] = [
            ...this.ordersOf(id).map((o) => ({ at: o.date, kind: 'po' as const, title: `Purchase order ${o.number}`, detail: `${money(o.total)} sent by ${o.by}` })),
            ...this.invoicesOf(id).map((i) => ({ at: i.date, kind: 'invoice' as const, title: `Invoice ${i.number} ${i.status}`, detail: `${money(i.amount)} from ${i.by}` })),
            ...this.paymentsOf(id).map((p) => ({ at: p.date, kind: 'payment' as const, title: 'Payment made', detail: `${money(p.amount)} by ${p.method}${p.reference ? ` (${p.reference})` : ''}` })),
            ...this.requestsOf(id).map((r) => ({ at: r.createdAt, kind: 'request' as const, title: `Due payment requested (${r.status})`, detail: `${money(r.amount)} by ${r.by}${r.note ? `: ${r.note}` : ''}` })),
        ];
        return events.sort((a, b) => b.at.localeCompare(a.at));
    }

    /** Every purchase order, whoever asks. Other features (store, projects) read these; they apply their own permissions. */
    allOrders(): PurchaseOrder[] {
        return this._orders();
    }

    /**
     * Approved invoices that are a cost of the project, as cost lines. An invoice belongs to a project directly
     * or through its purchase order. Orders whose goods went into a store (`stocked`) are skipped: that cost
     * arrives when the stock is issued to the project.
     */
    projectInvoiceCosts(projectId: string, stocked: Set<string>): { date: string; source: 'purchase'; ref: string; label: string; amount: number }[] {
        return this._invoices()
            .filter((i) => {
                const po = this._orders().find((o) => o.id === i.poId);
                const forProject = i.projectId === projectId || (!i.projectId && po?.projectId === projectId);
                return i.status === 'approved' && forProject && !(po && stocked.has(po.id));
            })
            .map((i) => ({
                date: i.date,
                source: 'purchase' as const,
                ref: i.number,
                label: `${this._vendors().find((v) => v.id === i.vendorId)?.name ?? i.vendorId} invoice`,
                amount: i.amount,
            }));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Vendors
    // -----------------------------------------------------------------------------------------------------

    addVendor(input: VendorInput): string | { id: string } {
        if (!this._access.can('vendors.add')) {
            return 'You do not have permission to add vendors.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const vendor: Vendor = { ...this._clean(input), id: this._nextId('V-', this._vendors().map((v) => v.id), 1001), createdAt: DateTime.now().toISO() };
        this._vendors.update((list) => [vendor, ...list]);
        return { id: vendor.id };
    }

    updateVendor(id: string, input: VendorInput): string | null {
        if (!this._access.can('vendors.edit')) {
            return 'You do not have permission to edit vendors.';
        }
        const error = this._validate(input, id);
        if (error) {
            return error;
        }
        this._vendors.update((list) => list.map((v) => (v.id === id ? { ...v, ...this._clean(input) } : v)));
        return null;
    }

    deleteVendor(id: string): string | null {
        if (!this._access.can('vendors.delete')) {
            return 'You do not have permission to delete vendors.';
        }
        if (this._orders().some((x) => x.vendorId === id) || this._invoices().some((x) => x.vendorId === id) || this._payments().some((x) => x.vendorId === id)) {
            return 'This vendor has orders, invoices or payments, so it cannot be deleted. Mark it inactive instead.';
        }
        this.usersOf(id).forEach((u) => this._access.setUserVendor(u.id, null));
        this._vendors.update((list) => list.filter((v) => v.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Products (product vendors)
    // -----------------------------------------------------------------------------------------------------

    /** Staff with "Edit", or the vendor itself (with "Submit"), keep the product list. */
    canEditProducts(vendorId: string): boolean {
        return this._access.can('vendors.edit') || this._isOwnVendor(vendorId, 'vendors.submit');
    }

    addProduct(vendorId: string, name: string, unit: string, price: number): string | null {
        if (!this.canEditProducts(vendorId)) {
            return 'You cannot change this product list.';
        }
        if (!name.trim()) {
            return 'Enter the product name.';
        }
        if (!(price >= 0)) {
            return 'Enter a price of zero or more.';
        }
        const product: VendorProduct = { id: this._nextId('PR-', this._products().map((p) => p.id), 5001), vendorId, name: name.trim(), unit: unit.trim() || 'pcs', price };
        this._products.update((list) => [product, ...list]);
        return null;
    }

    deleteProduct(id: string): string | null {
        const product = this._products().find((p) => p.id === id);
        if (!product || !this.canEditProducts(product.vendorId)) {
            return 'You cannot change this product list.';
        }
        this._products.update((list) => list.filter((p) => p.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Purchase orders
    // -----------------------------------------------------------------------------------------------------

    addOrder(vendorId: string, lines: PurchaseOrderLine[], note: string, projectId: string | null = null): string | null {
        if (!this._access.can('vendors.create_po')) {
            return 'You do not have permission to create purchase orders.';
        }
        const vendor = this.vendor(vendorId);
        if (vendor?.type !== 'product') {
            return 'Purchase orders go to product vendors.';
        }
        const clean = lines.filter((l) => l.name.trim() && l.qty > 0).map((l) => ({ ...l, name: l.name.trim() }));
        if (clean.length === 0) {
            return 'Add at least one item with a quantity.';
        }
        const order: PurchaseOrder = {
            id: this._nextId('PO-', this._orders().map((o) => o.id), 7001),
            vendorId,
            number: '',
            date: DateTime.now().toISO(),
            lines: clean,
            total: clean.reduce((s, l) => s + l.qty * l.price, 0),
            status: 'open',
            note: note.trim(),
            by: this._access.user().name,
            projectId,
        };
        order.number = `PO-${DateTime.now().year}-${order.id.slice(3)}`;
        this._orders.update((list) => [order, ...list]);
        return null;
    }

    setOrderStatus(id: string, status: PoStatus): string | null {
        if (!this._access.can('vendors.create_po')) {
            return 'You do not have permission to change purchase orders.';
        }
        this._orders.update((list) => list.map((o) => (o.id === id ? { ...o, status } : o)));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Invoices
    // -----------------------------------------------------------------------------------------------------

    canSubmitInvoice(vendorId: string): boolean {
        return this._access.can('vendors.edit') || this._isOwnVendor(vendorId, 'vendors.submit');
    }

    submitInvoice(
        vendorId: string,
        input: { number: string; poId: string | null; date: string; dueDate: string; amount: number; note: string; image: string | null; imageName: string | null; projectId?: string | null }
    ): string | null {
        if (!this.canSubmitInvoice(vendorId)) {
            return 'You cannot submit invoices for this vendor.';
        }
        if (!input.number.trim()) {
            return 'Enter the invoice number.';
        }
        if (!(input.amount > 0)) {
            return 'Enter an invoice amount above zero.';
        }
        if (this._invoices().some((i) => i.vendorId === vendorId && i.number.toLowerCase() === input.number.trim().toLowerCase())) {
            return 'This invoice number was already submitted.';
        }
        const invoice: VendorInvoice = {
            ...input,
            number: input.number.trim(),
            note: input.note.trim(),
            id: this._nextId('INV-', this._invoices().map((i) => i.id), 9001),
            vendorId,
            status: 'submitted',
            by: this._access.user().name,
            decisionNote: '',
            projectId: this._access.can('vendors.edit') ? (input.projectId ?? null) : null,
            approvals: this._pathFor(input.amount),
        };
        this._invoices.update((list) => [invoice, ...list]);
        return null;
    }

    /** The step an invoice is waiting on, or null once it is decided. */
    currentStep(invoice: VendorInvoice): ApprovalStep | null {
        return invoice.status === 'submitted' ? (invoice.approvals.find((s) => s.status === 'pending') ?? null) : null;
    }

    /** Whether the acting user may approve or reject the invoice at its current step of the approval tree. */
    canApproveInvoice(invoice: VendorInvoice): boolean {
        const step = this.currentStep(invoice);
        if (!step) {
            return false;
        }
        if (this._access.can('vendors.approve_any')) {
            return true;
        }
        return this._access.can('vendors.approve_invoice') && this._access.hasRole(step.roleId);
    }

    /** Invoices waiting for the acting user. */
    invoicesAwaitingMe(): VendorInvoice[] {
        return this._invoices().filter((i) => this.canApproveInvoice(i));
    }

    /** Passes the current step; the last step approves the invoice. A rejection at any step ends it. */
    decideInvoice(id: string, approve: boolean, note: string): string | null {
        const invoice = this._invoices().find((i) => i.id === id);
        if (!invoice || invoice.status !== 'submitted') {
            return 'This invoice has already been decided.';
        }
        if (!this.canApproveInvoice(invoice)) {
            return `This invoice is waiting for ${this.currentStep(invoice)?.roleName ?? 'another approver'}.`;
        }
        if (!approve && !note.trim()) {
            return 'Give a reason when rejecting an invoice.';
        }
        const by = this._access.user().name;
        const at = DateTime.now().toISO();
        this._invoices.update((list) =>
            list.map((i) => {
                if (i.id !== id) {
                    return i;
                }
                const index = i.approvals.findIndex((s) => s.status === 'pending');
                if (!approve) {
                    const approvals = i.approvals.map((s, n) => (n === index ? { ...s, status: 'rejected' as const, by, at } : s));
                    return { ...i, approvals, status: 'rejected' as const, decisionNote: note.trim() };
                }
                const approvals = i.approvals.map((s, n) => (n === index ? { ...s, status: 'approved' as const, by, at } : n === index + 1 ? { ...s, status: 'pending' as const } : s));
                const last = index === i.approvals.length - 1;
                return { ...i, approvals, status: last ? ('approved' as const) : i.status, decisionNote: note.trim() || i.decisionNote };
            })
        );
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Payments and due payment requests
    // -----------------------------------------------------------------------------------------------------

    recordPayment(vendorId: string, input: { amount: number; method: string; reference: string; date: string }): string | null {
        if (!this._access.can('vendors.pay')) {
            return 'You do not have permission to record payments.';
        }
        if (!(input.amount > 0)) {
            return 'Enter an amount above zero.';
        }
        if (input.amount > this.due(vendorId)) {
            return `The amount is more than what is due (${money(this.due(vendorId))}).`;
        }
        const payment: VendorPayment = {
            ...input,
            reference: input.reference.trim(),
            id: this._nextId('VP-', this._payments().map((p) => p.id), 4001),
            vendorId,
            invoiceId: null,
            by: this._access.user().name,
        };
        this._payments.update((list) => [payment, ...list]);
        return null;
    }

    requestDue(vendorId: string, amount: number, note: string): string | null {
        if (!this._isOwnVendor(vendorId, 'vendors.submit')) {
            return 'Only the vendor can request a due payment.';
        }
        if (!(amount > 0)) {
            return 'Enter an amount above zero.';
        }
        if (amount > this.requestable(vendorId)) {
            return `You can request up to ${money(this.requestable(vendorId))} now. The rest is due or already requested.`;
        }
        const request: DueRequest = {
            id: this._nextId('RQ-', this._requests().map((r) => r.id), 6001),
            vendorId,
            amount,
            note: note.trim(),
            status: 'pending',
            createdAt: DateTime.now().toISO(),
            by: this._access.user().name,
            answerNote: '',
        };
        this._requests.update((list) => [request, ...list]);
        return null;
    }

    answerRequest(id: string, accept: boolean, note: string): string | null {
        if (!this._access.can('vendors.approve_invoice')) {
            return 'You do not have permission to answer payment requests.';
        }
        if (!accept && !note.trim()) {
            return 'Give a reason when declining.';
        }
        this._requests.update((list) =>
            list.map((r) => (r.id === id && r.status === 'pending' ? { ...r, status: accept ? 'accepted' : 'declined', answerNote: note.trim() } : r))
        );
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    /** A fresh approval path for an invoice of this amount, from the approval tree. */
    private _pathFor(amount: number): ApprovalStep[] {
        return this._access.ruleFor(amount).steps.map((roleId, i) => ({
            roleId,
            roleName: this._access.roleName(roleId),
            status: i === 0 ? 'pending' : 'waiting',
            by: null,
            at: null,
        }));
    }

    private _isOwnVendor(vendorId: string, permission: string): boolean {
        return this._access.can(permission) && this._access.user().vendorId === vendorId;
    }

    private _own<T extends { vendorId: string }>(list: T[], vendorId: string): T[] {
        const allowed = this._access.can('vendors.view_all') || this._access.user().vendorId === vendorId;
        return allowed ? list.filter((x) => x.vendorId === vendorId) : [];
    }

    private _clean(input: VendorInput): VendorInput {
        return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as unknown as VendorInput;
    }

    private _validate(input: VendorInput, ignoreId?: string): string | null {
        if (!input.name.trim()) {
            return 'Enter the vendor name.';
        }
        if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
            return 'Enter a valid email address.';
        }
        return this._vendors().some((v) => v.id !== ignoreId && v.name.toLowerCase() === input.name.trim().toLowerCase())
            ? 'A vendor with this name already exists.'
            : null;
    }

    private _nextId(prefix: string, ids: string[], start: number): string {
        const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), start - 1);
        return `${prefix}${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    private _seedVendors(): Vendor[] {
        const v = (id: string, name: string, type: Vendor['type'], contact: string, email: string, city: string, terms: string, bank: string, notes = ''): Vendor => ({
            id, name, type, contactPerson: contact, email, phone: '+880 17' + Math.floor(10000000 + Math.abs(name.length * 7919) % 89999999), address: 'Industrial Area', city, country: 'Bangladesh',
            taxId: `BIN 00${id.slice(2)}1234`, bankDetails: bank, paymentTerms: terms, status: 'active', notes, createdAt: this._daysAgo(150),
        });
        return [
            v('V-1001', 'Steelcraft Supplies Ltd.', 'product', 'Jahid Hasan', 'jahid@steelcraft.example', 'Dhaka', 'Net 30 days', 'City Bank, A/C 1234-5678'),
            v('V-1002', 'SafeGuard Security Services', 'service', 'Tania Akter', 'tania@safeguard.example', 'Dhaka', 'Monthly, by the 10th', 'BRAC Bank, A/C 8765-4321', 'Site guards and gate management.'),
            v('V-1003', 'Metro Courier', 'other', 'Rafiq Uddin', 'rafiq@metrocourier.example', 'Chattogram', 'On delivery', 'bKash merchant 01700-000000'),
        ];
    }

    private _seedProducts(): VendorProduct[] {
        const p = (id: string, name: string, unit: string, price: number): VendorProduct => ({ id, vendorId: 'V-1001', name, unit, price });
        return [
            p('PR-5001', 'MS angle bar 40x40x5 mm', 'kg', 92),
            p('PR-5002', 'GI cable tray 300 mm', 'pcs', 4200),
            p('PR-5003', 'Copper lug 120 sq mm', 'pcs', 185),
            p('PR-5004', 'Panel enclosure 800x600', 'pcs', 38500),
        ];
    }

    private _seedOrders(): PurchaseOrder[] {
        return [
            {
                id: 'PO-7001', vendorId: 'V-1001', number: 'PO-2026-7001', date: this._daysAgo(30), status: 'received', note: 'Site cables and trays', by: 'Sara Khan', projectId: 'P-2001',
                lines: [{ name: 'GI cable tray 300 mm', qty: 40, unit: 'pcs', price: 4200 }, { name: 'Copper lug 120 sq mm', qty: 200, unit: 'pcs', price: 185 }], total: 40 * 4200 + 200 * 185,
            },
            {
                id: 'PO-7002', vendorId: 'V-1001', number: 'PO-2026-7002', date: this._daysAgo(6), status: 'open', note: '', by: 'Sara Khan', projectId: 'P-2001',
                lines: [{ name: 'Panel enclosure 800x600', qty: 4, unit: 'pcs', price: 38500 }], total: 4 * 38500,
            },
        ];
    }

    private _seedInvoices(): VendorInvoice[] {
        const i = (id: string, vendorId: string, poId: string | null, number: string, days: number, amount: number, status: VendorInvoice['status'], by: string, note = ''): VendorInvoice => ({
            id, vendorId, poId, number, date: this._daysAgo(days), dueDate: this._daysAgo(days - 30), amount, status, note, image: null, imageName: null, by, decisionNote: '',
            projectId: id === 'INV-9003' ? 'P-2001' : null,
            approvals: [],
        });
        const invoices = [
            i('INV-9001', 'V-1001', 'PO-7001', 'ST-2210', 26, 205000, 'approved', 'Jahid Hasan'),
            i('INV-9002', 'V-1001', 'PO-7002', 'ST-2244', 2, 154000, 'submitted', 'Jahid Hasan', 'Advance for panel enclosures'),
            i('INV-9003', 'V-1002', null, 'SG-0526', 12, 90000, 'approved', 'Tania Akter', 'May guard service'),
        ];
        return invoices.map((inv) => ({ ...inv, approvals: this._seedPath(inv) }));
    }

    /** Seed invoices follow the current tree; finished ones show every step passed. */
    private _seedPath(inv: VendorInvoice): ApprovalStep[] {
        const steps = this._pathFor(inv.amount);
        return inv.status === 'approved' ? steps.map((s) => ({ ...s, status: 'approved' as const, by: 'Accounts', at: inv.date })) : steps;
    }

    private _seedPayments(): VendorPayment[] {
        return [
            { id: 'VP-4001', vendorId: 'V-1001', invoiceId: 'INV-9001', date: this._daysAgo(15), amount: 100000, method: 'Bank transfer', reference: 'BNK-90011', by: 'Nadia Rahman' },
            { id: 'VP-4002', vendorId: 'V-1002', invoiceId: 'INV-9003', date: this._daysAgo(5), amount: 45000, method: 'Bank transfer', reference: 'BNK-90102', by: 'Nadia Rahman' },
        ];
    }

    private _seedRequests(): DueRequest[] {
        return [
            { id: 'RQ-6001', vendorId: 'V-1001', amount: 50000, note: 'Please release part of the balance this week.', status: 'pending', createdAt: this._daysAgo(1), by: 'Jahid Hasan', answerNote: '' },
        ];
    }
}
