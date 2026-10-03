import { Injectable, signal } from '@angular/core';
import { AccessService } from 'app/core/access/access.service';
import { StoreService } from '../../store/store.service';
import { UsersService } from '../../users/users.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { ChargedTo } from './charged-to.component';
import { CHILD_KIND, Company, CostReport, CostRow, CompanyInput, OrgUnit, UnitInput, UnitKind } from './company.types';

/**
 * The organisation structure: companies, and under each the branches, departments and teams.
 * Warehouses are the stores of the Store feature, placed under a branch, so there is one list of them.
 * In memory for now. Each method returns an error message, or null (or the new id) on success.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
    private _companies = signal<Company[]>(this._seedCompanies());
    private _units = signal<OrgUnit[]>(this._seedUnits());

    readonly companies = this._companies.asReadonly();
    readonly units = this._units.asReadonly();

    constructor(
        private _access: AccessService,
        private _users: UsersService,
        private _store: StoreService,
        private _expenses: ExpensesService
    ) {}

    company(id: string): Company | null {
        return this._companies().find((c) => c.id === id) ?? null;
    }

    unit(id: string | null | undefined): OrgUnit | null {
        return id ? (this._units().find((u) => u.id === id) ?? null) : null;
    }

    /** Units of a company, optionally of one kind and one parent. Inactive ones are left out unless asked for. */
    unitsOf(companyId: string, kind?: UnitKind, parentId?: string | null, includeInactive = true): OrgUnit[] {
        return this._units().filter(
            (u) =>
                u.companyId === companyId &&
                (!kind || u.kind === kind) &&
                (parentId === undefined || u.parentId === parentId) &&
                (includeInactive || u.active)
        );
    }

    children(unitId: string): OrgUnit[] {
        return this._units().filter((u) => u.parentId === unitId);
    }

    /** Warehouses (stores) placed under a branch of the company. */
    warehousesOf(companyId: string) {
        const branches = new Set(this.unitsOf(companyId, 'branch').map((b) => b.id));
        return this._store.stores().filter((s) => s.branchId && branches.has(s.branchId));
    }

    /** The branch and department the acting user sits in; empty when not placed. */
    placement(): ChargedTo {
        const profile = this._users.profile(this._access.user().id);
        const branch = this.unit(profile.orgBranchId);
        const department = this.unit(profile.orgDeptId);
        return { branchId: branch?.id ?? null, departmentId: department?.id ?? null, branch: branch?.name ?? '', department: department?.name ?? '' };
    }

    /** Find a unit by its name, for records saved before units existed. */
    byName(name: string | null | undefined, kind: UnitKind): OrgUnit | null {
        const n = (name ?? '').trim().toLowerCase();
        return n ? (this._units().find((u) => u.kind === kind && u.name.toLowerCase() === n) ?? null) : null;
    }

    /** Branch and department a cost record is charged to; names stand in for ids on older records. */
    unitIdsOf(r: { branchId?: string | null; departmentId?: string | null; branch?: string; department?: string }): (string | null)[] {
        const branch = this.unit(r.branchId) ?? this.byName(r.branch, 'branch');
        const dept = this.unit(r.departmentId) ?? this.byName(r.department, 'department');
        return [branch?.id ?? null, dept && (!branch || dept.parentId === branch.id) ? dept.id : null];
    }

    /** Branches and departments a cost can be charged to, in tree order. */
    chargeable(): OrgUnit[] {
        return this._companies().flatMap((c) =>
            this.unitsOf(c.id, 'branch').flatMap((b) => [b, ...this.unitsOf(c.id, 'department', b.id)])
        );
    }

    /** Names the branch, department and team in one line, such as "Head Office / Accounts". */
    path(unitId: string | null | undefined): string {
        const parts: string[] = [];
        let unit = this.unit(unitId);
        while (unit) {
            parts.unshift(unit.name);
            unit = this.unit(unit.parentId);
        }
        return parts.join(' / ');
    }

    /** Employees assigned anywhere under the unit (or to the whole company when only a company is given). */
    peopleOf(companyId: string, unitId?: string | null) {
        const ids = unitId ? this._descendantIds(unitId) : null;
        return this._users
            .staff()
            .map((u) => ({ user: u, profile: this._users.profile(u.id) }))
            .filter((r) => r.profile.orgCompanyId === companyId && (!ids || [r.profile.orgBranchId, r.profile.orgDeptId, r.profile.orgTeamId].some((x) => ids.has(x))));
    }

    headcount(companyId: string): number {
        return this.peopleOf(companyId).length;
    }

    /**
     * What each branch and department cost since `from` (an ISO date, or null for all time): approved expenses,
     * plus money actually released on fund requests less what was returned. A cost charged to a department also
     * counts in its branch's total.
     */
    costs(companyId: string, from: string | null): CostReport {
        const direct = new Map<string, number>();
        let unplaced = 0;
        for (const e of this._expenses.expenses()) {
            if (e.status !== 'approved' || (from && e.date < from)) {
                continue;
            }
            const ids = this.unitIdsOf(e);
            const target = this.unit(ids[1] ?? ids[0]);
            if (!target) {
                unplaced += e.amount;
            } else if (target.companyId === companyId) {
                direct.set(target.id, (direct.get(target.id) ?? 0) + e.amount);
            }
        }
        const rolled = (id: string): number => this.children(id).reduce((sum, c) => sum + rolled(c.id), direct.get(id) ?? 0);
        const rows: CostRow[] = [];
        const walk = (parentId: string | null, depth: number) => {
            for (const unit of this.unitsOf(companyId, undefined, parentId).filter((u) => u.kind !== 'team')) {
                rows.push({ unit, depth, total: rolled(unit.id) });
                walk(unit.id, depth + 1);
            }
        };
        walk(null, 0);
        return { rows, unplaced, total: rows.filter((r) => r.depth === 0).reduce((sum, r) => sum + r.total, 0) };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Companies
    // -----------------------------------------------------------------------------------------------------

    addCompany(input: CompanyInput): string | { id: string } {
        if (!this._access.can('company.create')) {
            return 'You do not have permission to add companies.';
        }
        const error = this._validateCompany(input);
        if (error) {
            return error;
        }
        const company: Company = { ...this._cleanCompany(input), id: this._nextId('C-', this._companies().map((c) => c.id)) };
        this._companies.update((list) => [...list, company]);
        return { id: company.id };
    }

    updateCompany(id: string, input: CompanyInput): string | null {
        if (!this._access.can('company.edit')) {
            return 'You do not have permission to edit companies.';
        }
        const error = this._validateCompany(input, id);
        if (error) {
            return error;
        }
        this._companies.update((list) => list.map((c) => (c.id === id ? { ...this._cleanCompany(input), id } : c)));
        return null;
    }

    deleteCompany(id: string): string | null {
        if (!this._access.can('company.delete')) {
            return 'You do not have permission to delete companies.';
        }
        if (this.unitsOf(id).length || this.headcount(id)) {
            return 'This company still has branches or people. Deactivate it instead, or empty it first.';
        }
        this._companies.update((list) => list.filter((c) => c.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Branches, departments and teams
    // -----------------------------------------------------------------------------------------------------

    addUnit(input: UnitInput): string | { id: string } {
        if (!this._access.can('company.create')) {
            return 'You do not have permission to add to the structure.';
        }
        const error = this._validateUnit(input);
        if (error) {
            return error;
        }
        const unit: OrgUnit = { ...this._cleanUnit(input), id: this._nextId('U-', this._units().map((u) => u.id)) };
        this._units.update((list) => [...list, unit]);
        return { id: unit.id };
    }

    updateUnit(id: string, input: UnitInput): string | null {
        if (!this._access.can('company.edit')) {
            return 'You do not have permission to edit the structure.';
        }
        const current = this.unit(id);
        if (!current) {
            return 'This unit no longer exists.';
        }
        const error = this._validateUnit({ ...input, kind: current.kind, companyId: current.companyId }, id);
        if (error) {
            return error;
        }
        if (input.parentId !== current.parentId && this._descendantIds(id).has(input.parentId ?? '')) {
            return 'A unit cannot be moved under itself.';
        }
        const next: OrgUnit = { ...this._cleanUnit({ ...input, kind: current.kind, companyId: current.companyId }), id };
        this._units.update((list) => list.map((u) => (u.id === id ? next : u)));
        // The people under a moved unit keep their own unit; refresh the branch/department they were saved with.
        return null;
    }

    /** Switch a unit, and everything under it, active or inactive. */
    setUnitActive(id: string, active: boolean): string | null {
        if (!this._access.can('company.edit')) {
            return 'You do not have permission to edit the structure.';
        }
        const ids = this._descendantIds(id);
        this._units.update((list) => list.map((u) => (ids.has(u.id) ? { ...u, active } : u)));
        return null;
    }

    deleteUnit(id: string): string | null {
        if (!this._access.can('company.delete')) {
            return 'You do not have permission to delete from the structure.';
        }
        const unit = this.unit(id);
        if (!unit) {
            return null;
        }
        if (this.children(id).length) {
            return `This ${unit.kind} still has ${CHILD_KIND[unit.kind]}s under it. Move or delete them first.`;
        }
        if (this.peopleOf(unit.companyId, id).length) {
            return 'People are still assigned here. Move them first, or deactivate the unit instead.';
        }
        if (unit.kind === 'branch' && this._store.stores().some((s) => s.branchId === id)) {
            return 'A warehouse still belongs to this branch. Move it first, or deactivate the branch instead.';
        }
        this._units.update((list) => list.filter((u) => u.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _descendantIds(id: string): Set<string> {
        const ids = new Set<string>([id]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const u of this._units()) {
                if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
                    ids.add(u.id);
                    grew = true;
                }
            }
        }
        return ids;
    }

    private _validateCompany(i: CompanyInput, id?: string): string | null {
        if (!i.name.trim()) {
            return 'Enter the company name.';
        }
        if (!i.code.trim()) {
            return 'Enter a short code for the company, such as ENC.';
        }
        if (this._companies().some((c) => c.id !== id && c.code.toLowerCase() === i.code.trim().toLowerCase())) {
            return 'Another company already uses this code.';
        }
        if (this._companies().some((c) => c.id !== id && c.name.toLowerCase() === i.name.trim().toLowerCase())) {
            return 'A company with this name already exists.';
        }
        if (i.email.trim() && !/^\S+@\S+\.\S+$/.test(i.email.trim())) {
            return 'Enter a valid company email.';
        }
        return null;
    }

    private _validateUnit(i: UnitInput, id?: string): string | null {
        const label = i.kind === 'branch' ? 'branch' : i.kind;
        if (!i.name.trim()) {
            return `Enter the ${label} name.`;
        }
        if (!i.code.trim()) {
            return `Enter a short code for the ${label}.`;
        }
        if (!this.company(i.companyId)) {
            return 'Choose a company.';
        }
        const parent = this.unit(i.parentId);
        if (i.kind === 'branch' ? i.parentId : !parent || parent.companyId !== i.companyId || CHILD_KIND[parent.kind] !== i.kind) {
            return i.kind === 'department' ? 'Choose the branch this department belongs to.' : i.kind === 'team' ? 'Choose the department this team belongs to.' : 'A branch sits directly under the company.';
        }
        const siblings = this._units().filter((u) => u.id !== id && u.companyId === i.companyId && u.kind === i.kind);
        if (siblings.some((u) => u.code.toLowerCase() === i.code.trim().toLowerCase())) {
            return `Another ${label} already uses this code.`;
        }
        if (siblings.some((u) => u.parentId === i.parentId && u.name.toLowerCase() === i.name.trim().toLowerCase())) {
            return `A ${label} with this name already exists here.`;
        }
        return null;
    }

    private _cleanCompany(i: CompanyInput): CompanyInput {
        return {
            ...i,
            code: i.code.trim().toUpperCase(),
            name: i.name.trim(),
            legalName: i.legalName.trim(),
            tradeLicense: i.tradeLicense.trim(),
            taxId: i.taxId.trim(),
            address: i.address.trim(),
            phone: i.phone.trim(),
            email: i.email.trim(),
        };
    }

    private _cleanUnit(i: UnitInput): UnitInput {
        return { ...i, code: i.code.trim().toUpperCase(), name: i.name.trim(), address: i.address.trim(), notes: i.notes.trim(), managerId: i.managerId || null };
    }

    private _nextId(prefix: string, ids: string[]): string {
        const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), 0);
        return `${prefix}${max + 1}`;
    }

    private _seedCompanies(): Company[] {
        return [
            {
                id: 'C-1', code: 'ENC', name: 'Encore Engineering Ltd', legalName: 'Encore Engineering Limited', tradeLicense: 'TRAD/DNCC/012345/2024',
                taxId: '123456789012', address: 'House 12, Road 5, Banani, Dhaka', phone: '+880 2 5566 7788', email: 'info@encore.example', currency: 'BDT',
                fiscalStartMonth: 7, active: true,
            },
        ];
    }

    private _seedUnits(): OrgUnit[] {
        const u = (id: string, kind: UnitKind, parentId: string | null, code: string, name: string, managerId: string | null = null, address = ''): OrgUnit => ({
            id, companyId: 'C-1', kind, parentId, code, name, managerId, address, notes: '', active: true,
        });
        return [
            u('U-1', 'branch', null, 'HO', 'Head Office', 'u-brian', 'House 12, Road 5, Banani, Dhaka'),
            u('U-2', 'branch', null, 'CTG', 'Chattogram Branch', null, 'BSCIC Industrial Area, Chattogram'),
            u('U-3', 'department', 'U-1', 'SVC', 'Service Team'),
            u('U-4', 'department', 'U-1', 'ADM', 'Encore Admin'),
            u('U-5', 'department', 'U-1', 'PRC', 'Procurement'),
            u('U-6', 'department', 'U-1', 'SAL', 'Sales'),
            u('U-7', 'department', 'U-1', 'OPS', 'Operations'),
            u('U-8', 'department', 'U-1', 'ACC', 'Accounts'),
            u('U-9', 'department', 'U-2', 'CSV', 'Site Service'),
            u('U-10', 'team', 'U-3', 'FLD', 'Field crew'),
            u('U-11', 'team', 'U-6', 'EST', 'Estimation team'),
            u('U-12', 'branch', null, 'DHS', 'Dhaka Site', null, 'Savar, Dhaka'),
            u('U-13', 'branch', null, 'KHL', 'Khulna Branch', null, 'Khulna'),
        ];
    }
}
