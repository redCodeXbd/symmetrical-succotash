import { computed, Injectable, signal } from '@angular/core';
import { OrgFundsService } from '../org-funds/org-funds.service';
import { DateTime } from 'luxon';
import {
    FundRequest,
    FundRequestEvent,
    FundRequestInput,
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
    constructor(private _org: OrgFundsService) {}

    /**
     * Company, branch, department and currency come from the signed-in user's profile,
     * never from the request form. Hard-coded here until the user profile carries them.
     */
    /** Name of the signed-in employee (matches the mock auth user). */
    readonly currentEmployee = 'Brian Hughes';
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

    readonly requests = this._requests.asReadonly();
    readonly transactions = this._transactions.asReadonly();
    /** Active BDT funds a payment can be taken from, with their available balance. */
    readonly funds = computed<SourceFund[]>(() =>
        this._org
            .funds()
            .filter((f) => f.active && f.currency === CURRENCY)
            .map((f) => ({ id: f.id, name: f.name, currency: f.currency, balance: this._org.available(f) }))
    );
    readonly requestById = computed(
        () => new Map(this._requests().map((r) => [r.id, r]))
    );

    remaining(request: FundRequest): number {
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
            rejectionReason: null,
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
                : { ...r, ...input, events: [...r.events, this._event('edited', r.employee)] }
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

    approve(id: string, amount: number, by: string): string | null {
        const request = this.requestById().get(id);
        if (!request || request.status !== 'pending') {
            return 'Only pending requests can be approved.';
        }
        if (!(amount > 0) || amount > request.amount) {
            return 'The approved amount must be above zero and not more than the requested amount.';
        }
        this._patch(id, (r) => ({
            ...r,
            status: 'approved',
            approvedAmount: amount,
            events: [
                ...r.events,
                this._event('approved', by, `Approved ${CURRENCY} ${amount.toLocaleString('en-US')}`),
            ],
        }));
        return null;
    }

    reject(id: string, reason: string, by: string): string | null {
        const request = this.requestById().get(id);
        if (!request || request.status !== 'pending') {
            return 'Only pending requests can be rejected.';
        }
        if (!reason.trim()) {
            return 'A rejection reason is required.';
        }
        this._patch(id, (r) => ({
            ...r,
            status: 'rejected',
            rejectionReason: reason.trim(),
            events: [...r.events, this._event('rejected', by, reason.trim())],
        }));
        return null;
    }

    recordPayment(id: string, input: PaymentInput, by: string): string | null {
        const request = this.requestById().get(id);
        const fund = this.funds().find((f) => f.id === input.fundId);
        if (!request || !['approved', 'partially_paid'].includes(request.status)) {
            return 'Payments can only be recorded against approved requests.';
        }
        if (!fund) {
            return 'Select a source fund.';
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
    // @ Private
    // -----------------------------------------------------------------------------------------------------

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
        return [
            {
                ...base, id: 'FR-1024', employee: 'Brian Hughes', purpose: 'Site visit & transport',
                amount: 7500, neededBy: this._daysAgo(-3), workOrder: 'WO-004-26-100051',
                status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(0), events: [sub(0, 'Brian Hughes')],
            },
            {
                ...base, id: 'FR-1023', employee: 'Brian Hughes', purpose: 'Office supplies',
                amount: 5000, neededBy: this._daysAgo(-5), workOrder: null,
                status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(1), events: [sub(1, 'Brian Hughes')],
            },
            {
                ...base, id: 'FR-1022', employee: 'Brian Hughes', purpose: 'Project materials',
                amount: 8000, neededBy: this._daysAgo(-2), workOrder: 'WO-002-26-100053',
                status: 'approved', approvedAmount: 8000, paidAmount: 0,
                submittedAt: this._daysAgo(2),
                events: [sub(2, 'Brian Hughes'), ev('approved', 1, 'Accounts', 'Approved BDT 8,000')],
            },
            {
                ...base, id: 'FR-1021', employee: 'Brian Hughes', purpose: 'Client meeting expenses',
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
                ...base, id: 'FR-1020', employee: 'Brian Hughes', purpose: 'Workshop tools',
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
                ...base, id: 'FR-1019', employee: 'Brian Hughes', purpose: 'Courier and packaging',
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
                ...base, id: 'FR-1018', employee: 'Brian Hughes', purpose: 'Printer repair',
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
                purpose: 'Cable and lugs for site work', amount: 15000, neededBy: this._daysAgo(-1),
                workOrder: 'WO-004-26-100051', status: 'pending', approvedAmount: null, paidAmount: 0,
                submittedAt: this._daysAgo(0), events: [sub(0, 'Mehedi Hasan')],
            },
            {
                ...base, id: 'FR-1016', employee: 'Rahim Ahmed', branch: 'Head Office', department: 'Sales',
                purpose: 'Client visit travel', amount: 12000, neededBy: this._daysAgo(-2),
                workOrder: null, status: 'partially_paid', approvedAmount: 12000, paidAmount: 5000,
                submittedAt: this._daysAgo(3),
                events: [
                    sub(3, 'Rahim Ahmed'),
                    ev('approved', 2, 'Accounts', 'Approved BDT 12,000'),
                    ev('payment', 1, 'Accounts', 'TX-1022: BDT 5,000 from Head Office Cash Fund'),
                ],
            },
        ];
    }

    private _seedTransactions(): FundTransaction[] {
        const tx = (id: string, requestId: string, days: number, amount: number, method: string, reference: string, fundId: string): FundTransaction => ({
            id, requestId, amount, method, reference, fundId,
            date: this._withinMonth(days), currency: CURRENCY, recordedBy: 'Accounts',
        });
        return [
            tx('TX-1022', 'FR-1016', 1, 5000, 'Cash', '-', 'F-01'),
            tx('TX-1021', 'FR-1021', 2, 6000, 'Bank transfer', 'BNK-88231', 'F-02'),
            tx('TX-1020', 'FR-1020', 5, 10000, 'Bank transfer', 'BNK-88102', 'F-02'),
            tx('TX-1019', 'FR-1019', 8, 8000, 'Cash', '-', 'F-01'),
        ];
    }
}
