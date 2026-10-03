export type EmploymentType = 'Permanent' | 'Probation' | 'Contract' | 'Intern';

export const EMPLOYMENT_TYPES: EmploymentType[] = ['Permanent', 'Probation', 'Contract', 'Intern'];
export const DEPARTMENTS = ['Service Team', 'Encore Admin', 'Procurement', 'Sales', 'Operations', 'Accounts'];
export const SHIFTS = ['Head Office Shift', 'Dhamrai Office Shift', 'Site Shift'];

export interface SalaryStructure {
    gross: number;
    basic: number;
    houseRent: number;
    conveyance: number;
    medical: number;
    tada: number;
    mobile: number;
    providentFund: number;
    securityFund: number;
    taxApplicable: boolean;
    overtimeCountable: boolean;
}

export const SALARY_FIELDS: { key: keyof Omit<SalaryStructure, 'taxApplicable' | 'overtimeCountable'>; label: string }[] = [
    { key: 'gross', label: 'Gross salary' },
    { key: 'basic', label: 'Basic salary' },
    { key: 'houseRent', label: 'House rent' },
    { key: 'conveyance', label: 'Conveyance' },
    { key: 'medical', label: 'Medical' },
    { key: 'tada', label: 'TA/DA' },
    { key: 'mobile', label: 'Mobile allowance' },
    { key: 'providentFund', label: 'Provident fund' },
    { key: 'securityFund', label: 'Security fund' },
];

export interface Promotion {
    id: string;
    date: string;
    by: string;
    from: { designation: string; employmentType: EmploymentType; department: string; gross: number };
    to: { designation: string; employmentType: EmploymentType; department: string; gross: number };
}

export interface EmployeeFunds {
    totalSalary: number;
    totalBonus: number;
    securityBalance: number;
    securityWithdrawn: number;
    providentBalance: number;
    providentWithdrawn: number;
}

/** HR details of a staff user. The sign-in side (name, email, roles) lives in the user record. */
export interface EmployeeProfile {
    userId: string;
    firstName: string;
    lastName: string;
    designation: string;
    joiningDate: string;
    employmentType: EmploymentType;
    department: string;
    workstation: string;
    /** Where the person sits in Configuration > Company. Empty when not placed yet. */
    orgCompanyId: string;
    orgBranchId: string;
    orgDeptId: string;
    orgTeamId: string;
    employeeId: string;
    shift: string;
    salary: SalaryStructure;
    canGenerateIdCard: boolean;
    /** Whether the person's app login is switched on. */
    syncAppUser: boolean;
    funds: EmployeeFunds;
    /** Money that moved between the company and the person: pay, bonuses, fund deposits and refunds. */
    ledger: LedgerEntry[];
    promotions: Promotion[];
}

export const BLANK_SALARY: SalaryStructure = {
    gross: 0, basic: 0, houseRent: 0, conveyance: 0, medical: 0, tada: 0, mobile: 0, providentFund: 0, securityFund: 0,
    taxApplicable: false, overtimeCountable: false,
};

export type LedgerKind = 'salary' | 'bonus' | 'security_in' | 'provident_in' | 'security_out' | 'provident_out' | 'advance' | 'advance_return' | 'promotion';

/** A pay or fund movement recorded on the employee. */
export interface LedgerEntry {
    id: string;
    date: string;
    kind: LedgerKind;
    amount: number;
    note: string;
    by: string;
}

/**
 * in: money the person received. out: money the person gave back.
 * held: money kept from pay in a fund. info: a change with no money, such as a promotion.
 */
export type LedgerFlow = 'in' | 'out' | 'held' | 'info';

export interface LedgerRow {
    id: string;
    date: string;
    kind: LedgerKind;
    flow: LedgerFlow;
    title: string;
    note: string;
    ref: string;
    amount: number;
    by: string;
}

export const LEDGER_KINDS: Record<LedgerKind, { label: string; flow: LedgerFlow; chip: string }> = {
    salary: { label: 'Salary', flow: 'in', chip: 'bg-green-100 text-green-800' },
    bonus: { label: 'Bonus', flow: 'in', chip: 'bg-emerald-100 text-emerald-800' },
    security_in: { label: 'Security fund', flow: 'held', chip: 'bg-blue-100 text-blue-800' },
    provident_in: { label: 'Provident fund', flow: 'held', chip: 'bg-indigo-100 text-indigo-800' },
    security_out: { label: 'Security refund', flow: 'in', chip: 'bg-amber-100 text-amber-800' },
    provident_out: { label: 'Provident refund', flow: 'in', chip: 'bg-amber-100 text-amber-800' },
    advance: { label: 'Fund request', flow: 'in', chip: 'bg-violet-100 text-violet-800' },
    advance_return: { label: 'Money returned', flow: 'out', chip: 'bg-rose-100 text-rose-800' },
    promotion: { label: 'Promotion', flow: 'info', chip: 'bg-slate-200 text-slate-700' },
};

/** Groups of kinds the transactions list can be narrowed to. */
export const LEDGER_FILTERS: { id: string; label: string; kinds: LedgerKind[] }[] = [
    { id: 'all', label: 'All', kinds: [] },
    { id: 'pay', label: 'Salary and bonus', kinds: ['salary', 'bonus'] },
    { id: 'funds', label: 'Funds', kinds: ['security_in', 'provident_in', 'security_out', 'provident_out'] },
    { id: 'requests', label: 'Fund requests', kinds: ['advance', 'advance_return'] },
    { id: 'changes', label: 'Promotions', kinds: ['promotion'] },
];
