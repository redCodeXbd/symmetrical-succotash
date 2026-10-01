import { ApprovalStep } from 'app/core/access/access.types';

export type VendorType = 'product' | 'service' | 'other';

export const VENDOR_TYPES: { id: VendorType; label: string; description: string }[] = [
    { id: 'product', label: 'Product vendor', description: 'Sells products to us' },
    { id: 'service', label: 'Service vendor', description: 'Provides services to us' },
    { id: 'other', label: 'Other', description: 'Any other kind of vendor' },
];

export const VENDOR_TYPE_LABELS = Object.fromEntries(VENDOR_TYPES.map((t) => [t.id, t.label])) as Record<VendorType, string>;

export const VENDOR_TYPE_CLASSES: Record<VendorType, string> = {
    product: 'bg-blue-100 text-blue-800',
    service: 'bg-violet-100 text-violet-800',
    other: 'bg-gray-200 text-gray-700',
};

export interface Vendor {
    id: string;
    name: string;
    type: VendorType;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    taxId: string;
    bankDetails: string;
    paymentTerms: string;
    status: 'active' | 'inactive';
    notes: string;
    createdAt: string;
}

export type VendorInput = Omit<Vendor, 'id' | 'createdAt'>;

export interface VendorProduct {
    id: string;
    vendorId: string;
    name: string;
    unit: string;
    price: number;
}

export interface PurchaseOrderLine {
    name: string;
    qty: number;
    unit: string;
    price: number;
}

export type PoStatus = 'open' | 'received' | 'cancelled';

export interface PurchaseOrder {
    id: string;
    vendorId: string;
    number: string;
    date: string;
    lines: PurchaseOrderLine[];
    total: number;
    status: PoStatus;
    note: string;
    by: string;
    /** The project this order is bought for, if any. */
    projectId: string | null;
}

export type InvoiceStatus = 'submitted' | 'approved' | 'rejected';

export interface VendorInvoice {
    id: string;
    vendorId: string;
    poId: string | null;
    number: string;
    date: string;
    dueDate: string;
    amount: number;
    status: InvoiceStatus;
    note: string;
    /** Photo or scan of the invoice, as a data URL. */
    image: string | null;
    imageName: string | null;
    by: string;
    decisionNote: string;
    /** The project this invoice is a cost of. Defaults to the project of its purchase order. */
    projectId: string | null;
    /** The approval path this invoice follows, copied from the approval tree when it was submitted. */
    approvals: ApprovalStep[];
}

export interface VendorPayment {
    id: string;
    vendorId: string;
    invoiceId: string | null;
    date: string;
    amount: number;
    method: string;
    reference: string;
    by: string;
}

export type DueRequestStatus = 'pending' | 'accepted' | 'declined';

/** A vendor asking to be paid some of what is due. */
export interface DueRequest {
    id: string;
    vendorId: string;
    amount: number;
    note: string;
    status: DueRequestStatus;
    createdAt: string;
    by: string;
    answerNote: string;
}

export interface HistoryEvent {
    at: string;
    title: string;
    detail: string;
    kind: 'po' | 'invoice' | 'payment' | 'request';
}

export const PO_STATUS_LABELS: Record<PoStatus, string> = { open: 'Open', received: 'Received', cancelled: 'Cancelled' };
export const PO_STATUS_CLASSES: Record<PoStatus, string> = {
    open: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-200 text-gray-700',
};
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { submitted: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected' };
export const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
    submitted: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};
export const REQUEST_STATUS_CLASSES: Record<DueRequestStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
};
export const PAYMENT_METHODS = ['Bank transfer', 'Cash', 'Cheque', 'Mobile banking'];
