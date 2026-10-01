import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../projects/projects.service';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { VendorFormComponent } from './vendor-form.component';
import { VendorsService } from './vendors.service';
import {
    INVOICE_STATUS_CLASSES,
    INVOICE_STATUS_LABELS,
    PAYMENT_METHODS,
    PO_STATUS_CLASSES,
    PO_STATUS_LABELS,
    PoStatus,
    PurchaseOrder,
    REQUEST_STATUS_CLASSES,
    Vendor,
    VENDOR_TYPE_CLASSES,
    VENDOR_TYPE_LABELS,
    VendorInvoice,
} from './vendors.types';

type Tab = 'overview' | 'products' | 'orders' | 'invoices' | 'payments' | 'history' | 'reports' | 'access';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
    selector: 'vendors-detail',
    templateUrl: './vendor-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, SlideOverComponent, UserSwitchComponent, VendorFormComponent],
})
export class VendorDetailComponent {
    readonly typeLabels = VENDOR_TYPE_LABELS;
    readonly typeClasses = VENDOR_TYPE_CLASSES;
    readonly poLabels = PO_STATUS_LABELS;
    readonly poClasses = PO_STATUS_CLASSES;
    readonly invLabels = INVOICE_STATUS_LABELS;
    readonly invClasses = INVOICE_STATUS_CLASSES;
    readonly reqClasses = REQUEST_STATUS_CLASSES;
    readonly methods = PAYMENT_METHODS;

    private _id = signal('');
    tab = signal<Tab>('overview');
    message = signal<{ text: string; ok: boolean } | null>(null);
    editing = signal(false);
    confirmDelete = signal(false);
    preview = signal<VendorInvoice | null>(null);

    vendor = computed<Vendor | null>(() => this.service.vendor(this._id()));

    // Forms
    productDraft = { name: '', unit: 'pcs', price: null as number | null };
    poOpen = false;
    poLines = [this._blankLine()];
    poNote = '';
    poProjectId = '';
    invoiceOpen = false;
    invoiceDraft = this._blankInvoice();
    paymentOpen = false;
    paymentDraft = this._blankPayment();
    requestDraft = { amount: null as number | null, note: '' };
    decisionNote: Record<string, string> = {};
    linkUserId = '';
    newUser = { name: '', email: '' };

    constructor(
        public service: VendorsService,
        public access: AccessService,
        public projects: ProjectsService,
        route: ActivatedRoute,
        private _router: Router
    ) {
        route.paramMap.subscribe((p) => this._id.set(p.get('id') ?? ''));
    }

    get id(): string {
        return this._id();
    }

