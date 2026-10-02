export type StoreType = 'office' | 'project';

export interface Store {
    id: string;
    name: string;
    type: StoreType;
    /** The project a project store belongs to. */
    projectId: string | null;
    location: string;
}

/**
 * Consumable: used up (cable lugs, tape, paper). Asset: kept and reused (tools, instruments); it moves between
 * stores but is never consumed. Supply: goods we sell or hand over to a client as part of a project.
 */
export type ProductKind = 'consumable' | 'asset' | 'supply';

export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    kind: ProductKind;
    unit: string;
    description: string;
    /** Warn when a store holds less than this. */
    minStock: number;
    active: boolean;
    /** The expense whose purchase added this product to the list automatically. */
    addedFrom?: string;
}

export type ProductInput = Omit<Product, 'id' | 'addedFrom'>;

export type MovementType = 'receive' | 'issue' | 'transfer_out' | 'transfer_in' | 'adjust_in' | 'adjust_out';
export type ReceiptSource = 'expense' | 'purchase' | 'manual';

export interface Movement {
    id: string;
    date: string;
    type: MovementType;
    storeId: string;
    productId: string;
    qty: number;
    /** Cost of one unit when the movement happened. */
    unitCost: number;
    /** The project an issue is charged to. Empty for office use. */
    projectId: string | null;
    /** The other store in a transfer. */
    counterStoreId: string | null;
    source: ReceiptSource | null;
    /** The expense (fund request) or purchase order a receipt came from. */
    ref: string;
    note: string;
    by: string;
}

export interface StockRow {
    product: Product;
    qty: number;
    avgCost: number;
    value: number;
    low: boolean;
}

export interface ReceiptLine {
    productId: string;
    qty: number;
    unitCost: number;
}

export const KIND_LABELS: Record<ProductKind, string> = { consumable: 'Consumable', asset: 'Asset', supply: 'Supply item' };
export const KIND_CLASSES: Record<ProductKind, string> = {
    consumable: 'bg-amber-100 text-amber-800',
    asset: 'bg-violet-100 text-violet-800',
    supply: 'bg-blue-100 text-blue-800',
};
export const KIND_HELP: Record<ProductKind, string> = {
    consumable: 'Used up when issued, like lugs, tape or paper.',
    asset: 'Kept and reused, like tools and instruments. Moved between stores, never consumed.',
    supply: 'Goods we sell or hand over to a client as part of a project.',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
    receive: 'Received',
    issue: 'Issued',
    transfer_out: 'Transferred out',
    transfer_in: 'Transferred in',
    adjust_in: 'Stock added (count)',
    adjust_out: 'Stock removed (count)',
};

/** Movements that put stock into a store. */
export const INCOMING: MovementType[] = ['receive', 'transfer_in', 'adjust_in'];
