export type FundRequestStatus =
    | 'pending'
    | 'approved'
    | 'partially_paid'
    | 'paid'
    | 'rejected'
    | 'cancelled';

export type FundRole = 'employee' | 'accounts';

export type FundEventType =
    | 'submitted'
    | 'edited'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'payment';

export interface FundRequestEvent {
    type: FundEventType;
    at: string;
    by: string;
    note?: string;
}

export interface FundRequest {
    id: string;
    employee: string;
    company: string;
    branch: string;
    department: string;
    purpose: string;
    amount: number;
    currency: string;
    neededBy: string;
    workOrder: string | null;
    attachment: string | null;
    status: FundRequestStatus;
    approvedAmount: number | null;
    paidAmount: number;
    rejectionReason: string | null;
    submittedAt: string;
    events: FundRequestEvent[];
}

export interface FundTransaction {
    id: string;
    requestId: string;
    date: string;
    amount: number;
    currency: string;
    method: string;
    reference: string;
    fundId: string;
    recordedBy: string;
}

export interface SourceFund {
    id: string;
    name: string;
    category: string;
    currency: string;
    balance: number;
}

export interface FundRequestInput {
    purpose: string;
    amount: number;
    neededBy: string;
    workOrder: string | null;
    attachment: string | null;
}

export interface PaymentInput {
    category: string;
    fundId: string;
    amount: number;
    date: string;
    method: string;
    reference: string;
}

export const STATUS_LABELS: Record<FundRequestStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    partially_paid: 'Partially paid',
    paid: 'Paid',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
};

export const PAYMENT_METHODS: string[] = [
    'Bank transfer',
    'Cash',
    'Cheque',
    'Mobile banking',
];

export const STATUS_CLASSES: Record<FundRequestStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    partially_paid: 'bg-indigo-100 text-indigo-800',
    paid: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-700',
};
