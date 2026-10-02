import { computed, Injectable, signal } from '@angular/core';
import { ALL_PERMISSIONS, AppUser, ApprovalRule, Role } from './access.types';

const STORAGE_KEY = 'encore.access.v2';

const slug = (name: string): string =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const perms = (...ids: string[]): string[] => ids;

const SEED_ROLES: Role[] = [
    { id: 'admin', name: 'Admin', description: 'Full control of every feature and setting.', permissions: ALL_PERMISSIONS, locked: true },
    {
        id: 'accountant',
        name: 'Accountant',
        description: 'Reviews requests, pays them and manages the funds.',
        locked: false,
        permissions: perms(
            'fund-requests.view', 'fund-requests.view_all', 'fund-requests.approve', 'fund-requests.pay',
            'fund-requests.confirm_return', 'fund-requests.export',
            'org-funds.view', 'org-funds.add', 'org-funds.export',
            'transactions.view', 'transactions.view_all', 'transactions.export',
            'categories.view', 'notifications.view_employee', 'approvals.view',
            'clients.view', 'clients.view_all',
            'vendors.view', 'vendors.view_all', 'vendors.approve_invoice', 'vendors.pay',
            'projects.view', 'projects.view_all', 'projects.view_cost',
            'store.view', 'store.receive', 'store.cost',
            'users.view', 'users.view_salary'
        ),
    },
    {
        id: 'manager',
        name: 'Manager',
        description: 'Approves the first step for the team and sees team requests.',
        locked: false,
        permissions: perms(
            'fund-requests.view', 'fund-requests.view_all', 'fund-requests.add', 'fund-requests.edit',
            'fund-requests.approve', 'fund-requests.close', 'fund-requests.return', 'fund-requests.export',
            'org-funds.view', 'transactions.view', 'transactions.view_all', 'transactions.export',
            'notifications.view_employee', 'approvals.view',
            'clients.view', 'clients.view_all', 'clients.add', 'clients.edit', 'clients.assign_user', 'clients.share',
            'vendors.view', 'vendors.view_all', 'vendors.add', 'vendors.edit', 'vendors.assign_user', 'vendors.create_po', 'vendors.approve_invoice',
            'projects.view', 'projects.view_all', 'projects.add', 'projects.edit', 'projects.view_cost',
            'store.view', 'store.catalog', 'store.receive', 'store.issue', 'store.transfer', 'store.adjust', 'store.cost',
            'users.view'
        ),
    },
    {
        id: 'data-entry',
        name: 'Data entry executive',
        description: 'Enters requests, funds and categories but cannot approve or pay.',
        locked: false,
        permissions: perms(
            'fund-requests.view', 'fund-requests.add', 'fund-requests.edit',
            'org-funds.view', 'org-funds.add',
            'transactions.view', 'categories.view', 'categories.add', 'categories.edit',
            'clients.view', 'clients.view_all', 'clients.add', 'clients.edit',
            'vendors.view', 'vendors.view_all', 'vendors.add', 'vendors.edit', 'vendors.create_po',
            'projects.view', 'projects.view_all', 'projects.add', 'projects.edit',
            'store.view', 'store.catalog', 'store.receive',
            'users.view', 'users.add', 'users.edit'
        ),
    },
    {
        id: 'employee',
        name: 'Employee',
        description: 'Requests funds and sees only their own records.',
        locked: false,
        permissions: perms(
            'fund-requests.view', 'fund-requests.add', 'fund-requests.edit', 'fund-requests.close',
            'fund-requests.return', 'transactions.view', 'projects.view', 'store.view'
        ),
    },
    {
        id: 'client',
        name: 'Client',
        description: "An outside client. Sees only their own projects and documents and can send requirements and orders.",
        locked: false,
        permissions: perms('clients.view', 'clients.submit', 'projects.view'),
    },
    {
        id: 'customer',
        name: 'Customer',
        description: 'Someone who buys from us. Starts with no access beyond the dashboard and their profile; add permissions as customer features arrive.',
        locked: false,
        permissions: [],
    },
    {
        id: 'vendor',
        name: 'Vendor',
        description: 'An outside supplier or service provider. Sees only their own orders, invoices and payments and can submit invoices.',
        locked: false,
        permissions: perms('vendors.view', 'vendors.submit'),
    },
];

