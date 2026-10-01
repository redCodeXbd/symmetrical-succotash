import { computed, Injectable, signal } from '@angular/core';
import { AccessService } from 'app/core/access/access.service';
import { ApprovalStep } from 'app/core/access/access.types';
import { OrgFundsService } from '../org-funds/org-funds.service';
import { DateTime } from 'luxon';
import {
    FundRequest,
    FundRequestEvent,
    FundRequestInput,
    FundReturn,
    ReturnInput,
    FundTransaction,
    PaymentInput,
    SourceFund,
} from './funds.types';

const COMPANY = 'Encore Engineering Ltd.';
const CURRENCY = 'BDT';

/**
 * In-memory store for the Funds feature. Replace the methods with API calls
 * once the backend exists; the page only talks to this service.
 */
@Injectable({ providedIn: 'root' })
export class FundsService {
    constructor(
        private _org: OrgFundsService,
        private _access: AccessService
    ) {}

    /**
     * Company, branch, department and currency come from the signed-in user's profile,
     * never from the request form. Hard-coded here until the user profile carries them.
     */
    /** Name of the signed-in employee. */
    get currentEmployee(): string {
        return this._access.user().name;
    }

    readonly department = 'Procurement';
    readonly branch = 'Head Office';
    readonly company = COMPANY;
    readonly currency = CURRENCY;
    readonly workOrders: string[] = [
        'WO-002-26-100053',
        'WO-003-26-100052',
        'WO-004-26-100051',
    ];

    private _requests = signal<FundRequest[]>(this._seedRequests());
    private _transactions = signal<FundTransaction[]>(this._seedTransactions());
    private _returns = signal<FundReturn[]>(this._seedReturns());

    readonly requests = this._requests.asReadonly();
    readonly transactions = this._transactions.asReadonly();
    readonly returns = this._returns.asReadonly();
    /** Active BDT funds a payment can be taken from, with their available balance. */
    readonly funds = computed<SourceFund[]>(() =>
        this._org
            .funds()
            .filter((f) => f.active && f.currency === CURRENCY)
            .map((f) => ({ id: f.id, name: f.name, category: f.category, currency: f.currency, balance: this._org.available(f) }))
    );
    readonly requestById = computed(
        () => new Map(this._requests().map((r) => [r.id, r]))
    );

    /** Requests follow a category when it is renamed in Configuration. */
    renameRequestCategory(from: string, to: string): void {
        this._requests.update((list) => list.map((r) => (r.category === from ? { ...r, category: to } : r)));
    }

    /** Category of the fund a payment was taken from. */
    fundCategory(fundId: string): string {
        return this._org.funds().find((f) => f.id === fundId)?.category ?? 'Other';
    }

