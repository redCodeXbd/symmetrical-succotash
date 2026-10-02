import { Injectable, signal } from '@angular/core';

export interface Category {
    id: string;
    name: string;
    /** For groups whose categories have a type, such as expense categories. */
    kind?: string;
    description: string;
}

/**
 * The features that have categories. To give a new feature categories, add an entry here, then add a
 * matching section in Configuration > Categories (its "used by" count and rename hook) and read the names
 * from `CategoryService.names(groupId)` wherever the feature offers a category choice.
 */
export interface CategoryGroup {
    id: string;
    title: string;
    description: string;
    defaults: string[];
    /** When set, each category in the group has a type chosen from this list. */
    kinds?: { id: string; label: string; help: string }[];
    /** The type each default category starts with; others get the first type. */
    defaultKinds?: Record<string, string>;
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
    {
        id: 'org-funds',
        title: 'Organization funds',
        description: 'Groups the funds on Organization Funds. Accounts pick a category first when they give money out.',
        defaults: ['Operations', 'Project', 'Procurement', 'Payroll', 'Travel & Transport', 'Petty cash'],
    },
    {
        id: 'fund-requests',
        title: 'Fund requests',
        description: 'What an employee asks money for. It is chosen on the Request Funds form.',
        defaults: ['Travel & transport', 'Materials & supplies', 'Site expenses', 'Office', 'Meals & entertainment', 'Other'],
    },
    {
        id: 'store-items',
        title: 'Store items',
        description: 'Groups the product catalogue in Store, such as Electrical or Tools.',
        defaults: ['Electrical', 'Mechanical', 'Civil', 'Tools & equipment', 'Safety', 'Office supplies', 'Spare parts'],
    },
    {
        id: 'expense-types',
        title: 'Expenses',
        description: 'What a cost is for in Expenses. The type decides which details the expense form asks for.',
        defaults: [
            'Office cost', 'Product purchase', 'Vendor payment', 'Service payment', 'Parts purchase', 'Conveyance & transport',
            'Business promotion', 'Food cost', 'Office rent', 'Utilities', 'Repair & maintenance', 'Stationery & printing',
            'Communication', 'Staff welfare', 'Legal & professional fees', 'Bank charges & fees', 'Tax & government fees', 'Other cost',
        ],
        kinds: [
            { id: 'general', label: 'General cost', help: 'Description and who was paid' },
            { id: 'purchase', label: 'Purchase of goods', help: 'Item lines; can be received into a store' },
            { id: 'vendor', label: 'Vendor payment', help: 'Pick a vendor; lowers what is owed to them' },
            { id: 'conveyance', label: 'Transport', help: 'From, to, mode and traveller' },
            { id: 'food', label: 'Food', help: 'People and occasion' },
            { id: 'rent', label: 'Rent', help: 'Property, month and landlord' },
            { id: 'promotion', label: 'Promotion', help: 'Campaign and channel' },
        ],
        defaultKinds: {
            'Product purchase': 'purchase', 'Parts purchase': 'purchase', 'Vendor payment': 'vendor', 'Service payment': 'vendor',
            'Conveyance & transport': 'conveyance', 'Business promotion': 'promotion', 'Food cost': 'food', 'Office rent': 'rent',
        },
    },
];

/** Category lists for every feature. Kept in memory like the rest of the demo data. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
    private _store = signal<Record<string, Category[]>>(
        Object.fromEntries(
            CATEGORY_GROUPS.map((g) => [
                g.id,
                g.defaults.map((name, i) => ({
                    id: `${g.id}-${i + 1}`,
                    name,
                    description: '',
                    ...(g.kinds ? { kind: g.defaultKinds?.[name] ?? g.kinds[0].id } : {}),
                })),
            ])
        )
    );
    private _next = 100;

    readonly groups = CATEGORY_GROUPS;

    list(groupId: string): Category[] {
        return this._store()[groupId] ?? [];
    }

    names(groupId: string): string[] {
        return this.list(groupId).map((c) => c.name);
    }

    /** Returns an error message, or null when the category was added. */
    add(groupId: string, name: string, description: string, kind?: string): string | null {
        const error = this._validate(groupId, name);
        if (error) {
            return error;
        }
        const category: Category = { id: `${groupId}-${this._next++}`, name: name.trim(), description: description.trim(), ...(kind ? { kind } : {}) };
        this._store.update((s) => ({ ...s, [groupId]: [...this.list(groupId), category] }));
        return null;
    }

    update(groupId: string, id: string, name: string, description: string, kind?: string): string | null {
        const error = this._validate(groupId, name, id);
        if (error) {
            return error;
        }
        this._store.update((s) => ({
            ...s,
            [groupId]: this.list(groupId).map((c) => (c.id === id ? { ...c, name: name.trim(), description: description.trim(), ...(kind ? { kind } : {}) } : c)),
        }));
        return null;
    }

    remove(groupId: string, id: string): void {
        this._store.update((s) => ({ ...s, [groupId]: this.list(groupId).filter((c) => c.id !== id) }));
    }

    /** Adds the category if it is not there yet; used when a form creates one on the fly. */
    ensure(groupId: string, name: string): string {
        const clean = name.trim();
        const found = this.list(groupId).find((c) => c.name.toLowerCase() === clean.toLowerCase());
        if (found) {
            return found.name;
        }
        this.add(groupId, clean, '');
        return clean;
    }

    private _validate(groupId: string, name: string, ignoreId?: string): string | null {
        const clean = name.trim();
        if (!clean) {
            return 'Enter a category name.';
        }
        if (clean.length > 40) {
            return 'Keep the name to 40 characters or less.';
        }
        const clash = this.list(groupId).some((c) => c.id !== ignoreId && c.name.toLowerCase() === clean.toLowerCase());
        return clash ? 'A category with this name already exists.' : null;
    }
}
