import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AccessService } from 'app/core/access/access.service';
import { AppUser } from 'app/core/access/access.types';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { EmployeeInput, UsersService } from './users.service';
import { BLANK_SALARY, DEPARTMENTS, EMPLOYMENT_TYPES, EmployeeProfile, SALARY_FIELDS, SHIFTS } from './users.types';

type Panel = 'form' | 'financial' | 'promote' | 'history' | 'delete';
type FormTab = 'general' | 'office' | 'salary';

@Component({
    selector: 'users-employees',
    templateUrl: './employees.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatIconModule, MatMenuModule, AddButtonComponent, SlideOverComponent, UserSwitchComponent],
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
        public access: AccessService
    ) {}

    get profile(): EmployeeProfile | null {
        const t = this.target();
        return t ? this.users.profile(t.id) : null;
    }

    get nameLocked(): boolean {
        const t = this.target();
        return !!t && this.users.nameLocked(t.id);
    }

    get tabs(): { id: FormTab; label: string }[] {
        const tabs: { id: FormTab; label: string }[] = [
            { id: 'general', label: 'General info' },
            { id: 'office', label: 'Office info' },
        ];
        if (this.access.can('users.view_salary')) {
            tabs.push({ id: 'salary', label: 'Salary info' });
        }
        return tabs;
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
            joiningDate: p.joiningDate.slice(0, 10), employmentType: p.employmentType, department: p.department, workstation: p.workstation,
            employeeId: p.employeeId, shift: p.shift, salary: { ...p.salary }, canGenerateIdCard: p.canGenerateIdCard, syncAppUser: p.syncAppUser,
            active: user.active !== false, roleIds: [...user.roleIds],
        };
        this.password = '';
        this._open('form');
    }

    openFinancial(user: AppUser): void {
        this.target.set(user);
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

    toggleRole(id: string, event: Event): void {
        const on = (event.target as HTMLInputElement).checked;
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
            employmentType: 'Probation', department: DEPARTMENTS[0], workstation: '', employeeId: '', shift: SHIFTS[0],
            salary: { ...BLANK_SALARY }, canGenerateIdCard: false, syncAppUser: true, active: true, roleIds: ['employee'],
        };
    }
}
