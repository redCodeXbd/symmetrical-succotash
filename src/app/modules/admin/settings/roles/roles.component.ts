import { SwitchComponent } from '../../treasury/shared/switch/switch.component';
import { DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AccessService } from 'app/core/access/access.service';
import { AppUser, ApprovalRule, FEATURES, Role } from 'app/core/access/access.types';

type Tab = 'roles' | 'permissions' | 'employees' | 'approvals';

interface RuleDraft {
    /** Null while a new branch is being made. */
    id: string | null;
    minAmount: number;
    steps: string[];
}

@Component({
    selector: 'settings-roles',
    templateUrl: './roles.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DecimalPipe, FormsModule, MatButtonModule, SwitchComponent],
})
export class RolesSettingsComponent {
    readonly features = FEATURES;
    readonly tabs: { id: Tab; label: string }[] = [
        { id: 'roles', label: 'Roles' },
        { id: 'permissions', label: 'Permissions' },
        { id: 'employees', label: 'Employees' },
        { id: 'approvals', label: 'Approval tree' },
    ];

    tab = signal<Tab>('roles');
    message = signal<{ text: string; ok: boolean } | null>(null);

    // Roles
    roleDraft = { name: '', description: '' };
    editingRole: { id: string; name: string; description: string } | null = null;
    deletingRole: string | null = null;

    // Employees
    userDraft = { name: '', email: '' };

    // Approval tree
    ruleDraft: RuleDraft | null = null;
    deletingRule: string | null = null;
    addStepRole = '';
    testAmount = 25000;

    constructor(public access: AccessService) {}

    readonly sortedRules = computed(() => [...this.access.rules()].sort((a, b) => a.minAmount - b.minAmount));
    readonly testPath = computed(() => this.access.ruleFor(Number(this.testAmount) || 0).steps);

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.message.set(null);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Roles
    // -----------------------------------------------------------------------------------------------------

    permissionCount(role: Role): number {
        return this.access.permissionsOf(role).length;
    }

    peopleCount(role: Role): number {
        return this.access.users().filter((u) => u.roleIds.includes(role.id)).length;
    }

    addRole(): void {
        const error = this.access.addRole(this.roleDraft.name, this.roleDraft.description);
        this._report(error, 'Role created. Choose what it can do in the Permissions tab.');
        if (!error) {
            this.roleDraft = { name: '', description: '' };
        }
    }

    startEdit(role: Role): void {
        this.editingRole = { id: role.id, name: role.name, description: role.description };
        this.message.set(null);
    }

    saveEdit(): void {
        if (!this.editingRole) {
            return;
        }
        const error = this.access.updateRole(this.editingRole.id, this.editingRole.name, this.editingRole.description);
        this._report(error, 'Role updated.');
        if (!error) {
            this.editingRole = null;
        }
    }

    removeRole(role: Role): void {
        const error = this.access.deleteRole(role.id);
        this._report(error, `Role "${role.name}" deleted.`);
        this.deletingRole = null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Permissions
    // -----------------------------------------------------------------------------------------------------

    has(role: Role, permission: string): boolean {
        return this.access.permissionsOf(role).includes(permission);
    }

    toggle(role: Role, permission: string, on: boolean): void {
        this.access.setPermission(role.id, permission, on);
    }

    /** Switches every permission of one feature on or off for a role. */
    toggleFeature(role: Role, featureId: string, on: boolean): void {
        const feature = this.features.find((f) => f.id === featureId);
        feature?.permissions.forEach((p) => this.access.setPermission(role.id, `${featureId}.${p.key}`, on));
    }

    featureAll(role: Role, featureId: string): boolean {
        return !!this.features.find((f) => f.id === featureId)?.permissions.every((p) => this.has(role, `${featureId}.${p.key}`));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Employees
    // -----------------------------------------------------------------------------------------------------

    addUser(): void {
        const error = this.access.addUser(this.userDraft.name, this.userDraft.email);
        this._report(error, 'Employee added with the Employee role. Give more roles below if needed.');
        if (!error) {
            this.userDraft = { name: '', email: '' };
        }
    }

    toggleUserRole(user: AppUser, roleId: string, event: Event): void {
        const on = (event.target as HTMLInputElement).checked;
        const roleIds = on ? [...user.roleIds, roleId] : user.roleIds.filter((id) => id !== roleId);
        const error = this.access.setUserRoles(user.id, roleIds);
        if (error) {
            // The change was refused; put the checkbox back as it was.
            (event.target as HTMLInputElement).checked = !on;
        }
        this._report(error, null);
    }

    effectivePermissions(user: AppUser): number {
        const roles = this.access.roles().filter((r) => user.roleIds.includes(r.id));
        return new Set(roles.flatMap((r) => this.access.permissionsOf(r))).size;
    }

    initials(name: string): string {
        return name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? '')
            .join('');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Approval tree
    // -----------------------------------------------------------------------------------------------------

    /** Amount range a branch covers, such as "20,000 to 99,999" or "100,000 and above". */
    rangeText(rule: ApprovalRule): string {
        const rules = this.sortedRules();
        const next = rules[rules.findIndex((r) => r.id === rule.id) + 1];
        const fmt = (n: number) => n.toLocaleString('en-US');
        if (!next) {
            return rule.minAmount === 0 ? 'Any amount' : `${fmt(rule.minAmount)} and above`;
        }
        return `${fmt(rule.minAmount)} to ${fmt(next.minAmount - 1)}`;
    }

    startRule(rule?: ApprovalRule): void {
        this.message.set(null);
        this.addStepRole = '';
        this.ruleDraft = rule
            ? { id: rule.id, minAmount: rule.minAmount, steps: [...rule.steps] }
            : { id: null, minAmount: 0, steps: [] };
    }

    cancelRule(): void {
        this.ruleDraft = null;
    }

    addStep(): void {
        if (this.ruleDraft && this.addStepRole) {
            this.ruleDraft.steps = [...this.ruleDraft.steps, this.addStepRole];
            this.addStepRole = '';
        }
    }

    moveStep(index: number, by: number): void {
        const steps = [...(this.ruleDraft?.steps ?? [])];
        const to = index + by;
        if (this.ruleDraft && to >= 0 && to < steps.length) {
            [steps[index], steps[to]] = [steps[to], steps[index]];
            this.ruleDraft.steps = steps;
        }
    }

    removeStep(index: number): void {
        if (this.ruleDraft) {
            this.ruleDraft.steps = this.ruleDraft.steps.filter((_, i) => i !== index);
        }
    }

    saveRule(): void {
        const draft = this.ruleDraft;
        if (!draft) {
            return;
        }
        const amount = Number(draft.minAmount);
        const error = draft.id ? this.access.updateRule(draft.id, amount, draft.steps) : this.access.addRule(amount, draft.steps);
        this._report(error, 'Approval tree saved. New requests follow it; requests already submitted keep their own path.');
        if (!error) {
            this.ruleDraft = null;
        }
    }

    removeRule(rule: ApprovalRule): void {
        this._report(this.access.deleteRule(rule.id), 'Branch deleted.');
        this.deletingRule = null;
    }

    private _report(error: string | null, success: string | null): void {
        this.message.set(error ? { text: error, ok: false } : success ? { text: success, ok: true } : null);
    }
}
