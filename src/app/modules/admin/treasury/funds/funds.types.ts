import { ApprovalStep } from 'app/core/access/access.types';

export type FundRequestStatus =
    | 'pending'
    | 'approved'
    | 'partially_paid'
    | 'paid'
    | 'rejected'
    | 'cancelled'
    | 'closed';

export type FundRole = 'employee' | 'accounts';

export type FundEventType =
    | 'submitted'
    | 'edited'
    | 'step_approved'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'payment'
    | 'closed'
    | 'return_requested'
    | 'return_received'
    | 'return_rejected';

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
    /** The units (Configuration > Company) the request is charged to. Older requests carry only the names. */
    branchId?: string | null;
    departmentId?: string | null;
    purpose: string;
    /** What the money is for. The list is managed in Configuration > Categories. */
    category: string;
    amount: number;
    currency: string;
    neededBy: string;
    workOrder: string | null;
    attachment: string | null;
    status: FundRequestStatus;
    approvedAmount: number | null;
    paidAmount: number;
    /** Money the employee gave back, once Accounts confirmed receipt. */
    returnedAmount: number;
    /** Approved money that was never paid because the request was closed early. */
    closedAmount: number | null;
    rejectionReason: string | null;
    /** The approval path this request follows, copied from the approval tree when it was submitted. */
    approvals: ApprovalStep[];
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

export type FundReturnStatus = 'pending' | 'received' | 'rejected';

/** Money an employee gives back to the organization. It counts once Accounts or Admin confirm receipt. */
export interface FundReturn {
    id: string;
    requestId: string;
    employee: string;
    amount: number;
    currency: string;
    method: string;
    reference: string;
    note: string;
    status: FundReturnStatus;
    createdAt: string;
    decidedAt: string | null;
    decidedBy: string | null;
    /** Fund that received the money. */
    fundId: string | null;
    rejectionReason: string | null;
}

export interface ReturnInput {
    amount: number;
    method: string;
    reference: string;
    note: string;
}

export const RETURN_STATUS_LABELS: Record<FundReturnStatus, string> = {
    pending: 'Awaiting confirmation',
    received: 'Received',
    rejected: 'Rejected',
};

export const RETURN_STATUS_CLASSES: Record<FundReturnStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    received: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};

export interface SourceFund {
    id: string;
    name: string;
    category: string;
    currency: string;
    balance: number;
}

export interface FundRequestInput {
    purpose: string;
    category: string;
    amount: number;
    neededBy: string;
    workOrder: string | null;
    attachment: string | null;
    /** Where the cost is charged; left out, the request keeps the default branch and department. */
    branchId?: string | null;
    departmentId?: string | null;
    branch?: string;
    department?: string;
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
    closed: 'Closed',
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
    closed: 'bg-slate-200 text-slate-700',
};

export const EVENT_LABELS: Record<FundEventType, string> = {
    submitted: 'Request submitted',
    edited: 'Request edited',
    step_approved: 'Approval step passed',
    approved: 'Request approved',
    rejected: 'Request rejected',
    cancelled: 'Request cancelled',
    payment: 'Payment recorded',
    closed: 'Request closed',
    return_requested: 'Return requested',
    return_received: 'Return received',
    return_rejected: 'Return rejected',
};

export const EVENT_CLASSES: Record<FundEventType, string> = {
    submitted: 'bg-amber-100 text-amber-800',
    edited: 'bg-gray-200 text-gray-700',
    step_approved: 'bg-sky-100 text-sky-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-700',
    payment: 'bg-green-100 text-green-800',
    closed: 'bg-slate-200 text-slate-700',
    return_requested: 'bg-amber-100 text-amber-800',
    return_received: 'bg-green-100 text-green-800',
    return_rejected: 'bg-red-100 text-red-800',
};