const SEED_USERS: AppUser[] = [
    { id: 'u-brian', phone: '01711000001', name: 'Brian Hughes', email: 'hughes.brian@company.com', roleIds: ['admin', 'employee'] },
    { id: 'u-nadia', phone: '01711000002', name: 'Nadia Rahman', email: 'nadia.rahman@company.com', roleIds: ['accountant'] },
    { id: 'u-sara', phone: '01711000003', name: 'Sara Khan', email: 'sara.khan@company.com', roleIds: ['manager'] },
    { id: 'u-imran', phone: '01711000004', name: 'Imran Hossain', email: 'imran.hossain@company.com', roleIds: ['data-entry'] },
    { id: 'u-mehedi', phone: '01711000005', name: 'Mehedi Hasan', email: 'mehedi.hasan@company.com', roleIds: ['employee'] },
    { id: 'u-rahim', phone: '01711000006', name: 'Rahim Ahmed', email: 'rahim.ahmed@company.com', roleIds: ['employee', 'data-entry'] },
    { id: 'u-karim', phone: '01711000007', name: 'Karim Chowdhury', email: 'karim@bengalsteel.example', roleIds: ['client'], clientId: 'C-1001' },
    { id: 'u-farhana', phone: '01711000008', name: 'Farhana Islam', email: 'farhana@deltapower.example', roleIds: ['client'], clientId: 'C-1002' },
    { id: 'u-nusrat', phone: '01711000011', name: 'Nusrat Jahan', email: 'nusrat@example.com', roleIds: ['customer'], customer: true, address: 'Mirpur, Dhaka' },
    { id: 'u-tarek', phone: '01711000012', name: 'Tarek Aziz', email: 'tarek@example.com', roleIds: ['customer'], customer: true, address: 'Agrabad, Chattogram' },
    { id: 'u-jahid', phone: '01711000009', name: 'Jahid Hasan', email: 'jahid@steelcraft.example', roleIds: ['vendor'], vendorId: 'V-1001' },
    { id: 'u-tania', phone: '01711000010', name: 'Tania Akter', email: 'tania@safeguard.example', roleIds: ['vendor'], vendorId: 'V-1002' },
];

/** Small requests need one approver; larger ones climb the tree. */
const SEED_RULES: ApprovalRule[] = [
    { id: 'rule-1', minAmount: 0, steps: ['accountant'] },
    { id: 'rule-2', minAmount: 20000, steps: ['manager', 'accountant'] },
    { id: 'rule-3', minAmount: 100000, steps: ['manager', 'accountant', 'admin'] },
];

interface Stored {
    roles: Role[];
    users: AppUser[];
    rules: ApprovalRule[];
    userId: string;
}

