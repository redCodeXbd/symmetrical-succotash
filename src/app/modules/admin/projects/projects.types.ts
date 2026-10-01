export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'delivered';
/** What the project delivers: goods, work, or both. */
export type ProjectType = 'supply' | 'service' | 'both';
/** How the client pays: part up front, or after delivery within some days. */
export type PaymentTerm = 'advance' | 'credit';

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
    type: ProjectType;
    status: ProjectStatus;
    /** 0 to 100. */
    progress: number;
    startDate: string;
    dueDate: string;
    manager: string;
    location: string;
    /** Company branch that runs the project. */
    branch: string;
    /** Vendors working on the project. */
    vendorIds: string[];
    workOrder: string;
    description: string;
    /** What the client pays in total. */
    contractValue: number;
    /** What we plan to spend. */
    budget: number;
    paymentTerm: PaymentTerm;
    /** Share of the contract paid up front when the term is "advance". */
    advancePercent: number;
    advanceReceived: number;
    creditDays: number;
    updates: ProjectUpdate[];
}

export type ProjectInput = Omit<Project, 'id' | 'progress' | 'updates'>;

export type CostSource = 'expense' | 'purchase' | 'store';

export interface CostLine {
    date: string;
    source: CostSource;
    ref: string;
    label: string;
    amount: number;
}

export interface Costing {
    lines: CostLine[];
    expense: number;
    purchase: number;
    store: number;
    total: number;
    /** Contract value earned so far, from progress. */
    earned: number;
    /** Earned minus cost to date. */
    profitToDate: number;
    /** Contract value minus the larger of budget and cost to date. */
    projectedProfit: number;
    /** Share of the budget spent. */
    budgetUsed: number;
}

export const BRANCHES = ['Head Office', 'Dhaka Site', 'Chattogram Branch', 'Khulna Branch'];

export const PROJECT_TYPES: { id: ProjectType; label: string; description: string }[] = [
    { id: 'supply', label: 'Supply', description: 'We deliver goods' },
    { id: 'service', label: 'Service', description: 'We do the work' },
    { id: 'both', label: 'Supply and service', description: 'Goods and work together' },
];

export const PROJECT_TYPE_LABELS = Object.fromEntries(PROJECT_TYPES.map((t) => [t.id, t.label])) as Record<ProjectType, string>;

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

export const COST_SOURCE_LABELS: Record<CostSource, string> = {
    expense: 'Expense',
    purchase: 'Vendor purchase',
    store: 'Store issue',
};
