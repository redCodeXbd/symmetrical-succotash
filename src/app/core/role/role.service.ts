import { computed, Injectable, signal } from '@angular/core';

export type AppRole = 'employee' | 'accountant' | 'admin';

export const ROLE_LABELS: Record<AppRole, string> = {
    employee: 'Employee',
    accountant: 'Accountant',
    admin: 'Admin',
};

const STORAGE_KEY = 'encore.role';

/**
 * Who the signed-in user is acting as. There is no backend role yet, so the role is picked with the
 * "Preview as" switch and kept in this browser. Replace `role` with the signed-in user's real role
 * once the server provides it; everything else keys off this service.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
    readonly role = signal<AppRole>(this._load());

    /** Accountants and admins see every employee's records; employees see only their own. */
    readonly canSeeAll = computed(() => this.role() !== 'employee');
    readonly isAdmin = computed(() => this.role() === 'admin');

    set(role: AppRole): void {
        this.role.set(role);
        try {
            localStorage.setItem(STORAGE_KEY, role);
        } catch {
            // Storage can be blocked; the role then lasts for this session only.
        }
    }

    has(roles: AppRole[]): boolean {
        return roles.includes(this.role());
    }

    private _load(): AppRole {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'employee' || stored === 'accountant' || stored === 'admin') {
                return stored;
            }
        } catch {
            // Fall through to the default.
        }
        return 'admin';
    }
}