    get tabs(): { id: Tab; label: string }[] {
        const v = this.vendor();
        const tabs: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }];
        if (v?.type === 'product') {
            tabs.push({ id: 'products', label: `Products (${this.service.productsOf(this.id).length})` });
            tabs.push({ id: 'orders', label: `Purchase orders (${this.service.ordersOf(this.id).length})` });
        }
        tabs.push({ id: 'invoices', label: `Invoices (${this.service.invoicesOf(this.id).length})` });
        tabs.push({ id: 'payments', label: 'Payments' });
        tabs.push({ id: 'history', label: 'History' });
        if (v?.type === 'service') {
            tabs.push({ id: 'reports', label: 'Daily reports' });
        }
        if (this.access.can('vendors.assign_user')) {
            tabs.push({ id: 'access', label: `Portal access (${this.service.usersOf(this.id).length})` });
        }
        return tabs;
    }

    get isVendorSide(): boolean {
        return this.service.isVendorUser;
    }

    get orderTotal(): number {
        return this.poLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    }

    openOrder = signal<string | null>(null);

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.message.set(null);
    }

    /** The last step of an invoice's approval path. */
    isLastStep(i: VendorInvoice): boolean {
        return i.approvals.findIndex((s) => s.status === 'pending') === i.approvals.length - 1;
    }

    poOf(id: string | null): string {
        return this.service.ordersOf(this.id).find((o) => o.id === id)?.number ?? '-';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Vendor
    // -----------------------------------------------------------------------------------------------------

    saved(): void {
        this.editing.set(false);
        this._report(null, 'Vendor saved.');
    }

    deleteVendor(): void {
        const error = this.service.deleteVendor(this.id);
        this.confirmDelete.set(false);
        error ? this._report(error, null) : this._router.navigate(['/vendors']);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Products and purchase orders
    // -----------------------------------------------------------------------------------------------------

    addProduct(): void {
        const d = this.productDraft;
        const error = this.service.addProduct(this.id, d.name, d.unit, Number(d.price ?? 0));
        this._report(error, 'Product added.');
        if (!error) {
            this.productDraft = { name: '', unit: 'pcs', price: null };
        }
    }

    deleteProduct(id: string): void {
        this._report(this.service.deleteProduct(id), 'Product removed.');
    }

    /** Picking a listed product fills the unit and price of that order line. */
    pickProduct(line: { name: string; qty: number; unit: string; price: number }): void {
        const product = this.service.productsOf(this.id).find((p) => p.name === line.name);
        if (product) {
            line.unit = product.unit;
            line.price = product.price;
        }
    }

    addLine(): void {
        this.poLines = [...this.poLines, this._blankLine()];
    }

    removeLine(i: number): void {
        this.poLines = this.poLines.filter((_, x) => x !== i);
        if (this.poLines.length === 0) {
            this.poLines = [this._blankLine()];
        }
    }

    createOrder(): void {
        const lines = this.poLines.map((l) => ({ name: l.name, qty: Number(l.qty), unit: l.unit, price: Number(l.price) || 0 }));
        const error = this.service.addOrder(this.id, lines, this.poNote, this.poProjectId || null);
        this._report(error, 'Purchase order sent to the vendor.');
        if (!error) {
            this.poOpen = false;
            this.poLines = [this._blankLine()];
            this.poNote = '';
            this.poProjectId = '';
        }
    }

    setOrderStatus(o: PurchaseOrder, status: PoStatus): void {
        this._report(this.service.setOrderStatus(o.id, status), 'Order updated.');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Invoices
    // -----------------------------------------------------------------------------------------------------

    pickImage(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            this._report('Choose an image (photo or scan) of the invoice.', null);
            input.value = '';
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            this._report('The image is larger than 2 MB. Choose a smaller photo.', null);
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            this.invoiceDraft.image = reader.result as string;
            this.invoiceDraft.imageName = file.name;
        };
        reader.readAsDataURL(file);
    }

    submitInvoice(): void {
        const d = this.invoiceDraft;
        const error = this.service.submitInvoice(this.id, {
            number: d.number,
            poId: d.poId || null,
            date: DateTime.fromISO(d.date).toISO(),
            dueDate: DateTime.fromISO(d.dueDate).toISO(),
            amount: Number(d.amount) || 0,
            note: d.note,
            image: d.image,
            imageName: d.imageName,
            projectId: d.projectId || null,
        });
        this._report(error, 'Invoice submitted. It will be reviewed shortly.');
        if (!error) {
            this.invoiceOpen = false;
            this.invoiceDraft = this._blankInvoice();
        }
    }

    decideInvoice(i: VendorInvoice, approve: boolean): void {
        this._report(this.service.decideInvoice(i.id, approve, this.decisionNote[i.id] ?? ''), approve ? 'Invoice approved.' : 'Invoice rejected.');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Payments and requests
    // -----------------------------------------------------------------------------------------------------

    recordPayment(): void {
        const d = this.paymentDraft;
        const error = this.service.recordPayment(this.id, { amount: Number(d.amount) || 0, method: d.method, reference: d.reference, date: DateTime.fromISO(d.date).toISO() });
        this._report(error, 'Payment recorded.');
        if (!error) {
            this.paymentOpen = false;
            this.paymentDraft = this._blankPayment();
        }
    }

    requestDue(): void {
        const error = this.service.requestDue(this.id, Number(this.requestDraft.amount) || 0, this.requestDraft.note);
        this._report(error, 'Request sent. Accounts will respond.');
        if (!error) {
            this.requestDraft = { amount: null, note: '' };
        }
    }

    answer(id: string, accept: boolean): void {
        this._report(this.service.answerRequest(id, accept, this.decisionNote[id] ?? ''), accept ? 'Request accepted.' : 'Request declined.');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Portal access
    // -----------------------------------------------------------------------------------------------------

    get freeUsers() {
        return this.access.users().filter((u) => !u.vendorId && !u.clientId && !u.customer);
    }

    linkUser(): void {
        if (!this.linkUserId) {
            this._report('Choose a user to give access.', null);
            return;
        }
        this.access.setUserVendor(this.linkUserId, this.id);
        this.linkUserId = '';
        this._report(null, "Access given. They now see this vendor's orders, invoices and payments when they sign in.");
    }

    createUser(): void {
        const error = this.access.addVendorUser(this.newUser.name, this.newUser.email, this.id);
        this._report(error, 'Vendor login created.');
        if (!error) {
            this.newUser = { name: '', email: '' };
        }
    }

    unlinkUser(userId: string): void {
        this.access.setUserVendor(userId, null);
        this._report(null, 'Access removed.');
    }

    private _report(error: string | null, success: string | null): void {
        this.message.set(error ? { text: error, ok: false } : success ? { text: success, ok: true } : null);
    }

    private _blankLine() {
        return { name: '', qty: 1, unit: 'pcs', price: 0 };
    }

    private _blankInvoice() {
        return {
            number: '', poId: '', date: DateTime.now().toISODate(), dueDate: DateTime.now().plus({ days: 30 }).toISODate(),
            amount: null as number | null, note: '', image: null as string | null, imageName: null as string | null, projectId: '',
        };
    }

    private _blankPayment() {
        return { amount: null as number | null, method: 'Bank transfer', reference: '', date: DateTime.now().toISODate() };
    }
}
