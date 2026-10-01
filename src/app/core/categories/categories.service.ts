import { Injectable, signal } from '@angular/core';

export interface Category {
    id: string;
    name: string;
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
];

/** Category lists for every feature. Kept in memory like the rest of the demo data. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
    private _store = signal<Record<string, Category[]>>(
        Object.fromEntries(
            CATEGORY_GROUPS.map((g) => [g.id, g.defaults.map((name, i) => ({ id: `${g.id}-${i + 1}`, name, description: '' }))])
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
    add(groupId: string, name: string, description: string): string | null {
        const error = this._validate(groupId, name);
        if (error) {
            return error;
        }
        const category: Category = { id: `${groupId}-${this._next++}`, name: name.trim(), description: description.trim() };
        this._store.update((s) => ({ ...s, [groupId]: [...this.list(groupId), category] }));
        return null;
    }

    update(groupId: string, id: string, name: string, description: string): string | null {
        const error = this._validate(groupId, name, id);
        if (error) {
            return error;
        }
        this._store.update((s) => ({
            ...s,
            [groupId]: this.list(groupId).map((c) => (c.id === id ? { ...c, name: name.trim(), description: description.trim() } : c)),
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
