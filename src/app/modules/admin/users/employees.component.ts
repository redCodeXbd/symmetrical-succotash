import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AccessService } from 'app/core/access/access.service';
import { AppUser } from 'app/core/access/access.types';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { SwitchComponent } from '../treasury/shared/switch/switch.component';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { CompanyService } from '../settings/company/company.service';
import { EmployeeInput, UsersService } from './users.service';
import { DateTime } from 'luxon';
import { ReportDoc } from '../treasury/shared/report.types';
import { ExportMenuComponent } from '../treasury/shared/export-menu/export-menu.component';
import { BLANK_SALARY, DEPARTMENTS, EMPLOYMENT_TYPES, EmployeeProfile, LEDGER_FILTERS, LEDGER_KINDS, SALARY_FIELDS, SHIFTS } from './users.types';

type FinTab = 'overview' | 'transactions' | 'funds';
type Panel = 'form' | 'financial' | 'promote' | 'history' | 'delete';
type FormTab = 'general' | 'office' | 'salary' | 'access';

@Component({
    selector: 'users-employees',
    templateUrl: './employees.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatIconModule, MatMenuModule, AddButtonComponent, ExportMenuComponent, SlideOverComponent, SwitchComponent, UserSwitchComponent],
})
export class EmployeesComponent {
    readonly departments = DEPARTMENTS;
    readonly employmentTypes = EMPLOYMENT_TYPES;
    readonly shifts = SHIFTS;
    readonly salaryFields = SALARY_FIELDS;

    search = signal('');
    department = signal('all');
    type = signal('all');
    message = signal<{ text: string; ok: boolean } | null>(null);

    panel = signal<Panel | null>(null);
    target = signal<AppUser | null>(null);
    formTab = signal<FormTab>('general');
    form: EmployeeInput = this._blank();
    password = '';
    error: string | null = null;
    refundAmount: Record<string, number | null> = {};

