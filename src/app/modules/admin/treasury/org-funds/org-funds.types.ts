export type FundType = 'Cash' | 'Bank' | 'Petty cash' | 'Project';
export type FundStatus = 'healthy' | 'low' | 'inactive';
export type MovementType = 'deposit' | 'disbursement' | 'transfer_in' | 'transfer_out' | 'adjustment';

export interface OrgFund {
    id: string;
    name: string;
    company: string;
    branch: string;
    department: string;
    /** Spending category. Payments on the Funds page are given from a fund in a chosen category. */
    category: string;
    type: FundType;
    currency: string;
    balance: number;
    reserved: number;
    /** Available balance below this raises a low-balance alert. */
    minBalance: number;
    active: boolean;
}

export interface FundMovement {
    id: string;
    fundId: string;
    date: string;
    type: MovementType;
    direction: 'in' | 'out';
    amount: number;
    reference: string;
    description: string;
    by: string;
}

export interface ExpectedIncoming {
    id: string;
    fundId: string;
    description: string;
    amount: number;
    expectedDate: string;
}

export interface ScheduledOutgoing {
    id: string;
    fundId: string;
    description: string;
    amount: number;
    dueDate: string;
    paid: boolean;
}

export const FUND_TYPES: FundType[] = ['Cash', 'Bank', 'Petty cash', 'Project'];

export const STATUS_LABELS: Record<FundStatus, string> = {
    healthy: 'Healthy',
    low: 'Low balance',
    inactive: 'Inactive',
};

export const STATUS_CLASSES: Record<FundStatus, string> = {
    healthy: 'bg-green-100 text-green-800',
    low: 'bg-amber-100 text-amber-800',
    inactive: 'bg-gray-200 text-gray-700',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
    deposit: 'Deposit',
    disbursement: 'Disbursement',
    transfer_in: 'Transfer in',
    transfer_out: 'Transfer out',
    adjustment: 'Adjustment',
};

export interface NewFundInput {
    name: string;
    category: string;
    company: string;
    type: FundType;
    currency: string;
    openingBalance: number;
    minBalance: number;
}

export const DEFAULT_CATEGORIES: string[] = [
    'Operations',
    'Project',
    'Procurement',
    'Payroll',
    'Travel & Transport',
    'Petty cash',
];