/**
 * Roles, permissions, employees and the approval tree. There is no server yet, so these are kept
 * in this browser. The "acting as" user stands in for whoever signs in; every permission check in
 * the app goes through `can()`, so a server-provided user can replace it later.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
    private _stored = this._load();

    readonly roles = signal<Role[]>(this._stored.roles);
    readonly users = signal<AppUser[]>(this._stored.users);
    readonly rules = signal<ApprovalRule[]>(this._stored.rules);
    readonly userId = signal<string>(this._stored.userId);

    readonly user = computed(() => this.users().find((u) => u.id === this.userId()) ?? this.users()[0]);
    readonly userRoles = computed(() => this.roles().filter((r) => this.user().roleIds.includes(r.id)));
    private _permissions = computed(() => new Set(this.userRoles().flatMap((r) => this.permissionsOf(r))));

    /** Whether the acting user may do something. Several roles add their permissions together. */
    can(permission: string): boolean {
        return this._permissions().has(permission);
    }

    hasRole(roleId: string): boolean {
        return this.user().roleIds.includes(roleId);
    }

    permissionsOf(role: Role): string[] {
        return role.locked ? ALL_PERMISSIONS : role.permissions;
    }

    roleName(id: string): string {
        return this.roles().find((r) => r.id === id)?.name ?? id;
    }

    actAs(userId: string): void {
        this.userId.set(userId);
        this._save();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Roles. Each returns an error message, or null on success.
    // -----------------------------------------------------------------------------------------------------

    addRole(name: string, description: string): string | null {
        const error = this._validateRole(name);
        if (error) {
            return error;
        }
        let id = slug(name) || 'role';
        while (this.roles().some((r) => r.id === id)) {
            id += '-2';
        }
        this.roles.update((list) => [...list, { id, name: name.trim(), description: description.trim(), permissions: [], locked: false }]);
        this._save();
        return null;
    }

    updateRole(id: string, name: string, description: string): string | null {
        const role = this.roles().find((r) => r.id === id);
        if (!role || role.locked) {
            return 'This role cannot be edited.';
        }
        const error = this._validateRole(name, id);
        if (error) {
            return error;
        }
        this.roles.update((list) => list.map((r) => (r.id === id ? { ...r, name: name.trim(), description: description.trim() } : r)));
        this._save();
        return null;
    }

    setPermission(roleId: string, permission: string, on: boolean): void {
        this.roles.update((list) =>
            list.map((r) =>
                r.id !== roleId || r.locked
                    ? r
                    : { ...r, permissions: on ? [...new Set([...r.permissions, permission])] : r.permissions.filter((p) => p !== permission) }
            )
        );
        this._save();
    }

    /** Where a role is still in use, as text, or null when it is free to delete. */
    roleInUse(id: string): string | null {
        const people = this.users().filter((u) => u.roleIds.includes(id)).length;
        if (people > 0) {
            return `${people} ${people === 1 ? 'employee has' : 'employees have'} this role`;
        }
        if (this.rules().some((r) => r.steps.includes(id))) {
            return 'it is a step in the approval tree';
        }
        return null;
    }

    deleteRole(id: string): string | null {
        const role = this.roles().find((r) => r.id === id);
        if (!role || role.locked) {
            return 'This role cannot be deleted.';
        }
        const inUse = this.roleInUse(id);
        if (inUse) {
            return `Cannot delete: ${inUse}.`;
        }
        this.roles.update((list) => list.filter((r) => r.id !== id));
        this._save();
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Employees
    // -----------------------------------------------------------------------------------------------------

    addUser(name: string, email: string): string | null {
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanName) {
            return 'Enter the employee name.';
        }
        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
            return 'Enter a valid email address.';
        }
        if (this.users().some((u) => u.email.toLowerCase() === cleanEmail || u.name.toLowerCase() === cleanName.toLowerCase())) {
            return 'An employee with this name or email already exists.';
        }
        const roleIds = this.roles().some((r) => r.id === 'employee') ? ['employee'] : [];
        this.users.update((list) => [...list, { id: `u-${slug(cleanName)}-${list.length + 1}`, name: cleanName, email: cleanEmail, roleIds }]);
        this._save();
        return null;
    }

    /** Gives a user login access to one client (or removes it with null). Linked users get the Client role if they have none. */
    setUserClient(userId: string, clientId: string | null): void {
        this.users.update((list) =>
            list.map((u) => {
                if (u.id !== userId) {
                    return u;
                }
                const roleIds = clientId && u.roleIds.length === 0 ? ['client'] : u.roleIds;
                return { ...u, clientId, roleIds };
            })
        );
        this._save();
    }

    /** Creates a client login: a user with the Client role linked to the client. */
    addClientUser(name: string, email: string, clientId: string): string | null {
        const error = this.addUser(name, email);
        if (error) {
            return error;
        }
        const created = this.users()[this.users().length - 1];
        this.users.update((list) => list.map((u) => (u.id === created.id ? { ...u, roleIds: ['client'], clientId } : u)));
        this._save();
        return null;
    }

    /** Someone active must always keep a role that can assign roles. */
    private _wouldLockOut(users: AppUser[]): boolean {
        return !users.some(
            (u) => u.active !== false && this.roles().some((r) => u.roleIds.includes(r.id) && this.permissionsOf(r).includes('roles.assign'))
        );
    }

    /** Edits who a person is. Returns an error message, or null on success. */
    updateUser(id: string, patch: { name?: string; email?: string; phone?: string; active?: boolean; address?: string }): string | null {
        const user = this.users().find((u) => u.id === id);
        if (!user) {
            return 'This user no longer exists.';
        }
        const name = (patch.name ?? user.name).trim();
        const email = (patch.email ?? user.email).trim().toLowerCase();
        if (!name) {
            return 'Enter the name.';
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return 'Enter a valid email address.';
        }
        if (this.users().some((u) => u.id !== id && (u.email.toLowerCase() === email || u.name.toLowerCase() === name.toLowerCase()))) {
            return 'Another user already has this name or email.';
        }
        const next = this.users().map((u) => (u.id === id ? { ...u, name, email, phone: (patch.phone ?? u.phone ?? '').trim(), address: (patch.address ?? u.address ?? '').trim(), active: patch.active ?? u.active } : u));
        if (patch.active === false) {
            if (id === this.userId()) {
                return 'You cannot deactivate the user you are acting as.';
            }
            if (this._wouldLockOut(next)) {
                return 'Someone active must keep a role that can assign roles.';
            }
        }
        this.users.set(next);
        this._save();
        return null;
    }

    /** Removes a user. You cannot remove yourself or the last person who can assign roles. */
    removeUser(id: string): string | null {
        if (id === this.userId()) {
            return 'You cannot delete the user you are acting as.';
        }
        const next = this.users().filter((u) => u.id !== id);
        if (this._wouldLockOut(next)) {
            return 'Someone active must keep a role that can assign roles.';
        }
        this.users.set(next);
        this._save();
        return null;
    }

    /**
     * The photo to show for the acting user. The demo's sign-in user keeps the mock photo until they
     * change or remove it.
     */
    avatarFor(mockAvatar?: string): string | null {
        const u = this.user();
        if (u.avatar) {
            return u.avatar;
        }
        return u.avatar === undefined && u.id === 'u-brian' ? (mockAvatar ?? null) : null;
    }

    /** Sets the acting user's photo; an empty text removes it. */
    setAvatar(dataUrl: string): void {
        const id = this.userId();
        this.users.update((list) => list.map((u) => (u.id === id ? { ...u, avatar: dataUrl } : u)));
        this._save();
    }

    /** Lets the signed-in person keep their own contact details up to date. */
    updateProfile(details: { phone: string; title: string; about: string }): void {
        const id = this.userId();
        this.users.update((list) => list.map((u) => (u.id === id ? { ...u, phone: details.phone.trim(), title: details.title.trim(), about: details.about.trim() } : u)));
        this._save();
    }

    /** Creates a customer login: a user with the Customer role and no company. */
    addCustomerUser(name: string, email: string): string | null {
        const error = this.addUser(name, email);
        if (error) {
            return error;
        }
        const created = this.users()[this.users().length - 1];
        this.users.update((list) => list.map((u) => (u.id === created.id ? { ...u, roleIds: ['customer'], customer: true } : u)));
        this._save();
        return null;
    }

    /** Gives a user login access to one vendor (or removes it with null). */
    setUserVendor(userId: string, vendorId: string | null): void {
        this.users.update((list) =>
            list.map((u) => (u.id === userId ? { ...u, vendorId, roleIds: vendorId && u.roleIds.length === 0 ? ['vendor'] : u.roleIds } : u))
        );
        this._save();
    }

    /** Creates a vendor login: a user with the Vendor role linked to the vendor. */
    addVendorUser(name: string, email: string, vendorId: string): string | null {
        const error = this.addUser(name, email);
        if (error) {
            return error;
        }
        const created = this.users()[this.users().length - 1];
        this.users.update((list) => list.map((u) => (u.id === created.id ? { ...u, roleIds: ['vendor'], vendorId } : u)));
        this._save();
        return null;
    }

    /** Gives an employee a set of roles. At least one employee must always be able to assign roles. */
    setUserRoles(userId: string, roleIds: string[]): string | null {
        if (roleIds.length === 0) {
            return 'An employee needs at least one role.';
        }
        const next = this.users().map((u) => (u.id === userId ? { ...u, roleIds } : u));
        const canAssign = (u: AppUser) =>
            u.active !== false &&
            this.roles().some((r) => u.roleIds.includes(r.id) && this.permissionsOf(r).includes('roles.assign'));
        if (!next.some(canAssign)) {
            return 'Someone must keep a role that can assign roles. This change would lock everyone out.';
        }
        this.users.set(next);
        this._save();
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Approval tree
    // -----------------------------------------------------------------------------------------------------

    /** The rule a request of this amount follows: the one with the highest start amount not above it. */
    ruleFor(amount: number): ApprovalRule {
        const sorted = [...this.rules()].sort((a, b) => b.minAmount - a.minAmount);
        return sorted.find((r) => r.minAmount <= amount) ?? sorted[sorted.length - 1];
    }

    addRule(minAmount: number, steps: string[]): string | null {
        const error = this._validateRule(minAmount, steps);
        if (error) {
            return error;
        }
        this.rules.update((list) => [...list, { id: `rule-${Date.now()}`, minAmount, steps }].sort((a, b) => a.minAmount - b.minAmount));
        this._save();
        return null;
    }

    updateRule(id: string, minAmount: number, steps: string[]): string | null {
        const rule = this.rules().find((r) => r.id === id);
        if (!rule) {
            return 'This branch no longer exists.';
        }
        // The first branch always starts at zero so every request has somewhere to go.
        const start = rule.minAmount === 0 ? 0 : minAmount;
        const error = this._validateRule(start, steps, id);
        if (error) {
            return error;
        }
        this.rules.update((list) => list.map((r) => (r.id === id ? { ...r, minAmount: start, steps } : r)).sort((a, b) => a.minAmount - b.minAmount));
        this._save();
        return null;
    }

    deleteRule(id: string): string | null {
        const rule = this.rules().find((r) => r.id === id);
        if (!rule) {
            return null;
        }
        if (rule.minAmount === 0) {
            return 'The first branch (from 0) cannot be deleted.';
        }
        this.rules.update((list) => list.filter((r) => r.id !== id));
        this._save();
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _validateRole(name: string, ignoreId?: string): string | null {
        const clean = name.trim();
        if (!clean) {
            return 'Enter a role name.';
        }
        if (clean.length > 40) {
            return 'Keep the name to 40 characters or less.';
        }
        return this.roles().some((r) => r.id !== ignoreId && r.name.toLowerCase() === clean.toLowerCase())
            ? 'A role with this name already exists.'
            : null;
    }

    private _validateRule(minAmount: number, steps: string[], ignoreId?: string): string | null {
        if (!(minAmount >= 0)) {
            return 'The start amount must be zero or more.';
        }
        if (this.rules().some((r) => r.id !== ignoreId && r.minAmount === minAmount)) {
            return 'Another branch already starts at this amount.';
        }
        if (steps.length === 0) {
            return 'Add at least one approval step.';
        }
        if (steps.some((id) => !this.roles().some((r) => r.id === id))) {
            return 'A step uses a role that no longer exists.';
        }
        return null;
    }

    private _save(): void {
        const data: Stored = { roles: this.roles(), users: this.users(), rules: this.rules(), userId: this.userId() };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // Storage can be blocked; changes then last for this session only.
        }
    }

    private _load(): Stored {
        const seed: Stored = { roles: SEED_ROLES, users: SEED_USERS, rules: SEED_RULES, userId: 'u-brian' };
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | null;
            if (stored?.roles?.length && stored.users?.length && stored.rules?.length) {
                const merged = this._migrate(stored);
                return { ...merged, userId: merged.users.some((u) => u.id === merged.userId) ? merged.userId : merged.users[0].id };
            }
        } catch {
            // Fall through to the seed data.
        }
        return seed;
    }

    /**
     * Saved settings from an older version miss the roles, users and permissions added since.
     * Add them without touching anything that was edited: a seeded role only receives the default
     * permissions of a feature it has none of yet.
     */
    private _migrate(stored: Stored): Stored {
        const roles = stored.roles.map((role) => {
            const seedRole = SEED_ROLES.find((r) => r.id === role.id);
            if (!seedRole || role.locked) {
                return role;
            }
            const add = ['clients', 'vendors', 'projects', 'store', 'users']
                .filter((f) => !role.permissions.some((p) => p.startsWith(`${f}.`)))
                .flatMap((f) => seedRole.permissions.filter((p) => p.startsWith(`${f}.`)));
            return add.length ? { ...role, permissions: [...role.permissions, ...add] } : role;
        });
        SEED_ROLES.filter((r) => !roles.some((x) => x.id === r.id)).forEach((r) => roles.push(r));
        const users = [...stored.users];
        SEED_USERS.filter((u) => (u.clientId || u.vendorId || u.customer) && !users.some((x) => x.id === u.id)).forEach((u) => users.push(u));
        return { ...stored, roles, users };
    }
}
