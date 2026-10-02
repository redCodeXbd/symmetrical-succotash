import { computed, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ApprovalStep } from 'app/core/access/access.types';
import { FundsService } from '../treasury/funds/funds.service';
import { OrgFundsService } from '../treasury/org-funds/org-funds.service';
import { VendorsService } from '../vendors/vendors.service';
import {
    CATEGORY_COLORS,
    Expense,
    ExpenseCategory,
    ExpenseEvent,
    ExpenseInput,
    ExpenseKind,
    PayInput,
} from './expenses.types';

const money = (n: number) => `BDT ${n.toLocaleString('en-US')}`;

/**
 * In-memory store for Expenses: every cost the company records, in categories. Replace the methods with API
 * calls once there is a backend. What a person sees, adds, approves and pays is decided here from their
 * permissions. Each method returns an error message, or null on success.
 *
 * Approval: an expense up to the "no approval needed" limit is approved when it is entered; a larger one
 * follows the approval tree for its amount. Payment is a separate step: it can take the money out of an
 * organization fund and, for a payment to a vendor, reduces what is owed to that vendor.
 */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
    private _categories = signal<ExpenseCategory[]>(this._seedCategories());
    private _expenses = signal<Expense[]>(this._seedExpenses());
    /** Expenses up to this amount need no approval. */
    readonly autoApproveLimit = signal(5000);

    constructor(
        private _access: AccessService,
        private _funds: FundsService,
        private _org: OrgFundsService,
        private _vendors: VendorsService
    ) {}

    readonly categories = this._categories.asReadonly();

    /** Expenses the acting user may see: everyone's, or only their own. */
    readonly expenses = computed(() => {
        const all = this._expenses();
        if (this._access.can('expenses.view_all')) {
            return all;
        }
        const me = this._access.user().name;
        return all.filter((e) => e.createdBy === me);
    });

    category(id: string): ExpenseCategory | null {
        return this._categories().find((c) => c.id === id) ?? null;
    }

    categoryName(id: string): string {
        return this.category(id)?.name ?? 'Uncategorised';
    }

    expense(id: string): Expense | null {
        return this.expenses().find((e) => e.id === id) ?? null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Entering and editing
    // -----------------------------------------------------------------------------------------------------

    add(input: ExpenseInput): string | { id: string } {
        if (!this._access.can('expenses.add')) {
            return 'You do not have permission to add expenses.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const by = this._access.user().name;
        const now = DateTime.now().toISO();
        const clean = this._clean(input);
        const auto = clean.amount <= this.autoApproveLimit();
        const expense: Expense = {
            ...clean,
            id: this._nextId(),
            status: auto ? 'approved' : 'pending',
            approvals: auto ? [] : this._pathFor(clean.amount),
            rejectionReason: '',
            paid: false,
            paidAt: null,
            fundId: null,
            paymentReference: '',
            createdBy: by,
            createdAt: now,
            events: [
                { at: now, by, title: 'Expense entered', note: `${this.categoryName(clean.categoryId)} · ${money(clean.amount)}` },
                ...(auto ? [{ at: now, by: 'System', title: 'Approved automatically', note: `Up to ${money(this.autoApproveLimit())} needs no approval` }] : []),
            ],
        };
        this._expenses.update((list) => [expense, ...list]);
        return { id: expense.id };
    }

    /** Only the person who entered it can change an expense that is still waiting or was rejected. */
    canEdit(e: Expense): boolean {
        return this._access.can('expenses.edit') && e.createdBy === this._access.user().name && e.status !== 'approved';
    }

    update(id: string, input: ExpenseInput): string | null {
        const current = this._expenses().find((e) => e.id === id);
        if (!current || !this.canEdit(current)) {
            return 'You cannot edit this expense.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const clean = this._clean(input);
        const auto = clean.amount <= this.autoApproveLimit();
        const now = DateTime.now().toISO();
        const by = this._access.user().name;
        this._patch(id, (e) => ({
            ...e,
            ...clean,
            // A changed amount, or a fix after a rejection, goes through approval again.
            status: auto ? 'approved' : 'pending',
            approvals: auto ? [] : e.status === 'pending' && clean.amount === e.amount ? e.approvals : this._pathFor(clean.amount),
            rejectionReason: '',
            events: [...e.events, { at: now, by, title: 'Expense edited' }],
        }));
        return null;
    }

    canDelete(e: Expense): boolean {
        if (e.paid) {
            return false;
        }
        return this._access.can('expenses.delete') || (this._access.can('expenses.edit') && e.createdBy === this._access.user().name && e.status !== 'approved');
    }

    delete(id: string): string | null {
        const current = this._expenses().find((e) => e.id === id);
        if (!current || !this.canDelete(current)) {
            return 'You cannot delete this expense. A paid expense stays on record.';
        }
        this._expenses.update((list) => list.filter((e) => e.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Approval
    // -----------------------------------------------------------------------------------------------------

    currentStep(e: Expense): ApprovalStep | null {
        return e.status === 'pending' ? (e.approvals.find((s) => s.status === 'pending') ?? null) : null;
    }

    /** Whether the acting user may approve or reject the expense at its current step. */
    canApprove(e: Expense): boolean {
        const step = this.currentStep(e);
        if (!step) {
            return false;
        }
        if (this._access.can('expenses.approve_any')) {
            return true;
        }
        return this._access.can('expenses.approve') && this._access.hasRole(step.roleId);
    }

    awaitingMe(): Expense[] {
        return this._expenses().filter((e) => this.canApprove(e));
    }

    approve(id: string): string | null {
        const e = this._expenses().find((x) => x.id === id);
        if (!e || e.status !== 'pending') {
            return 'This expense is not waiting for approval.';
        }
        if (!this.canApprove(e)) {
            return `This expense is waiting for ${this.currentStep(e)?.roleName ?? 'another approver'}.`;
        }
        const by = this._access.user().name;
        const at = DateTime.now().toISO();
        this._patch(id, (x) => {
            const index = x.approvals.findIndex((s) => s.status === 'pending');
            const approvals = x.approvals.map((s, n) => (n === index ? { ...s, status: 'approved' as const, by, at } : n === index + 1 ? { ...s, status: 'pending' as const } : s));
            const last = index === x.approvals.length - 1;
            const step = x.approvals[index].roleName;
            return {
                ...x,
                approvals,
                status: last ? 'approved' : 'pending',
                events: [...x.events, { at, by, title: last ? 'Expense approved' : 'Approval step passed', note: last ? undefined : `${step} approved. Next: ${x.approvals[index + 1].roleName}` }],
            };
        });
        return null;
    }

    reject(id: string, reason: string): string | null {
        const e = this._expenses().find((x) => x.id === id);
        if (!e || e.status !== 'pending') {
            return 'This expense is not waiting for approval.';
        }
        if (!this.canApprove(e)) {
            return 'You cannot reject this expense at its current step.';
        }
        if (!reason.trim()) {
            return 'Give a reason when rejecting.';
        }
        const by = this._access.user().name;
        const at = DateTime.now().toISO();
        this._patch(id, (x) => ({
            ...x,
            status: 'rejected',
            rejectionReason: reason.trim(),
            approvals: x.approvals.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' as const, by, at } : s)),
            events: [...x.events, { at, by, title: 'Expense rejected', note: reason.trim() }],
        }));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Payment
    // -----------------------------------------------------------------------------------------------------

    /** Funds an expense can be paid from, with what is available. */
    fundOptions() {
        return this._funds.funds();
    }

    pay(id: string, input: PayInput): string | null {
        if (!this._access.can('expenses.pay')) {
            return 'You do not have permission to record payments.';
        }
        const e = this._expenses().find((x) => x.id === id);
        if (!e || e.status !== 'approved') {
            return 'Only an approved expense can be paid.';
        }
        if (e.paid) {
            return 'This expense is already paid.';
        }
        const fund = input.fundId ? this._funds.funds().find((f) => f.id === input.fundId) : null;
        if (input.fundId && !fund) {
            return 'Choose a fund that is active.';
        }
        if (fund && e.amount > fund.balance) {
            return `${fund.name} has only ${money(fund.balance)} available.`;
        }
        const by = this._access.user().name;
        const when = DateTime.fromISO(input.date).toISO();
        // A payment to a vendor also reduces what we owe that vendor.
        if (e.vendorId && this.category(e.categoryId)?.kind === 'vendor') {
            const error = this._vendors.recordLinkedPayment(e.vendorId, { amount: e.amount, method: input.method, reference: e.id, date: when }, by);
            if (error) {
                return error;
            }
        }
        if (fund) {
            this._org.disburse(fund.id, e.amount, when, e.id, `${e.id} ${this.categoryName(e.categoryId)}: ${e.description || e.payee}`, by);
        }
        this._patch(id, (x) => ({
            ...x,
            paid: true,
            paidAt: when,
            fundId: fund?.id ?? null,
            paymentMethod: input.method,
            paymentReference: input.reference.trim(),
            events: [
                ...x.events,
                { at: DateTime.now().toISO(), by, title: 'Payment recorded', note: `${money(x.amount)} by ${input.method}${fund ? ` from ${fund.name}` : ''}${input.reference.trim() ? ` (${input.reference.trim()})` : ''}` },
            ],
        }));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Categories and settings
    // -----------------------------------------------------------------------------------------------------

    addCategory(name: string, kind: ExpenseKind): string | null {
        const error = this._categoryChecks(name);
        if (error) {
            return error;
        }
        const id = `cat-${Date.now()}`;
        const color = CATEGORY_COLORS[this._categories().length % CATEGORY_COLORS.length];
        this._categories.update((list) => [...list, { id, name: name.trim(), kind, color }]);
        return null;
    }

    updateCategory(id: string, name: string, kind: ExpenseKind): string | null {
        const error = this._categoryChecks(name, id);
        if (error) {
            return error;
        }
        const used = this._expenses().some((e) => e.categoryId === id);
        const current = this.category(id);
        if (used && current && current.kind !== kind) {
            return 'This category already has expenses, so its type cannot change.';
        }
        this._categories.update((list) => list.map((c) => (c.id === id ? { ...c, name: name.trim(), kind } : c)));
        return null;
    }

    deleteCategory(id: string): string | null {
        if (!this._access.can('expenses.manage_categories')) {
            return 'You do not have permission to change categories.';
        }
        if (this._expenses().some((e) => e.categoryId === id)) {
            return 'This category has expenses, so it cannot be deleted.';
        }
        this._categories.update((list) => list.filter((c) => c.id !== id));
        return null;
    }

    categoryUsage(id: string): number {
        return this._expenses().filter((e) => e.categoryId === id).length;
    }

    setAutoApproveLimit(amount: number): string | null {
        if (!this._access.can('expenses.manage_categories')) {
            return 'You do not have permission to change settings.';
        }
        if (!(amount >= 0)) {
            return 'Enter zero or more.';
        }
        this.autoApproveLimit.set(Math.round(amount));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Links to other features
    // -----------------------------------------------------------------------------------------------------

    /** Purchases of goods that can still be received into a store. */
    purchaseOptions(stocked: Set<string>): Expense[] {
        return this._expenses().filter((e) => this.category(e.categoryId)?.kind === 'purchase' && e.status === 'approved' && !stocked.has(e.id));
    }

    /**
     * Approved expenses that are a cost of the project. Payments to vendors are left out because the cost already
     * arrives through the vendor's invoices, and goods that went into a store count when issued to the project.
     */
    projectCosts(projectId: string, stocked: Set<string>): { date: string; source: 'expense'; ref: string; label: string; amount: number }[] {
        return this._expenses()
            .filter((e) => e.projectId === projectId && e.status === 'approved' && !stocked.has(e.id) && !(this.category(e.categoryId)?.kind === 'vendor' && e.vendorId))
            .map((e) => ({
                date: e.date,
                source: 'expense' as const,
                ref: e.id,
                label: `${this.categoryName(e.categoryId)}: ${e.description || e.payee}`,
                amount: e.amount,
            }));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _patch(id: string, fn: (e: Expense) => Expense): void {
        this._expenses.update((list) => list.map((e) => (e.id === id ? fn(e) : e)));
    }

    private _pathFor(amount: number): ApprovalStep[] {
        return this._access.ruleFor(amount).steps.map((roleId, i) => ({
            roleId,
            roleName: this._access.roleName(roleId),
            status: i === 0 ? 'pending' : 'waiting',
            by: null,
            at: null,
        }));
    }

    private _categoryChecks(name: string, ignoreId?: string): string | null {
        if (!this._access.can('expenses.manage_categories')) {
            return 'You do not have permission to change categories.';
        }
        if (!name.trim()) {
            return 'Enter a category name.';
        }
        return this._categories().some((c) => c.id !== ignoreId && c.name.toLowerCase() === name.trim().toLowerCase()) ? 'A category with this name already exists.' : null;
    }

    private _clean(input: ExpenseInput): ExpenseInput {
        const kind = this.category(input.categoryId)?.kind ?? 'general';
        const items = kind === 'purchase' ? input.items.filter((i) => i.name.trim() && Number(i.qty) > 0).map((i) => ({ ...i, name: i.name.trim(), qty: Number(i.qty), unitCost: Number(i.unitCost) || 0 })) : [];
        const meta = Object.fromEntries(Object.entries(input.meta).filter(([, v]) => `${v}`.trim() !== '').map(([k, v]) => [k, `${v}`.trim()]));
        return {
            ...input,
            amount: kind === 'purchase' && items.length > 0 ? items.reduce((s, i) => s + i.qty * i.unitCost, 0) : Number(input.amount),
            description: input.description.trim(),
            payee: input.payee.trim(),
            vendorId: input.vendorId || null,
            projectId: input.projectId || null,
            items,
            meta,
        };
    }

    private _validate(input: ExpenseInput): string | null {
        const category = this.category(input.categoryId);
        if (!category) {
            return 'Choose a category.';
        }
        const clean = this._clean(input);
        if (!(clean.amount > 0)) {
            return 'Enter an amount above zero.';
        }
        if (!input.date) {
            return 'Choose the date.';
        }
        if (DateTime.fromISO(input.date) > DateTime.now().endOf('day')) {
            return 'The date cannot be in the future.';
        }
        if (category.kind === 'vendor' && !input.vendorId && !input.payee.trim()) {
            return 'Choose the vendor, or write who was paid.';
        }
        if (category.kind !== 'vendor' && !input.description.trim() && !input.payee.trim() && clean.items.length === 0) {
            return 'Write what the money was spent on.';
        }
        if (category.kind === 'conveyance' && !(input.meta['from'] ?? '').trim() && !input.description.trim()) {
            return 'Write where the journey was from and to, or describe it.';
        }
        return null;
    }

    private _nextId(): string {
        const max = this._expenses().reduce((m, e) => Math.max(m, Number(e.id.slice(3)) || 0), 4000);
        return `EX-${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISODate();
    }

    private _seedCategories(): ExpenseCategory[] {
        const c = (i: number, name: string, kind: ExpenseKind): ExpenseCategory => ({ id: `cat-${i}`, name, kind, color: CATEGORY_COLORS[(i - 1) % CATEGORY_COLORS.length] });
        return [
            c(1, 'Office cost', 'general'),
            c(2, 'Product purchase', 'purchase'),
            c(3, 'Vendor payment', 'vendor'),
            c(4, 'Service payment', 'vendor'),
            c(5, 'Parts purchase', 'purchase'),
            c(6, 'Conveyance & transport', 'conveyance'),
            c(7, 'Business promotion', 'promotion'),
            c(8, 'Food cost', 'food'),
            c(9, 'Office rent', 'rent'),
            c(10, 'Utilities', 'general'),
            c(11, 'Repair & maintenance', 'general'),
            c(12, 'Stationery & printing', 'general'),
            c(13, 'Communication', 'general'),
            c(14, 'Staff welfare', 'general'),
            c(15, 'Legal & professional fees', 'general'),
            c(16, 'Bank charges & fees', 'general'),
            c(17, 'Tax & government fees', 'general'),
            c(18, 'Other cost', 'general'),
        ];
    }

    private _seedExpenses(): Expense[] {
        let n = 4000;
        const ev = (days: number, by: string, title: string): ExpenseEvent => ({ at: DateTime.now().minus({ days }).toISO(), by, title });
        const e = (
            days: number, categoryId: string, amount: number, description: string, extra: Partial<Expense> = {}
        ): Expense => {
            const by = extra.createdBy ?? 'Imran Hossain';
            return {
                id: `EX-${++n}`, date: this._daysAgo(days), categoryId, amount, description, payee: '', vendorId: null, projectId: null,
                branch: 'Head Office', paymentMethod: 'Cash', meta: {}, items: [], receipts: [], status: 'approved', approvals: [],
                rejectionReason: '', paid: true, paidAt: this._daysAgo(days), fundId: 'F-01', paymentReference: '', createdBy: by,
                createdAt: DateTime.now().minus({ days }).toISO(), events: [ev(days, by, 'Expense entered'), ev(days, 'System', 'Approved automatically')],
                ...extra,
            };
        };
        return [
            e(0, 'cat-8', 1800, 'Lunch with client visitors', { meta: { persons: '6', occasion: 'Client lunch' }, createdBy: 'Mehedi Hasan', paid: false, fundId: null }),
            e(0, 'cat-6', 450, 'Site visit transport', { meta: { from: 'Dhaka', to: 'Savar', mode: 'CNG', person: 'Mehedi Hasan', distance: '32' }, projectId: 'P-2003', createdBy: 'Mehedi Hasan', paid: false, fundId: null }),
            e(1, 'cat-1', 2400, 'Printer toner and paper', { payee: 'Star Stationery' }),
            e(1, 'cat-10', 18500, 'Electricity bill, head office', { payee: 'DESCO', status: 'pending', paid: false, fundId: null, approvals: [{ roleId: 'accountant', roleName: 'Accountant', status: 'pending', by: null, at: null }] }),
            e(2, 'cat-5', 56000, 'Contactor and relay set for site panels', { payee: 'Electro Parts', projectId: 'P-2001', status: 'pending', paid: false, fundId: null, items: [{ name: 'Contactor 63A', qty: 8, unit: 'pcs', unitCost: 4500 }, { name: 'Relay 24V', qty: 20, unit: 'pcs', unitCost: 1000 }], approvals: [{ roleId: 'manager', roleName: 'Manager', status: 'pending', by: null, at: null }, { roleId: 'accountant', roleName: 'Accountant', status: 'waiting', by: null, at: null }] }),
            e(3, 'cat-7', 12000, 'Facebook ads: panel services', { meta: { campaign: 'Panel services Q4', channel: 'Facebook / social' }, status: 'pending', paid: false, fundId: null, approvals: [{ roleId: 'accountant', roleName: 'Accountant', status: 'pending', by: null, at: null }] }),
            e(4, 'cat-3', 50000, 'Part payment to Steelcraft', { vendorId: 'V-1001', paymentMethod: 'Bank transfer', paid: false, fundId: null, meta: { invoiceNo: 'ST-2210' }, status: 'approved', approvals: [] }),
            e(5, 'cat-9', 45000, 'Head office rent', { payee: 'Mr. Alam', meta: { property: 'Head office, Dhaka', period: DateTime.now().toFormat('yyyy-MM'), landlord: 'Mr. Alam' }, paymentMethod: 'Bank transfer', fundId: 'F-02', createdBy: 'Nadia Rahman' }),
            e(6, 'cat-4', 30000, 'Guard service, monthly', { vendorId: 'V-1002', paid: false, fundId: null }),
            e(7, 'cat-12', 3200, 'Visiting cards', { payee: 'Quick Print' }),
            e(8, 'cat-2', 24000, 'Cable lugs and tape for stock', { payee: 'Metro Electrics', items: [{ name: 'Copper lug 120 sq mm', qty: 100, unit: 'pcs', unitCost: 190 }, { name: 'Insulation tape', qty: 80, unit: 'roll', unitCost: 62 }], status: 'approved', paid: true, approvals: [{ roleId: 'accountant', roleName: 'Accountant', status: 'approved', by: 'Nadia Rahman', at: DateTime.now().minus({ days: 8 }).toISO() }], fundId: 'F-02', paymentMethod: 'Bank transfer' }),
            e(9, 'cat-13', 1500, 'Office internet', { payee: 'Link3' }),
            e(10, 'cat-6', 900, 'Client meeting travel', { meta: { from: 'Office', to: 'Gulshan', mode: 'Car / taxi', person: 'Brian Hughes' }, createdBy: 'Brian Hughes' }),
            e(11, 'cat-11', 8200, 'AC servicing', { payee: 'CoolFix', rejectionReason: 'Covered by the maintenance contract.', status: 'rejected', paid: false, fundId: null, approvals: [{ roleId: 'accountant', roleName: 'Accountant', status: 'rejected', by: 'Nadia Rahman', at: DateTime.now().minus({ days: 10 }).toISO() }] }),
            e(12, 'cat-8', 2600, 'Site team tea and snacks', { meta: { persons: '12', occasion: 'Site team' }, projectId: 'P-2001', createdBy: 'Mehedi Hasan' }),
            e(14, 'cat-14', 4800, 'Staff eid gifts', { payee: 'Admin' }),
            e(16, 'cat-16', 650, 'Bank charges', { payee: 'City Bank', fundId: 'F-02' }),
            e(18, 'cat-17', 7500, 'Trade licence renewal', { payee: 'City Corporation', fundId: 'F-02' }),
            e(20, 'cat-18', 1200, 'Courier charges', { payee: 'Sundarban Courier' }),
            e(22, 'cat-15', 15000, 'Audit fee, advance', { payee: 'Rahman & Co.', fundId: 'F-02', paymentMethod: 'Cheque', createdBy: 'Nadia Rahman' }),
            e(27, 'cat-10', 16800, 'Electricity bill, head office', { payee: 'DESCO', fundId: 'F-02' }),
            e(33, 'cat-9', 45000, 'Head office rent', { payee: 'Mr. Alam', meta: { property: 'Head office, Dhaka', period: DateTime.now().minus({ months: 1 }).toFormat('yyyy-MM'), landlord: 'Mr. Alam' }, fundId: 'F-02', createdBy: 'Nadia Rahman' }),
        ];
    }
}
