import { ApprovalStep } from 'app/core/access/access.types';

/** What extra details a category asks for. The kind decides the fields shown on the form. */
export type ExpenseKind = 'general' | 'purchase' | 'vendor' | 'conveyance' | 'food' | 'rent' | 'promotion';

export interface ExpenseCategory {
    id: string;
    name: string;
    kind: ExpenseKind;
    color: string;
}

export interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'number' | 'month' | 'select';
    options?: string[];
    placeholder?: string;
}

export const KIND_FIELDS: Record<ExpenseKind, FieldDef[]> = {
    general: [],
    purchase: [{ key: 'invoiceNo', label: 'Bill / memo number', type: 'text' }],
    vendor: [{ key: 'invoiceNo', label: 'Vendor bill number', type: 'text' }],
    conveyance: [
        { key: 'from', label: 'From', type: 'text' },
        { key: 'to', label: 'To', type: 'text' },
        { key: 'mode', label: 'Transport', type: 'select', options: ['Bus', 'CNG', 'Rickshaw', 'Car / taxi', 'Train', 'Launch', 'Air', 'Other'] },
        { key: 'person', label: 'Traveller', type: 'text' },
        { key: 'distance', label: 'Distance (km)', type: 'number' },
    ],
    food: [
        { key: 'persons', label: 'Number of people', type: 'number' },
        { key: 'occasion', label: 'Meal / occasion', type: 'text', placeholder: 'Lunch with client, site team tea...' },
    ],
    rent: [
        { key: 'property', label: 'Property', type: 'text', placeholder: 'Head office, Dhaka site...' },
        { key: 'period', label: 'Rent for month', type: 'month' },
        { key: 'landlord', label: 'Landlord', type: 'text' },
    ],
    promotion: [
        { key: 'campaign', label: 'Campaign', type: 'text' },
        { key: 'channel', label: 'Channel', type: 'select', options: ['Facebook / social', 'Print', 'Event / exhibition', 'Gifts & samples', 'Website / SEO', 'Other'] },
    ],
};

export const KIND_LABELS: Record<ExpenseKind, string> = {
    general: 'General cost',
    purchase: 'Purchase of goods (items, can go into a store)',
    vendor: 'Payment to a vendor (reduces what we owe them)',
    conveyance: 'Transport and travel',
    food: 'Food and refreshments',
    rent: 'Rent',
    promotion: 'Business promotion',
};

export interface ExpenseItem {
    name: string;
    qty: number;
    unit: string;
    unitCost: number;
}

export interface Receipt {
    name: string;
    /** Small JPEG as a data URL. */
    data: string;
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface ExpenseEvent {
    at: string;
    by: string;
    title: string;
    note?: string;
}

export interface Expense {
    id: string;
    date: string;
    categoryId: string;
    amount: number;
    description: string;
    payee: string;
    vendorId: string | null;
    projectId: string | null;
    /** Name of the branch charged; the unit itself is `branchId`. */
    branch: string;
    /** Which part of the company this cost belongs to (Configuration > Company). */
    branchId: string | null;
    departmentId: string | null;
    paymentMethod: string;
    /** Details asked by the category kind, such as route or campaign. */
    meta: Record<string, string>;
    items: ExpenseItem[];
    receipts: Receipt[];
    status: ExpenseStatus;
    approvals: ApprovalStep[];
    rejectionReason: string;
    paid: boolean;
    paidAt: string | null;
    fundId: string | null;
    paymentReference: string;
    createdBy: string;
    createdAt: string;
    events: ExpenseEvent[];
}

export type ExpenseInput = Omit<
    Expense,
    'id' | 'status' | 'approvals' | 'rejectionReason' | 'paid' | 'paidAt' | 'fundId' | 'paymentReference' | 'createdBy' | 'createdAt' | 'events'
>;

export interface PayInput {
    fundId: string | null;
    method: string;
    reference: string;
    date: string;
}

export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Mobile banking', 'Cheque'];
export const BRANCHES = ['Head Office', 'Dhaka Site', 'Chattogram Branch', 'Khulna Branch'];

export const STATUS_LABELS: Record<ExpenseStatus, string> = { pending: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected' };
export const STATUS_CLASSES: Record<ExpenseStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};

/** Colours given to new categories, in turn. */
export const CATEGORY_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#9333ea'];