    remaining(request: FundRequest): number {
        if (request.status === 'closed') {
            return 0;
        }
        return Math.max((request.approvedAmount ?? 0) - request.paidAmount, 0);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Employee actions
    // -----------------------------------------------------------------------------------------------------

    submit(input: FundRequestInput): FundRequest {
        const now = DateTime.now().toISO();
        const request: FundRequest = {
            id: this._nextId('FR-', this._requests().map((r) => r.id)),
            employee: this.currentEmployee,
            company: COMPANY,
            branch: this.branch,
            department: this.department,
            currency: CURRENCY,
            ...input,
            status: 'pending',
            approvedAmount: null,
            paidAmount: 0,
            returnedAmount: 0,
            closedAmount: null,
            rejectionReason: null,
            approvals: this._pathFor(input.amount),
            submittedAt: now,
            events: [{ type: 'submitted', at: now, by: this.currentEmployee }],
        };
        this._requests.update((list) => [request, ...list]);
        return request;
    }

    update(id: string, input: FundRequestInput): void {
        this._patch(id, (r) =>
            r.status !== 'pending'
                ? r
                : {
                      ...r,
                      ...input,
                      // A different amount can belong to a different branch of the approval tree.
                      approvals: input.amount === r.amount ? r.approvals : this._pathFor(input.amount),
                      events: [...r.events, this._event('edited', r.employee)],
                  }
        );
    }

    cancel(id: string): void {
        this._patch(id, (r) =>
            r.status !== 'pending'
                ? r
                : {
                      ...r,
                      status: 'cancelled',
                      events: [...r.events, this._event('cancelled', r.employee)],
                  }
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accounts actions. Each returns an error message, or null on success.
    // -----------------------------------------------------------------------------------------------------

    /** The step a request is waiting on, or null once every step has passed. */
    currentStep(request: FundRequest): ApprovalStep | null {
        return request.status === 'pending' ? (request.approvals.find((s) => s.status === 'pending') ?? null) : null;
    }

    /** Whether the acting user may approve or reject the request at its current step. */
    canApprove(request: FundRequest): boolean {
        const step = this.currentStep(request);
        if (!step) {
            return false;
        }
        if (this._access.can('fund-requests.approve_any')) {
            return true;
        }
        return this._access.can('fund-requests.approve') && this._access.hasRole(step.roleId);
    }

    /** Passes the current step. The last step approves the request for the chosen amount. */
    approve(id: string, amount: number): string | null {
        const request = this.requestById().get(id);
        if (!request || request.status !== 'pending') {
            return 'Only pending requests can be approved.';
        }
        if (!this.canApprove(request)) {
            const step = this.currentStep(request);
            return `This request is waiting for ${step?.roleName ?? 'another approver'}.`;
        }
        if (!(amount > 0) || amount > request.amount) {
            return 'The approved amount must be above zero and not more than the requested amount.';
        }
        const by = this._access.user().name;
        const now = DateTime.now().toISO();
        this._patch(id, (r) => {
            const index = r.approvals.findIndex((s) => s.status === 'pending');
            const approvals = r.approvals.map((s, i) => {
                if (i === index) {
                    return { ...s, status: 'approved' as const, by, at: now };
                }
                return i === index + 1 ? { ...s, status: 'pending' as const } : s;
            });
            const last = index === r.approvals.length - 1;
            const money = `${CURRENCY} ${amount.toLocaleString('en-US')}`;
            if (!last) {
                const next = r.approvals[index + 1].roleName;
                return {
                    ...r,
                    approvals,
                    events: [...r.events, this._event('step_approved', by, `${r.approvals[index].roleName} approved ${money}. Next: ${next}`)],
                };
            }
            return {
                ...r,
                approvals,
                status: 'approved',
                approvedAmount: amount,
                events: [...r.events, this._event('approved', by, `Approved ${money}`)],
            };
        });
        return null;
    }

    reject(id: string, reason: string): string | null {
        const request = this.requestById().get(id);
        if (!request || request.status !== 'pending') {
            return 'Only pending requests can be rejected.';
        }
        if (!this.canApprove(request)) {
            return 'You cannot reject this request at its current step.';
        }
        if (!reason.trim()) {
            return 'A rejection reason is required.';
        }
        const by = this._access.user().name;
        const now = DateTime.now().toISO();
        this._patch(id, (r) => ({
            ...r,
            status: 'rejected',
            rejectionReason: reason.trim(),
            approvals: r.approvals.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' as const, by, at: now } : s)),
            events: [...r.events, this._event('rejected', by, reason.trim())],
        }));
        return null;
    }

    recordPayment(id: string, input: PaymentInput): string | null {
        if (!this._access.can('fund-requests.pay')) {
            return 'You do not have permission to record payments.';
        }
        const by = this._access.user().name;
        const request = this.requestById().get(id);
        const fund = this.funds().find((f) => f.id === input.fundId);
        if (!request || !['approved', 'partially_paid'].includes(request.status)) {
            return 'Payments can only be recorded against approved requests.';
        }
        if (!input.category) {
            return 'Select a fund category.';
        }
        if (!fund || fund.category !== input.category) {
            return 'Select a source fund from the chosen category.';
        }
        if (!(input.amount > 0)) {
            return 'Enter a payment amount above zero.';
        }
        if (input.amount > this.remaining(request)) {
            return 'The payment exceeds the remaining approved amount.';
        }
        if (input.amount > fund.balance) {
            return 'The source fund does not have enough available balance.';
        }

        const now = DateTime.now().toISO();
        const transaction: FundTransaction = {
            id: this._nextId('TX-', this._transactions().map((t) => t.id)),
            requestId: id,
            date: input.date,
            amount: input.amount,
            currency: CURRENCY,
            method: input.method,
            reference: input.reference.trim(),
            fundId: fund.id,
            recordedBy: by,
        };
        this._transactions.update((list) => [transaction, ...list]);
        this._org.disburse(
            fund.id,
            input.amount,
            input.date,
            transaction.id,
            `${request.id} ${request.purpose}`,
            by
        );
        this._patch(id, (r) => {
            const paidAmount = r.paidAmount + input.amount;
            const fullyPaid = paidAmount >= (r.approvedAmount ?? 0);
            return {
                ...r,
                paidAmount,
                status: fullyPaid ? 'paid' : 'partially_paid',
                events: [
                    ...r.events,
                    {
                        type: 'payment',
                        at: now,
                        by,
                        note: `${transaction.id}: ${CURRENCY} ${input.amount.toLocaleString('en-US')} from ${fund.name}`,
                    },
                ],
            };
        });
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Closing and returning. Each returns an error message, or null on success.
    // -----------------------------------------------------------------------------------------------------

    returnsFor(requestId: string): FundReturn[] {
        return this._returns().filter((r) => r.requestId === requestId);
    }

    /** Paid money the employee can still give back (not yet returned, not already awaiting confirmation). */
    returnable(request: FundRequest): number {
        const pending = this.returnsFor(request.id)
            .filter((r) => r.status === 'pending')
            .reduce((sum, r) => sum + r.amount, 0);
        return Math.max(request.paidAmount - request.returnedAmount - pending, 0);
    }

    /** The requester (with "close own") or anyone with "close any" can close a partly paid request. */
    canClose(request: FundRequest): boolean {
        return (
            request.status === 'partially_paid' &&
            ((this._access.can('fund-requests.close') && request.employee === this.currentEmployee) || this._access.can('fund-requests.close_any'))
        );
    }

    /** Closing releases the unpaid rest of a partly paid request. */
    closeRequest(id: string, note: string): string | null {
        const request = this.requestById().get(id);
        if (!request || request.status !== 'partially_paid') {
            return 'Only partly paid requests can be closed.';
        }
        if (!this.canClose(request)) {
            return 'You do not have permission to close this request.';
        }
        const unpaid = this.remaining(request);
        const by = this._access.user().name;
        const detail = `${CURRENCY} ${unpaid.toLocaleString('en-US')} left unpaid${note.trim() ? `: ${note.trim()}` : ''}`;
        this._patch(id, (r) => ({
            ...r,
            status: 'closed',
            closedAmount: unpaid,
            events: [...r.events, this._event('closed', by, detail)],
        }));
        return null;
    }

    /** An employee gives unused money back. It is only counted once Accounts or Admin confirm. */
    requestReturn(id: string, input: ReturnInput): string | null {
        const request = this.requestById().get(id);
        if (!request || !['paid', 'partially_paid', 'closed'].includes(request.status)) {
            return 'Funds can only be returned on a paid request.';
        }
        if (!this._access.can('fund-requests.return') || request.employee !== this.currentEmployee) {
            return 'Only the employee who received the funds can return them.';
        }
        if (!(input.amount > 0)) {
            return 'Enter an amount above zero.';
        }
        if (input.amount > this.returnable(request)) {
            return 'You cannot return more than you received and have not returned yet.';
        }
        const now = DateTime.now().toISO();
        const record: FundReturn = {
            id: this._nextId('RT-', this._returns().map((r) => r.id)),
            requestId: id,
            employee: request.employee,
            amount: input.amount,
            currency: CURRENCY,
            method: input.method,
            reference: input.reference.trim(),
            note: input.note.trim(),
            status: 'pending',
            createdAt: now,
            decidedAt: null,
            decidedBy: null,
            fundId: null,
            rejectionReason: null,
        };
        this._returns.update((list) => [record, ...list]);
        this._patch(id, (r) => ({
            ...r,
            events: [
                ...r.events,
                this._event('return_requested', r.employee, `${record.id}: ${CURRENCY} ${input.amount.toLocaleString('en-US')} via ${input.method}`),
            ],
        }));
        return null;
    }

    /** Accounts or Admin confirm they received the money; it goes into the chosen fund. */
    confirmReturn(returnId: string, fundId: string): string | null {
        const record = this._returns().find((r) => r.id === returnId);
        const fund = this.funds().find((f) => f.id === fundId);
        if (!this._access.can('fund-requests.confirm_return')) {
            return 'You do not have permission to confirm returns.';
        }
        if (!record || record.status !== 'pending') {
            return 'This return is no longer waiting for confirmation.';
        }
        if (!fund) {
            return 'Select the fund that received the money.';
        }
        const by = this._access.user().name;
        const now = DateTime.now().toISO();
        this._org.deposit(fund.id, record.amount, now, record.id, `${record.requestId} returned by ${record.employee}`, by);
        this._returns.update((list) =>
            list.map((r) => (r.id === returnId ? { ...r, status: 'received', decidedAt: now, decidedBy: by, fundId: fund.id } : r))
        );
        this._patch(record.requestId, (r) => ({
            ...r,
            returnedAmount: r.returnedAmount + record.amount,
            events: [
                ...r.events,
                this._event('return_received', by, `${record.id}: ${CURRENCY} ${record.amount.toLocaleString('en-US')} into ${fund.name}`),
            ],
        }));
        return null;
    }

    rejectReturn(returnId: string, reason: string): string | null {
        const record = this._returns().find((r) => r.id === returnId);
        if (!this._access.can('fund-requests.confirm_return')) {
            return 'You do not have permission to reject returns.';
        }
        if (!record || record.status !== 'pending') {
            return 'This return is no longer waiting for confirmation.';
        }
        if (!reason.trim()) {
            return 'A reason is required.';
        }
        const by = this._access.user().name;
        const now = DateTime.now().toISO();
        this._returns.update((list) =>
            list.map((r) => (r.id === returnId ? { ...r, status: 'rejected', decidedAt: now, decidedBy: by, rejectionReason: reason.trim() } : r))
        );
        this._patch(record.requestId, (r) => ({
            ...r,
            events: [...r.events, this._event('return_rejected', by, `${record.id}: ${reason.trim()}`)],
        }));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    /** A fresh approval path for a request of this amount: the first step waits for its approver. */
    private _pathFor(amount: number): ApprovalStep[] {
        return this._access.ruleFor(amount).steps.map((roleId, i) => ({
            roleId,
            roleName: this._access.roleName(roleId),
            status: i === 0 ? 'pending' : 'waiting',
            by: null,
            at: null,
        }));
    }

    private _patch(id: string, fn: (r: FundRequest) => FundRequest): void {
        this._requests.update((list) => list.map((r) => (r.id === id ? fn(r) : r)));
    }

    private _event(type: FundRequestEvent['type'], by: string, note?: string): FundRequestEvent {
        return { type, by, note, at: DateTime.now().toISO() };
    }

    private _nextId(prefix: string, ids: string[]): string {
        const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), 0);
        return `${prefix}${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    /** Seed payments stay inside the current month so the summary cards are never empty. */
    private _withinMonth(days: number): string {
        const date = DateTime.now().minus({ days });
        const start = DateTime.now().startOf('month');
        return (date < start ? start : date).toISO();
    }

    private _seedRequests(): FundRequest[] {
        const base = {
            company: COMPANY,
            branch: 'Head Office',
            department: 'Procurement',
            currency: CURRENCY,
            attachment: null,
            rejectionReason: null,
            returnedAmount: 0,
            closedAmount: null,
            approvals: [] as ApprovalStep[],
        };
        const sub = (days: number, by: string): FundRequestEvent => ({
            type: 'submitted',
            at: this._daysAgo(days),
            by,
        });
        const ev = (type: FundRequestEvent['type'], days: number, by: string, note?: string): FundRequestEvent => ({
            type,
            at: this._daysAgo(days),
            by,
            note,
        });
        const requests: FundRequest[] = [
            {
                ...base, id: 'FR-1015', employee: 'Brian Hughes', purpose: 'Site cables', category: 'Materials & supplies',
                amount: 10000, neededBy: this._daysAgo(7), workOrder: 'WO-004-26-100051',
                status: 'partially_paid', approvedAmount: 10000, paidAmount: 4000,
                submittedAt: this._daysAgo(8),
                events: [
                    sub(8, 'Brian Hughes'),
                    ev('approved', 7, 'Accounts', 'Approved BDT 10,000'),
                    ev('payment', 6, 'Accounts', 'TX-1018: BDT 4,000 from Operating Bank Fund'),
                ],
            },
            {
                ...base, id: 'FR-1024', employee: 'Brian Hughes', purpose: 'Site visit & transport', category: 'Travel & transport',
                amount: 7500, neededBy: this._daysAgo(-3), workOrder: 'WO-004-26-100051',
                status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(0), events: [sub(0, 'Brian Hughes')],
            },
            {
                ...base, id: 'FR-1023', employee: 'Brian Hughes', purpose: 'Office supplies', category: 'Office',
                amount: 5000, neededBy: this._daysAgo(-5), workOrder: null,
                status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(1), events: [sub(1, 'Brian Hughes')],
            },
            {
                ...base, id: 'FR-1022', employee: 'Brian Hughes', purpose: 'Project materials', category: 'Materials & supplies',
                amount: 8000, neededBy: this._daysAgo(-2), workOrder: 'WO-002-26-100053',
                status: 'approved', approvedAmount: 8000, paidAmount: 0,
                submittedAt: this._daysAgo(2),
                events: [sub(2, 'Brian Hughes'), ev('approved', 1, 'Accounts', 'Approved BDT 8,000')],
            },
            {
                ...base, id: 'FR-1021', employee: 'Brian Hughes', purpose: 'Client meeting expenses', category: 'Meals & entertainment',
                amount: 6000, neededBy: this._daysAgo(2), workOrder: null,
                status: 'paid', approvedAmount: 6000, paidAmount: 6000,
                submittedAt: this._daysAgo(4),
                events: [
                    sub(4, 'Brian Hughes'),
                    ev('approved', 3, 'Accounts', 'Approved BDT 6,000'),
                    ev('payment', 2, 'Accounts', 'TX-1021: BDT 6,000 from Operating Bank Fund'),
                ],
            },
            {
                ...base, id: 'FR-1020', employee: 'Brian Hughes', purpose: 'Workshop tools', category: 'Materials & supplies',
                amount: 10000, neededBy: this._daysAgo(5), workOrder: 'WO-003-26-100052',
                status: 'paid', approvedAmount: 10000, paidAmount: 10000,
                submittedAt: this._daysAgo(7),
                events: [
                    sub(7, 'Brian Hughes'),
                    ev('approved', 6, 'Accounts', 'Approved BDT 10,000'),
                    ev('payment', 5, 'Accounts', 'TX-1020: BDT 10,000 from Operating Bank Fund'),
                ],
            },
            {
                ...base, id: 'FR-1019', employee: 'Brian Hughes', purpose: 'Courier and packaging', category: 'Office',
                amount: 8000, neededBy: this._daysAgo(8), workOrder: null,
                status: 'paid', approvedAmount: 8000, paidAmount: 8000,
                submittedAt: this._daysAgo(9),
                events: [
                    sub(9, 'Brian Hughes'),
                    ev('approved', 9, 'Accounts', 'Approved BDT 8,000'),
                    ev('payment', 8, 'Accounts', 'TX-1019: BDT 8,000 from Head Office Cash Fund'),
                ],
            },
            {
                ...base, id: 'FR-1018', employee: 'Brian Hughes', purpose: 'Printer repair', category: 'Office',
                amount: 4500, neededBy: this._daysAgo(10), workOrder: null,
                status: 'rejected', approvedAmount: null, paidAmount: 0,
                rejectionReason: 'Covered by the existing maintenance contract.',
                submittedAt: this._daysAgo(12),
                events: [
                    sub(12, 'Brian Hughes'),
                    ev('rejected', 11, 'Accounts', 'Covered by the existing maintenance contract.'),
                ],
            },
            {
                ...base, id: 'FR-1017', employee: 'Mehedi Hasan', branch: 'Dhaka Site', department: 'Operations',
                purpose: 'Cable and lugs for site work', category: 'Materials & supplies', amount: 15000, neededBy: this._daysAgo(-1),
                workOrder: 'WO-004-26-100051', status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(0), events: [sub(0, 'Mehedi Hasan')],
            },
            {
                ...base, id: 'FR-1025', employee: 'Mehedi Hasan', branch: 'Dhaka Site', department: 'Operations',
                purpose: 'Generator service and fuel', category: 'Materials & supplies', amount: 45000, neededBy: this._daysAgo(-4),
                workOrder: 'WO-003-26-100052', status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(0), events: [sub(0, 'Mehedi Hasan')],
            },
            {
                ...base, id: 'FR-1016', employee: 'Rahim Ahmed', branch: 'Head Office', department: 'Sales',
                purpose: 'Client visit travel', category: 'Travel & transport', amount: 12000, neededBy: this._daysAgo(-2),
                workOrder: null, status: 'partially_paid', approvedAmount: 12000, paidAmount: 5000,
                submittedAt: this._daysAgo(3),
                events: [
                    sub(3, 'Rahim Ahmed'),
                    ev('approved', 2, 'Accounts', 'Approved BDT 12,000'),
                    ev('payment', 1, 'Accounts', 'TX-1022: BDT 5,000 from Head Office Cash Fund'),
                ],
            },
        ];
        return requests.map((r) => ({ ...r, approvals: this._seedPath(r) }));
    }

    /** Seed requests follow the current approval tree; finished ones show every step passed. */
    private _seedPath(r: FundRequest): ApprovalStep[] {
        const steps = this._pathFor(r.amount);
        if (r.status === 'pending') {
            return steps;
        }
        const when = r.events.find((e) => e.type === 'approved' || e.type === 'rejected')?.at ?? r.submittedAt;
        if (r.status === 'rejected') {
            return steps.map((s, i) => (i === 0 ? { ...s, status: 'rejected' as const, by: 'Accounts', at: when } : s));
        }
        return steps.map((s) => ({ ...s, status: 'approved' as const, by: 'Accounts', at: when }));
    }

    private _seedReturns(): FundReturn[] {
        return [
            {
                id: 'RT-1001',
                requestId: 'FR-1019',
                employee: 'Brian Hughes',
                amount: 1500,
                currency: CURRENCY,
                method: 'Cash',
                reference: '',
                note: 'Unused courier budget',
                status: 'pending',
                createdAt: this._daysAgo(1),
                decidedAt: null,
                decidedBy: null,
                fundId: null,
                rejectionReason: null,
            },
        ];
    }

    private _seedTransactions(): FundTransaction[] {
        const tx = (id: string, requestId: string, days: number, amount: number, method: string, reference: string, fundId: string): FundTransaction => ({
            id, requestId, amount, method, reference, fundId,
            date: this._withinMonth(days), currency: CURRENCY, recordedBy: 'Accounts',
        });
        return [
            tx('TX-1018', 'FR-1015', 6, 4000, 'Bank transfer', 'BNK-87990', 'F-02'),
            tx('TX-1022', 'FR-1016', 1, 5000, 'Cash', '-', 'F-01'),
            tx('TX-1021', 'FR-1021', 2, 6000, 'Bank transfer', 'BNK-88231', 'F-02'),
            tx('TX-1020', 'FR-1020', 5, 10000, 'Bank transfer', 'BNK-88102', 'F-02'),
            tx('TX-1019', 'FR-1019', 8, 8000, 'Cash', '-', 'F-01'),
        ];
    }
}
