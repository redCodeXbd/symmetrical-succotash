import { computed, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { FundsService } from '../treasury/funds/funds.service';
import { ExpensesService } from '../expenses/expenses.service';
import { StoreService } from '../store/store.service';
import { VendorsService } from '../vendors/vendors.service';
import { CostLine, Costing, Project, ProjectInput, ProjectStatus } from './projects.types';

/**
 * In-memory store for Projects. Costing and profit are worked out from other features, never typed in:
 *  - Expenses: paid fund requests that name the project's work order (minus money returned), and approved
 *    entries in Expenses linked to the project.
 *  - Vendor purchases: approved vendor invoices linked to the project, directly or through its purchase order.
 *  - Store issues: stock issued from a store to the project, at the store's average cost.
 * Expenses and purchases whose goods went into a store are left out here, because they count when the
 * stock is issued to the project. Otherwise the same money would be counted twice.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
    private _projects = signal<Project[]>(this._seed());

    constructor(
        private _access: AccessService,
        private _funds: FundsService,
        private _vendors: VendorsService,
        private _store: StoreService,
        private _expenses: ExpensesService
    ) {}

    /** Projects the acting user may open: all, their client's, or the ones they manage. */
    readonly projects = computed(() => {
        const all = this._projects();
        if (this._access.can('projects.view_all')) {
            return all;
        }
        const user = this._access.user();
        return user.clientId ? all.filter((p) => p.clientId === user.clientId) : all.filter((p) => p.manager === user.name);
    });

    project(id: string): Project | null {
        return this.projects().find((p) => p.id === id) ?? null;
    }

    projectsOf(clientId: string): Project[] {
        return this.projects().filter((p) => p.clientId === clientId);
    }

    /** Everything, ignoring who is asking. Used by other features to look up names. */
    name(id: string | null): string {
        return this._projects().find((p) => p.id === id)?.name ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Changes. Each returns an error message, or null on success.
    // -----------------------------------------------------------------------------------------------------

    add(input: ProjectInput): string | { id: string } {
        if (!this._access.can('projects.add')) {
            return 'You do not have permission to add projects.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const project: Project = { ...this._clean(input), id: this._nextId(), progress: 0, updates: [] };
        this._projects.update((list) => [project, ...list]);
        return { id: project.id };
    }

    update(id: string, input: ProjectInput): string | null {
        if (!this._access.can('projects.edit')) {
            return 'You do not have permission to edit projects.';
        }
        const error = this._validate(input, id);
        if (error) {
            return error;
        }
        this._projects.update((list) => list.map((p) => (p.id === id ? { ...p, ...this._clean(input) } : p)));
        return null;
    }

    delete(id: string): string | null {
        if (!this._access.can('projects.delete')) {
            return 'You do not have permission to delete projects.';
        }
        if (this.costing(id).lines.length > 0 || this._store.hasProjectActivity(id)) {
            return 'This project already has costs or store movements, so it cannot be deleted. Mark it delivered instead.';
        }
        this._projects.update((list) => list.filter((p) => p.id !== id));
        return null;
    }

    setStatus(id: string, status: ProjectStatus, progress: number): string | null {
        if (!this._access.can('projects.edit')) {
            return 'You do not have permission to change projects.';
        }
        const value = Math.min(100, Math.max(0, Math.round(progress)));
        this._projects.update((list) => list.map((p) => (p.id === id ? { ...p, status, progress: status === 'delivered' ? 100 : value } : p)));
        return null;
    }

    recordAdvance(id: string, amount: number): string | null {
        if (!this._access.can('projects.edit')) {
            return 'You do not have permission to change projects.';
        }
        if (!(amount >= 0)) {
            return 'Enter an amount of zero or more.';
        }
        this._projects.update((list) => list.map((p) => (p.id === id ? { ...p, advanceReceived: amount } : p)));
        return null;
    }

    addUpdate(id: string, text: string): string | null {
        if (!this._access.can('projects.edit')) {
            return 'You do not have permission to post updates.';
        }
        if (!text.trim()) {
            return 'Write the update first.';
        }
        const update = { id: `U-${Date.now()}`, at: DateTime.now().toISO(), by: this._access.user().name, text: text.trim() };
        this._projects.update((list) => list.map((p) => (p.id === id ? { ...p, updates: [update, ...p.updates] } : p)));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Costing and profit
    // -----------------------------------------------------------------------------------------------------

    costing(id: string): Costing {
        const project = this._projects().find((p) => p.id === id);
        if (!project) {
            return { lines: [], expense: 0, purchase: 0, store: 0, total: 0, earned: 0, profitToDate: 0, projectedProfit: 0, budgetUsed: 0 };
        }
        const stocked = this._store.stockedRefs();
        const lines: CostLine[] = [];

        if (project.workOrder) {
            for (const r of this._funds.requests()) {
                const spent = r.paidAmount - r.returnedAmount;
                if (r.workOrder === project.workOrder && spent > 0 && !stocked.has(r.id)) {
                    lines.push({ date: r.submittedAt, source: 'expense', ref: r.id, label: `${r.purpose} (${r.employee})`, amount: spent });
                }
            }
        }
        lines.push(...this._expenses.projectCosts(id, stocked));
        lines.push(...this._vendors.projectInvoiceCosts(id, stocked));
        lines.push(...this._store.projectIssueCosts(id));
        lines.sort((a, b) => b.date.localeCompare(a.date));

        const sum = (s: CostLine['source']) => lines.filter((l) => l.source === s).reduce((t, l) => t + l.amount, 0);
        const total = lines.reduce((t, l) => t + l.amount, 0);
        const earned = Math.round((project.contractValue * project.progress) / 100);
        return {
            lines,
            expense: sum('expense'),
            purchase: sum('purchase'),
            store: sum('store'),
            total,
            earned,
            profitToDate: earned - total,
            projectedProfit: project.contractValue - Math.max(project.budget, total),
            budgetUsed: project.budget > 0 ? Math.round((total / project.budget) * 100) : 0,
        };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _clean(input: ProjectInput): ProjectInput {
        const trimmed = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as unknown as ProjectInput;
        return {
            ...trimmed,
            contractValue: Number(input.contractValue) || 0,
            budget: Number(input.budget) || 0,
            advancePercent: Number(input.advancePercent) || 0,
            advanceReceived: Number(input.advanceReceived) || 0,
            creditDays: Number(input.creditDays) || 0,
        };
    }

    private _validate(input: ProjectInput, ignoreId?: string): string | null {
        if (!input.name.trim()) {
            return 'Enter the project name.';
        }
        if (!input.clientId) {
            return 'Choose the client.';
        }
        if (!input.manager) {
            return 'Assign a project manager.';
        }
        if (Number(input.contractValue) < 0 || Number(input.budget) < 0) {
            return 'Contract value and budget cannot be negative.';
        }
        if (input.paymentTerm === 'advance' && (Number(input.advancePercent) < 0 || Number(input.advancePercent) > 100)) {
            return 'The advance must be between 0 and 100 percent.';
        }
        if (input.type !== 'supply' && !input.branch && input.vendorIds.length === 0) {
            return 'Choose the branch or a vendor that will do the work.';
        }
        const wo = input.workOrder.trim().toLowerCase();
        if (wo && this._projects().some((p) => p.id !== ignoreId && p.workOrder.toLowerCase() === wo)) {
            return 'Another project already uses this work order.';
        }
        return null;
    }

    private _nextId(): string {
        const max = this._projects().reduce((m, p) => Math.max(m, Number(p.id.slice(2)) || 0), 2000);
        return `P-${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    private _seed(): Project[] {
        const u = (id: string, days: number, by: string, text: string) => ({ id, at: this._daysAgo(days), by, text });
        const base = { description: '', advanceReceived: 0, advancePercent: 0, creditDays: 30 };
        return [
            {
                ...base, id: 'P-2001', clientId: 'C-1001', name: 'Substation panel upgrade', type: 'both', status: 'in_progress', progress: 65,
                startDate: this._daysAgo(40), dueDate: this._daysAgo(-20), manager: 'Sara Khan', location: 'BSCIC Industrial Area, Chattogram',
                branch: 'Chattogram Branch', vendorIds: ['V-1001', 'V-1002'], workOrder: 'WO-004-26-100051',
                description: 'Supply and install new LT panels with cabling and testing.',
                contractValue: 1850000, budget: 1300000, paymentTerm: 'advance', advancePercent: 50, advanceReceived: 925000,
                updates: [
                    u('U-3', 1, 'Sara Khan', 'Main panel installed. Cable termination starts tomorrow.'),
                    u('U-2', 8, 'Sara Khan', 'Materials received at site and checked.'),
                    u('U-1', 21, 'Brian Hughes', 'Site survey completed and design approved.'),
                ],
            },
            {
                ...base, id: 'P-2002', clientId: 'C-1001', name: 'Annual maintenance contract', type: 'service', status: 'planning', progress: 10,
                startDate: this._daysAgo(5), dueDate: this._daysAgo(-120), manager: 'Sara Khan', location: 'BSCIC Industrial Area, Chattogram',
                branch: 'Chattogram Branch', vendorIds: [], workOrder: 'WO-003-26-100052',
                contractValue: 600000, budget: 420000, paymentTerm: 'credit', creditDays: 45,
                updates: [u('U-4', 4, 'Sara Khan', 'Visit schedule shared for approval.')],
            },
            {
                ...base, id: 'P-2003', clientId: 'C-1002', name: 'Generator installation', type: 'supply', status: 'in_progress', progress: 40,
                startDate: this._daysAgo(25), dueDate: this._daysAgo(-35), manager: 'Brian Hughes', location: 'Gulshan, Dhaka',
                branch: 'Head Office', vendorIds: [], workOrder: 'WO-002-26-100053',
                contractValue: 2400000, budget: 2000000, paymentTerm: 'advance', advancePercent: 30, advanceReceived: 720000,
                updates: [u('U-5', 2, 'Brian Hughes', 'Foundation work finished. Generator delivery booked for next week.')],
            },
            {
                ...base, id: 'P-2004', clientId: 'C-1002', name: 'Control room wiring', type: 'service', status: 'delivered', progress: 100,
                startDate: this._daysAgo(90), dueDate: this._daysAgo(30), manager: 'Brian Hughes', location: 'Gulshan, Dhaka',
                branch: 'Head Office', vendorIds: [], workOrder: '',
                contractValue: 350000, budget: 250000, paymentTerm: 'credit', creditDays: 30,
                updates: [u('U-6', 30, 'Brian Hughes', 'Handed over and signed off by the client.')],
            },
        ];
    }
}
