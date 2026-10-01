export type ClientStatus = 'active' | 'inactive';

export interface Client {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    /** Tax or BIN number. */
    taxId: string;
    industry: string;
    website: string;
    status: ClientStatus;
    notes: string;
    createdAt: string;
}

export type ClientInput = Omit<Client, 'id' | 'createdAt'>;

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'delivered';

export interface ProjectUpdate {
    id: string;
    at: string;
    by: string;
    text: string;
}

export interface Project {
    id: string;
    clientId: string;
    name: string;
    workOrder: string;
    status: ProjectStatus;
    /** 0 to 100. */
    progress: number;
    startDate: string;
    dueDate: string;
    manager: string;
    updates: ProjectUpdate[];
}

export type DocumentType = 'requirement' | 'purchase_order' | 'work_order' | 'bill' | 'delivery_challan';

export interface ClientDocument {
    id: string;
    clientId: string;
    projectId: string | null;
    type: DocumentType;
    title: string;
    reference: string;
    /** Money amount for purchase orders, work orders and bills. Null when not relevant. */
    amount: number | null;
    date: string;
    note: string;
    fileName: string | null;
    /** Who sent it: the client, or Encore staff. */
    from: 'client' | 'company';
    by: string;
    createdAt: string;
}

export type DocumentInput = Omit<ClientDocument, 'id' | 'createdAt' | 'by' | 'from' | 'clientId'>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'Planning',
    in_progress: 'In progress',
    on_hold: 'On hold',
    delivered: 'Delivered',
};

export const PROJECT_STATUS_CLASSES: Record<ProjectStatus, string> = {
    planning: 'bg-slate-200 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-800',
    on_hold: 'bg-amber-100 text-amber-800',
    delivered: 'bg-green-100 text-green-800',
};

export const DOCUMENT_TYPES: { id: DocumentType; label: string; plural: string; hasAmount: boolean }[] = [
    { id: 'requirement', label: 'Requirement', plural: 'Requirements', hasAmount: false },
    { id: 'purchase_order', label: 'Purchase order', plural: 'Purchase orders', hasAmount: true },
    { id: 'work_order', label: 'Work order', plural: 'Work orders', hasAmount: true },
    { id: 'bill', label: 'Bill', plural: 'Bills', hasAmount: true },
    { id: 'delivery_challan', label: 'Delivery challan', plural: 'Delivery challans', hasAmount: false },
];

export const DOCUMENT_LABELS = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.id, t.label])) as Record<DocumentType, string>;
