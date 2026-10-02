import { Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { AppUser } from 'app/core/access/access.types';
import { FundsService } from '../treasury/funds/funds.service';
import { SEED_DEPARTMENT_IDS } from '../settings/company/company.types';
import { BLANK_SALARY, EmployeeProfile, SalaryStructure } from './users.types';

export interface EmployeeInput {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    designation: string;
    joiningDate: string;
    employmentType: EmployeeProfile['employmentType'];
    department: string;
    workstation: string;
    orgCompanyId: string;
    orgBranchId: string;
    orgDeptId: string;
    orgTeamId: string;
    employeeId: string;
    shift: string;
    salary: SalaryStructure;
    canGenerateIdCard: boolean;
    syncAppUser: boolean;
    active: boolean;
    roleIds: string[];
}

/**
 * HR details of staff (designation, salary, funds, promotions) kept next to the sign-in users in AccessService.
 * In memory for now. Each method returns an error message, or null on success.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
    private _profiles = signal<EmployeeProfile[]>(this._seed());

    constructor(
        private _access: AccessService,
        private _funds: FundsService
    ) {}

    /** Staff: everyone who is not a client or vendor login. */
    readonly staff = () => this._access.users().filter((u) => !u.clientId && !u.vendorId && !u.customer);

    profile(userId: string): EmployeeProfile {
        const found = this._profiles().find((p) => p.userId === userId);
        if (found) {
            return found;
        }
        const user = this._access.users().find((u) => u.id === userId);
        const [first, ...rest] = (user?.name ?? '').split(' ');
        return this._blank(userId, first ?? '', rest.join(' '));
    }

    /** A name used on fund requests cannot change, or the requests would lose their owner. */
    nameLocked(userId: string): boolean {
        const name = this._access.users().find((u) => u.id === userId)?.name;
        return !!name && this._funds.requests().some((r) => r.employee === name);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Employees
    // -----------------------------------------------------------------------------------------------------

    add(input: EmployeeInput): string | { id: string } {
        if (!this._access.can('users.add')) {
            return 'You do not have permission to add employees.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
        const added = this._access.addUser(name, input.email);
        if (added) {
            return added;
        }
        const user = this._access.users()[this._access.users().length - 1];
        this._access.updateUser(user.id, { phone: input.phone, active: input.active });
        this._finishRoles(user.id, input.roleIds);
        this._profiles.update((list) => [...list, this._fromInput(user.id, input, this._blank(user.id, '', ''))]);
        return { id: user.id };
    }

    update(userId: string, input: EmployeeInput): string | null {
        if (!this._access.can('users.edit')) {
            return 'You do not have permission to edit employees.';
        }
        const error = this._validate(input, userId);
        if (error) {
            return error;
        }
        const user = this._access.users().find((u) => u.id === userId);
        const name = this.nameLocked(userId) && user ? user.name : `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
        const result = this._access.updateUser(userId, { name, email: input.email, phone: input.phone, active: input.active });
        if (result) {
            return result;
        }
        if (this._access.can('roles.assign')) {
            const roleError = this._access.setUserRoles(userId, input.roleIds);
            if (roleError) {
                return roleError;
            }
        }
        const existing = this.profile(userId);
        const canSalary = this._access.can('users.view_salary');
        const next = this._fromInput(userId, canSalary ? input : { ...input, salary: existing.salary }, existing);
        this._profiles.update((list) => (list.some((p) => p.userId === userId) ? list.map((p) => (p.userId === userId ? next : p)) : [...list, next]));
        return null;
    }

    remove(userId: string): string | null {
        if (!this._access.can('users.delete')) {
            return 'You do not have permission to delete users.';
        }
        const error = this._access.removeUser(userId);
        if (!error) {
            this._profiles.update((list) => list.filter((p) => p.userId !== userId));
        }
        return error;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Promotions and funds
    // -----------------------------------------------------------------------------------------------------

    promote(
        userId: string,
        to: { designation: string; employmentType: EmployeeProfile['employmentType']; department: string; workstation: string; shift: string; salary: SalaryStructure }
    ): string | null {
        if (!this._access.can('users.promote')) {
            return 'You do not have permission to promote employees.';
        }
        if (!to.designation.trim() || !to.department) {
            return 'Designation and department are required.';
        }
        const current = this.profile(userId);
        if (to.salary.gross < 0 || to.salary.basic > to.salary.gross) {
            return 'Basic salary cannot be more than gross salary.';
        }
        const record = {
            id: `PM-${Date.now()}`,
            date: DateTime.now().toISO(),
            by: this._access.user().name,
            from: { designation: current.designation, employmentType: current.employmentType, department: current.department, gross: current.salary.gross },
            to: { designation: to.designation.trim(), employmentType: to.employmentType, department: to.department, gross: to.salary.gross },
        };
        const next: EmployeeProfile = {
            ...current,
            designation: to.designation.trim(),
            employmentType: to.employmentType,
            department: to.department,
            workstation: to.workstation.trim(),
            shift: to.shift,
            salary: to.salary,
            promotions: [record, ...current.promotions],
        };
        this._profiles.update((list) => (list.some((p) => p.userId === userId) ? list.map((p) => (p.userId === userId ? next : p)) : [...list, next]));
        return null;
    }

    /** Pays back part of a fund balance to the employee. */
    refund(userId: string, fund: 'security' | 'provident', amount: number): string | null {
        if (!this._access.can('users.promote') && !this._access.can('users.edit')) {
            return 'You do not have permission to refund balances.';
        }
        const current = this.profile(userId);
        const balance = fund === 'security' ? current.funds.securityBalance : current.funds.providentBalance;
        if (!(amount > 0)) {
            return 'Enter an amount above zero.';
        }
        if (amount > balance) {
            return `The balance is only BDT ${balance.toLocaleString('en-US')}.`;
        }
        const funds = {
            ...current.funds,
            ...(fund === 'security'
                ? { securityBalance: balance - amount, securityWithdrawn: current.funds.securityWithdrawn + amount }
                : { providentBalance: balance - amount, providentWithdrawn: current.funds.providentWithdrawn + amount }),
        };
        const next = { ...current, funds };
        this._profiles.update((list) => (list.some((p) => p.userId === userId) ? list.map((p) => (p.userId === userId ? next : p)) : [...list, next]));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _finishRoles(userId: string, roleIds: string[]): void {
        if (this._access.can('roles.assign') && roleIds.length > 0) {
            this._access.setUserRoles(userId, roleIds);
        }
    }

    private _validate(input: EmployeeInput, ignoreId?: string): string | null {
        if (!input.firstName.trim() || !input.lastName.trim()) {
            return 'Enter the first and last name.';
        }
        if (!input.phone.trim()) {
            return 'Enter the phone number.';
        }
        if (!input.designation.trim()) {
            return 'Enter the designation.';
        }
        if (!input.employeeId.trim()) {
            return 'Enter the employee ID.';
        }
        if (this._profiles().some((p) => p.userId !== ignoreId && p.employeeId.toLowerCase() === input.employeeId.trim().toLowerCase())) {
            return 'Another employee already has this ID.';
        }
        if (input.salary.basic > input.salary.gross) {
            return 'Basic salary cannot be more than gross salary.';
        }
        return null;
    }

    private _fromInput(userId: string, i: EmployeeInput, base: EmployeeProfile): EmployeeProfile {
        const user = this._access.users().find((u) => u.id === userId);
        const [first, ...rest] = (user?.name ?? '').split(' ');
        const locked = user ? this.nameLocked(userId) : false;
        return {
            ...base,
            userId,
            firstName: locked ? first : i.firstName.trim(),
            lastName: locked ? rest.join(' ') : i.lastName.trim(),
            designation: i.designation.trim(),
            joiningDate: i.joiningDate,
            employmentType: i.employmentType,
            department: i.department,
            workstation: i.workstation.trim(),
            orgCompanyId: i.orgCompanyId,
            orgBranchId: i.orgBranchId,
            orgDeptId: i.orgDeptId,
            orgTeamId: i.orgTeamId,
            employeeId: i.employeeId.trim(),
            shift: i.shift,
            salary: { ...i.salary },
            canGenerateIdCard: i.canGenerateIdCard,
            syncAppUser: i.syncAppUser,
        };
    }

    private _blank(userId: string, firstName: string, lastName: string): EmployeeProfile {
        return {
            userId, firstName, lastName, designation: '', joiningDate: DateTime.now().toISODate(), employmentType: 'Probation',
            department: 'Service Team', workstation: '', orgCompanyId: '', orgBranchId: '', orgDeptId: '', orgTeamId: '', employeeId: '', shift: 'Head Office Shift', salary: { ...BLANK_SALARY },
            canGenerateIdCard: false, syncAppUser: true,
            funds: { totalSalary: 0, totalBonus: 0, securityBalance: 0, securityWithdrawn: 0, providentBalance: 0, providentWithdrawn: 0 },
            promotions: [],
        };
    }

    private _seed(): EmployeeProfile[] {
        const days = (n: number) => DateTime.now().minus({ days: n }).toISODate();
        const p = (
            userId: string, first: string, last: string, designation: string, joined: number, type: EmployeeProfile['employmentType'],
            department: string, workstation: string, employeeId: string, gross: number, extra: Partial<EmployeeProfile> = {}
        ): EmployeeProfile => ({
            ...this._blank(userId, first, last),
            orgCompanyId: 'C-1', orgBranchId: 'U-1', orgDeptId: SEED_DEPARTMENT_IDS[department] ?? '',
            designation, joiningDate: days(joined), employmentType: type, department, workstation, employeeId,
            shift: 'Head Office Shift',
            salary: {
                gross, basic: Math.round(gross * 0.55), houseRent: Math.round(gross * 0.25), conveyance: Math.round(gross * 0.05),
                medical: Math.round(gross * 0.05), tada: Math.round(gross * 0.04), mobile: Math.round(gross * 0.02),
                providentFund: Math.round(gross * 0.03), securityFund: Math.round(gross * 0.02), taxApplicable: gross > 60000, overtimeCountable: gross < 40000,
            },
            canGenerateIdCard: true,
            funds: { totalSalary: gross * 4, totalBonus: Math.round(gross * 0.5), securityBalance: Math.round(gross * 0.08), securityWithdrawn: 0, providentBalance: Math.round(gross * 0.12), providentWithdrawn: 0 },
            ...extra,
        });
        return [
            p('u-brian', 'Brian', 'Hughes', 'Managing Director', 900, 'Permanent', 'Encore Admin', 'Head Office', 'E-1001', 180000),
            p('u-nadia', 'Nadia', 'Rahman', 'Senior Accountant', 520, 'Permanent', 'Accounts', 'Head Office', 'E-1002', 85000),
            p('u-sara', 'Sara', 'Khan', 'Project Manager', 410, 'Permanent', 'Operations', 'Chattogram Branch', 'E-1003', 110000),
            p('u-imran', 'Imran', 'Hossain', 'Data Entry Executive', 120, 'Probation', 'Encore Admin', 'Head Office', 'E-1004', 32000),
            p('u-mehedi', 'Mehedi', 'Hasan', 'Technician', 300, 'Permanent', 'Service Team', 'Dhaka Site', 'E-1005', 38000),
            p('u-rahim', 'Rahim', 'Ahmed', 'Sales Executive', 200, 'Contract', 'Sales', 'Head Office', 'E-1006', 52000, {
                promotions: [{
                    id: 'PM-1', date: DateTime.now().minus({ days: 60 }).toISO(), by: 'Brian Hughes',
                    from: { designation: 'Sales Officer', employmentType: 'Probation', department: 'Sales', gross: 42000 },
                    to: { designation: 'Sales Executive', employmentType: 'Contract', department: 'Sales', gross: 52000 },
                }],
            }),
        ];
    }
}
