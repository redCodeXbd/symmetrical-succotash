import { Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import {
    DEFAULT_CATEGORIES,
    ExpectedIncoming,
    FundMovement,
    FundStatus,
    NewFundInput,
    OrgFund,
    ScheduledOutgoing,
} from './org-funds.types';

const ENCORE = 'Encore Engineering Ltd.';
const TRADING = 'Encore Trading Ltd.';

/**
 * In-memory treasury store shared by Organization Funds and Funds (disbursements).
 * Company names other than Encore Engineering Ltd. are sample data.
 */
@Injectable({ providedIn: 'root' })
export class OrgFundsService {
    private _funds = signal<OrgFund[]>([
        { id: 'F-01', name: 'Head Office Cash Fund', company: ENCORE, branch: 'Head Office', department: 'Accounts', category: 'Operations', type: 'Cash', currency: 'BDT', balance: 150000, reserved: 0, minBalance: 50000, active: true },
        { id: 'F-02', name: 'Operating Bank Fund', company: ENCORE, branch: 'Head Office', department: 'Accounts', category: 'Operations', type: 'Bank', currency: 'BDT', balance: 800000, reserved: 50000, minBalance: 200000, active: true },
        { id: 'F-03', name: 'Project Fund', company: ENCORE, branch: 'Head Office', department: 'Operations', category: 'Project', type: 'Project', currency: 'BDT', balance: 300000, reserved: 80000, minBalance: 100000, active: true },
        { id: 'F-04', name: 'Petty Cash - Dhaka Site', company: ENCORE, branch: 'Dhaka Site', department: 'Operations', category: 'Petty cash', type: 'Petty cash', currency: 'BDT', balance: 18000, reserved: 0, minBalance: 20000, active: true },
        { id: 'F-05', name: 'USD Import Account', company: ENCORE, branch: 'Head Office', department: 'Accounts', category: 'Procurement', type: 'Bank', currency: 'USD', balance: 12500, reserved: 2000, minBalance: 3000, active: true },
        { id: 'F-06', name: 'Trading Operating Fund', company: TRADING, branch: 'Head Office', department: 'Accounts', category: 'Operations', type: 'Bank', currency: 'BDT', balance: 420000, reserved: 0, minBalance: 100000, active: true },
        { id: 'F-07', name: 'Trading Cash Fund', company: TRADING, branch: 'Head Office', department: 'Sales', category: 'Petty cash', type: 'Cash', currency: 'BDT', balance: 65000, reserved: 0, minBalance: 30000, active: true },
        { id: 'F-08', name: 'Legacy Site Fund', company: ENCORE, branch: 'Dhaka Site', department: 'Operations', category: 'Project', type: 'Project', currency: 'BDT', balance: 0, reserved: 0, minBalance: 0, active: false },
    ]);
    private _categories = signal<string[]>([...DEFAULT_CATEGORIES]);
    private _movements = signal<FundMovement[]>(this._seedMovements());
    private _incoming = signal<ExpectedIncoming[]>(this._seedIncoming());
    private _outgoing = signal<ScheduledOutgoing[]>(this._seedOutgoing());

    readonly funds = this._funds.asReadonly();
    readonly categories = this._categories.asReadonly();
    readonly movements = this._movements.asReadonly();
    readonly expectedIncoming = this._incoming.asReadonly();
    readonly scheduledOutgoing = this._outgoing.asReadonly();

    available(fund: OrgFund): number {
        return fund.balance - fund.reserved;
    }

    status(fund: OrgFund): FundStatus {
        if (!fund.active) {
            return 'inactive';
        }
        return this.available(fund) < fund.minBalance ? 'low' : 'healthy';
    }

    addCategory(name: string): void {
        const clean = name.trim();
        if (clean && !this._categories().some((c) => c.toLowerCase() === clean.toLowerCase())) {
            this._categories.update((list) => [...list, clean]);
        }
    }

    /** Creates a fund. A new category name is added to the category list. */
    addFund(input: NewFundInput, by: string): OrgFund {
        this.addCategory(input.category);
        const category = this._categories().find((c) => c.toLowerCase() === input.category.trim().toLowerCase());
        const max = this._funds().reduce((m, f) => Math.max(m, Number(f.id.slice(2)) || 0), 0);
        const fund: OrgFund = {
            id: `F-${String(max + 1).padStart(2, '0')}`,
            name: input.name.trim(),
            company: input.company,
            branch: input.branch.trim(),
            department: input.department.trim(),
            category,
            type: input.type,
            currency: input.currency,
            balance: input.openingBalance,
            reserved: 0,
            minBalance: input.minBalance,
            active: true,
        };
        this._funds.update((list) => [...list, fund]);
        if (fund.balance > 0) {
            this._movements.update((list) => [
                {
                    id: `M-${String(list.length + 1).padStart(2, '0')}`,
                    fundId: fund.id,
                    date: DateTime.now().toISO(),
                    type: 'deposit',
                    direction: 'in',
                    amount: fund.balance,
                    reference: 'OPENING',
                    description: 'Opening balance',
                    by,
                },
                ...list,
            ]);
        }
        return fund;
    }

    /** Records a disbursement made from the Funds page against a source fund. */
    disburse(fundId: string, amount: number, date: string, reference: string, description: string, by: string): void {
        this._funds.update((list) =>
            list.map((f) => (f.id === fundId ? { ...f, balance: f.balance - amount } : f))
        );
        this._movements.update((list) => [
            {
                id: `M-${String(list.length + 1).padStart(2, '0')}`,
                fundId,
                date,
                type: 'disbursement',
                direction: 'out',
                amount,
                reference,
                description,
                by,
            },
            ...list,
        ]);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Seed data
    // -----------------------------------------------------------------------------------------------------

    private _ago(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    /** Payments recorded in Funds seed data stay inside the current month. */
    private _withinMonth(days: number): string {
        const date = DateTime.now().minus({ days });
        const start = DateTime.now().startOf('month');
        return (date < start ? start : date).toISO();
    }

    private _seedMovements(): FundMovement[] {
        const m = (id: string, fundId: string, date: string, type: FundMovement['type'], amount: number, reference: string, description: string, by = 'Accounts'): FundMovement => ({
            id, fundId, date, type, direction: type === 'deposit' || type === 'transfer_in' ? 'in' : 'out', amount, reference, description, by,
        });
        return [
            m('M-01', 'F-01', this._withinMonth(1), 'disbursement', 5000, 'TX-1022', 'FR-1016 Client visit travel'),
            m('M-02', 'F-02', this._withinMonth(2), 'disbursement', 6000, 'TX-1021', 'FR-1021 Client meeting expenses'),
            m('M-03', 'F-02', this._withinMonth(5), 'disbursement', 10000, 'TX-1020', 'FR-1020 Workshop tools'),
            m('M-04', 'F-01', this._withinMonth(8), 'disbursement', 8000, 'TX-1019', 'FR-1019 Courier and packaging'),
            m('M-05', 'F-02', this._ago(4), 'deposit', 250000, 'COL-0412', 'Client collection'),
            m('M-06', 'F-02', this._ago(13), 'deposit', 300000, 'COL-0397', 'Client collection'),
            m('M-07', 'F-02', this._ago(21), 'transfer_out', 60000, 'TRF-018', 'Top up Head Office Cash Fund'),
            m('M-08', 'F-01', this._ago(21), 'transfer_in', 60000, 'TRF-018', 'From Operating Bank Fund'),
            m('M-09', 'F-03', this._ago(18), 'deposit', 150000, 'PRJ-044', 'Project advance received'),
            m('M-10', 'F-03', this._ago(9), 'disbursement', 70000, 'PAY-231', 'Material purchase'),
            m('M-11', 'F-04', this._ago(15), 'transfer_in', 30000, 'TRF-021', 'Site petty cash top up'),
            m('M-12', 'F-04', this._ago(6), 'disbursement', 12000, 'PC-077', 'Site expenses'),
            m('M-13', 'F-05', this._ago(20), 'deposit', 15000, 'LC-009', 'Remittance received'),
            m('M-14', 'F-05', this._ago(10), 'disbursement', 2500, 'IMP-014', 'Import charges'),
            m('M-15', 'F-06', this._ago(24), 'deposit', 500000, 'COL-TR-021', 'Client collection'),
            m('M-16', 'F-06', this._ago(7), 'disbursement', 80000, 'PAY-TR-052', 'Supplier payment'),
            m('M-17', 'F-07', this._ago(11), 'deposit', 80000, 'CS-0140', 'Cash sales deposit'),
            m('M-18', 'F-07', this._ago(3), 'disbursement', 15000, 'PC-TR-019', 'Office expenses'),
        ];
    }

    private _seedIncoming(): ExpectedIncoming[] {
        const d = (days: number) => DateTime.now().plus({ days }).toISO();
        return [
            { id: 'EI-1', fundId: 'F-02', description: 'Client collection, AR Wet Processing Ltd.', amount: 200000, expectedDate: d(5) },
            { id: 'EI-2', fundId: 'F-03', description: 'Project milestone payment', amount: 120000, expectedDate: d(12) },
            { id: 'EI-3', fundId: 'F-06', description: 'Client collection', amount: 150000, expectedDate: d(8) },
            { id: 'EI-4', fundId: 'F-05', description: 'Remittance', amount: 5000, expectedDate: d(15) },
        ];
    }

    private _seedOutgoing(): ScheduledOutgoing[] {
        const d = (days: number) => DateTime.now().plus({ days }).toISO();
        return [
            { id: 'SO-1', fundId: 'F-02', description: 'Office rent', amount: 7000, dueDate: d(-3), paid: false },
            { id: 'SO-2', fundId: 'F-02', description: 'Supplier settlement', amount: 90000, dueDate: d(6), paid: false },
            { id: 'SO-3', fundId: 'F-03', description: 'Subcontractor payment', amount: 45000, dueDate: d(10), paid: false },
            { id: 'SO-4', fundId: 'F-06', description: 'Supplier settlement', amount: 60000, dueDate: d(4), paid: false },
            { id: 'SO-5', fundId: 'F-05', description: 'Import duty', amount: 1800, dueDate: d(9), paid: false },
        ];
    }
}