    readonly ledgerKinds = LEDGER_KINDS;
    readonly ledgerFilters = LEDGER_FILTERS;
    readonly finTabs: { id: FinTab; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: 'heroicons_outline:chart-pie' },
        { id: 'transactions', label: 'Transactions', icon: 'heroicons_outline:arrows-right-left' },
        { id: 'funds', label: 'Funds', icon: 'heroicons_outline:wallet' },
    ];
    finTab = signal<FinTab>('overview');
    finFilter = signal('all');
    finSearch = signal('');

    /** Every pay and fund movement of the person in the financial drawer. */
    ledger = computed(() => (this.target() ? this.users.ledger(this.target()!.id) : []));
    finRows = computed(() => {
        const kinds = LEDGER_FILTERS.find((f) => f.id === this.finFilter())?.kinds ?? [];
        const q = this.finSearch().trim().toLowerCase();
        return this.ledger().filter((r) => (!kinds.length || kinds.includes(r.kind)) && (!q || [r.title, r.note, r.ref, r.by].some((v) => v.toLowerCase().includes(q))));
    });
    finTotals = computed(() => {
        const rows = this.finRows();
        const sum = (flow: string) => rows.filter((r) => r.flow === flow).reduce((s, r) => s + r.amount, 0);
        return { received: sum('in'), returned: sum('out'), held: sum('held') };
    });
    activity = computed(() => (this.target() ? this.users.activity(this.target()!.id) : null));
    fundRows(fund: 'security' | 'provident') {
        const kinds = [`${fund}_in`, `${fund}_out`];
        return this.ledger().filter((r) => kinds.includes(r.kind));
    }

    /** The whole lifetime statement of the person, whatever the list is filtered to. */
    finDoc = (): ReportDoc => {
        const rows = this.ledger();
        const sum = (flow: string) => rows.filter((r) => r.flow === flow).reduce((s, r) => s + r.amount, 0);
        const p = this.profile;
        return {
            kind: 'table',
            title: `Financial statement of ${this.target()?.name ?? ''}`,
            subtitle: `${p?.designation ?? ''} · ${p?.employeeId ?? ''} · lifetime, ${rows.length} entries · received ${sum('in').toLocaleString('en-US')}, returned ${sum('out').toLocaleString('en-US')}, kept in funds ${sum('held').toLocaleString('en-US')}`,
            columns: [{ header: 'Date' }, { header: 'Type' }, { header: 'Details' }, { header: 'Reference' }, { header: 'Recorded by' }, { header: 'Amount (BDT)', format: 'number' as const }],
            rows: rows.map((r) => [DateTime.fromISO(r.date).toFormat('dd MMM y'), r.title, r.note, r.ref, r.by, r.flow === 'out' ? -r.amount : r.amount]),
            footer: ['', '', '', '', 'Received less returned', sum('in') - sum('out')],
        };
    };


    rows = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.users
            .staff()
            .map((u) => ({ user: u, profile: this.users.profile(u.id) }))
            .filter(
                (r) =>
                    (this.department() === 'all' || r.profile.department === this.department()) &&
                    (this.type() === 'all' || r.profile.employmentType === this.type()) &&
                    (!q || [r.user.name, r.user.email, r.user.phone ?? '', r.profile.designation, r.profile.employeeId].some((v) => v.toLowerCase().includes(q)))
            )
            .sort((a, b) => b.profile.joiningDate.localeCompare(a.profile.joiningDate));
    });

    constructor(
        public users: UsersService,
        public access: AccessService,
        public company: CompanyService
    ) {}

    /** Choices for the company > branch > department > team pickers; a change clears the levels below it. */
    get branchChoices() {
        return this.form.orgCompanyId ? this.company.unitsOf(this.form.orgCompanyId, 'branch', null, false) : [];
    }
    get deptChoices() {
        return this.form.orgBranchId ? this.company.unitsOf(this.form.orgCompanyId, 'department', this.form.orgBranchId, false) : [];
    }
    get teamChoices() {
        return this.form.orgDeptId ? this.company.unitsOf(this.form.orgCompanyId, 'team', this.form.orgDeptId, false) : [];
    }
    pickLevel(level: 'company' | 'branch' | 'dept'): void {
        if (level === 'company') {
            this.form.orgBranchId = '';
        }
        if (level !== 'dept') {
            this.form.orgDeptId = '';
        }
        this.form.orgTeamId = '';
    }

    get profile(): EmployeeProfile | null {
        const t = this.target();
        return t ? this.users.profile(t.id) : null;
    }

    get nameLocked(): boolean {
        const t = this.target();
        return !!t && this.users.nameLocked(t.id);
    }

    get tabs(): { id: FormTab; label: string; icon: string }[] {
        const tabs: { id: FormTab; label: string; icon: string }[] = [
            { id: 'general', label: 'Profile', icon: 'heroicons_outline:user' },
            { id: 'office', label: 'Work', icon: 'heroicons_outline:briefcase' },
        ];
        if (this.access.can('users.view_salary')) {
            tabs.push({ id: 'salary', label: 'Salary', icon: 'heroicons_outline:banknotes' });
        }
        tabs.push({ id: 'access', label: 'Access', icon: 'heroicons_outline:key' });
        return tabs;
    }

    get initials(): string {
        return `${this.form.firstName[0] ?? ''}${this.form.lastName[0] ?? ''}`.toUpperCase() || '?';
    }

    /** Where the person sits, as one line, so the pickers can be checked at a glance. */
    get placement(): string {
        return this.company.path(this.form.orgTeamId || this.form.orgDeptId || this.form.orgBranchId);
    }

    /** What the pay components add up to, to compare with the gross. */
    get componentsTotal(): number {
        const s = this.form.salary;
        return [s.basic, s.houseRent, s.conveyance, s.medical, s.tada, s.mobile].reduce((a, b) => a + (Number(b) || 0), 0);
    }

    get roleChoices() {
        return this.access.roles();
    }

    roleNames(user: AppUser): string[] {
        return this.access.roles().filter((r) => user.roleIds.includes(r.id)).map((r) => r.name);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Panels
    // -----------------------------------------------------------------------------------------------------

    openAdd(): void {
        this.target.set(null);
        this.form = this._blank();
        this.password = '';
        this._open('form');
    }

    openEdit(user: AppUser): void {
        const p = this.users.profile(user.id);
        this.target.set(user);
        this.form = {
            firstName: p.firstName, lastName: p.lastName, email: user.email, phone: user.phone ?? '', designation: p.designation,
            joiningDate: p.joiningDate.slice(0, 10), employmentType: p.employmentType, department: p.department, workstation: p.workstation, orgCompanyId: p.orgCompanyId, orgBranchId: p.orgBranchId, orgDeptId: p.orgDeptId, orgTeamId: p.orgTeamId,
            employeeId: p.employeeId, shift: p.shift, salary: { ...p.salary }, canGenerateIdCard: p.canGenerateIdCard, syncAppUser: p.syncAppUser,
            active: user.active !== false, roleIds: [...user.roleIds],
        };
        this.password = '';
        this._open('form');
    }

    openFinancial(user: AppUser): void {
        this.target.set(user);
        this.finTab.set('overview');
        this.finFilter.set('all');
        this.finSearch.set('');
        this._open('financial');
    }

    openPromote(user: AppUser): void {
        const p = this.users.profile(user.id);
        this.target.set(user);
        this.form = {
            ...this._blank(), designation: p.designation, employmentType: p.employmentType, department: p.department,
            workstation: p.workstation, shift: p.shift, salary: { ...p.salary },
        };
        this._open('promote');
    }

    /** The career of the person as a timeline: each promotion with only what changed, and the joining at the end. */
    career(p: EmployeeProfile) {
        const canSalary = this.access.can('users.view_salary');
        const sorted = [...p.promotions].sort((a, b) => b.date.localeCompare(a.date));
        const steps = sorted.map((h) => {
            const changes: { label: string; from: string; to: string }[] = [];
            if (h.from.designation !== h.to.designation) {
                changes.push({ label: 'Designation', from: h.from.designation || 'New hire', to: h.to.designation });
            }
            if (h.from.employmentType !== h.to.employmentType) {
                changes.push({ label: 'Employment', from: h.from.employmentType, to: h.to.employmentType });
            }
            if (h.from.department !== h.to.department) {
                changes.push({ label: 'Department', from: h.from.department, to: h.to.department });
            }
            const raise = h.to.gross - h.from.gross;
            return { h, changes, raise: canSalary ? raise : 0, pct: canSalary && h.from.gross > 0 ? (raise / h.from.gross) * 100 : 0, ago: DateTime.fromISO(h.date).toRelative() ?? '' };
        });
        const first = sorted[sorted.length - 1];
        const startGross = first ? first.from.gross : p.salary.gross;
        const tenure = DateTime.now().diff(DateTime.fromISO(p.joiningDate), ['years', 'months']).toObject();
        const years = Math.floor(tenure.years ?? 0);
        const months = Math.floor(tenure.months ?? 0);
        return {
            steps,
            joined: { date: p.joiningDate, designation: first ? first.from.designation || p.designation : p.designation, type: first ? first.from.employmentType : p.employmentType, department: first ? first.from.department : p.department, gross: startGross },
            tenure: [years ? `${years} yr` : '', months || !years ? `${months} mo` : ''].filter(Boolean).join(' '),
            sinceLast: sorted[0] ? (DateTime.fromISO(sorted[0].date).toRelative({ style: 'short' }) ?? '') : '',
            growth: canSalary && startGross > 0 ? ((p.salary.gross - startGross) / startGross) * 100 : 0,
            startGross,
        };
    }

    historyDoc = (): ReportDoc => {
        const p = this.profile;
        const canSalary = this.access.can('users.view_salary');
        return {
            kind: 'table',
            title: `Promotion history of ${this.target()?.name ?? ''}`,
            subtitle: `${p?.designation ?? ''} · ${p?.employeeId ?? ''} · ${p?.promotions.length ?? 0} promotions`,
            columns: [{ header: 'Date' }, { header: 'From' }, { header: 'To' }, { header: 'Department' }, { header: 'Employment' }, { header: 'Approved by' }, ...(canSalary ? [{ header: 'Gross before', format: 'number' as const }, { header: 'Gross after', format: 'number' as const }] : [])],
            rows: (p?.promotions ?? []).map((h) => [
                DateTime.fromISO(h.date).toFormat('dd MMM y'), h.from.designation || 'New hire', h.to.designation, `${h.from.department} to ${h.to.department}`,
                `${h.from.employmentType} to ${h.to.employmentType}`, h.by, ...(canSalary ? [h.from.gross, h.to.gross] : []),
            ]),
        };
    };

    openHistory(user: AppUser): void {
        this.target.set(user);
        this._open('history');
    }

    openDelete(user: AppUser): void {
        this.target.set(user);
        this._open('delete');
    }

    close(): void {
        this.panel.set(null);
    }

    toggleRole(id: string, on: boolean): void {
        this.form.roleIds = on ? [...this.form.roleIds, id] : this.form.roleIds.filter((r) => r !== id);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Actions
    // -----------------------------------------------------------------------------------------------------

    save(): void {
        const t = this.target();
        const result = t ? this.users.update(t.id, this.form) : this.users.add(this.form);
        const error = typeof result === 'string' ? result : null;
        this._finish(error, t ? 'Employee updated.' : 'Employee added. Give more roles in the General info tab if needed.');
    }

    promote(): void {
        const t = this.target();
        if (t) {
            this._finish(this.users.promote(t.id, this.form), 'Employee promoted. See Promotion history.');
        }
    }

    remove(): void {
        const t = this.target();
        if (t) {
            this._finish(this.users.remove(t.id), `${t.name} deleted.`);
        }
    }

    refund(fund: 'security' | 'provident'): void {
        const t = this.target();
        if (!t) {
            return;
        }
        const error = this.users.refund(t.id, fund, Number(this.refundAmount[fund] ?? 0));
        this.error = error;
        if (!error) {
            this.refundAmount[fund] = null;
        }
    }

    private _open(panel: Panel): void {
        this.error = null;
        this.message.set(null);
        this.formTab.set('general');
        this.panel.set(panel);
    }

    private _finish(error: string | null, success: string): void {
        this.error = error;
        if (!error) {
            this.panel.set(null);
            this.message.set({ text: success, ok: true });
        }
    }

    private _blank(): EmployeeInput {
        return {
            firstName: '', lastName: '', email: '', phone: '', designation: '', joiningDate: new Date().toISOString().slice(0, 10),
            employmentType: 'Probation', department: DEPARTMENTS[0], workstation: '', orgCompanyId: '', orgBranchId: '', orgDeptId: '', orgTeamId: '', employeeId: '', shift: SHIFTS[0],
            salary: { ...BLANK_SALARY }, canGenerateIdCard: false, syncAppUser: true, active: true, roleIds: ['employee'],
        };
    }
}
