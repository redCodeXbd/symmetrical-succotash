export type EmploymentType = 'Permanent' | 'Probation' | 'Contract' | 'Intern';

export const EMPLOYMENT_TYPES: EmploymentType[] = ['Permanent', 'Probation', 'Contract', 'Intern'];
export const DEPARTMENTS = ['Service Team', 'Encore Admin', 'Procurement', 'Sales', 'Operations', 'Accounts'];
export const SHIFTS = ['Head Office Shift', 'Dhamrai Office Shift', 'Site Shift'];

export interface SalaryStructure {
    gross: number;
    basic: number;
    houseRent: number;
    conveyance: number;
    medical: number;
    tada: number;
    mobile: number;
    providentFund: number;
    securityFund: number;
    taxApplicable: boolean;
    overtimeCountable: boolean;
}

export const SALARY_FIELDS: { key: keyof Omit<SalaryStructure, 'taxApplicable' | 'overtimeCountable'>; label: string }[] = [
    { key: 'gross', label: 'Gross salary' },
    { key: 'basic', label: 'Basic salary' },
    { key: 'houseRent', label: 'House rent' },
    { key: 'conveyance', label: 'Conveyance' },
    { key: 'medical', label: 'Medical' },
    { key: 'tada', label: 'TA/DA' },
    { key: 'mobile', label: 'Mobile allowance' },
    { key: 'providentFund', label: 'Provident fund' },
    { key: 'securityFund', label: 'Security fund' },
];

export interface Promotion {
    id: string;
    date: string;
    by: string;
    from: { designation: string; employmentType: EmploymentType; department: string; gross: number };
    to: { designation: string; employmentType: EmploymentType; department: string; gross: number };
}

export interface EmployeeFunds {
    totalSalary: number;
    totalBonus: number;
    securityBalance: number;
    securityWithdrawn: number;
    providentBalance: number;
    providentWithdrawn: number;
}

/** HR details of a staff user. The sign-in side (name, email, roles) lives in the user record. */
export interface EmployeeProfile {
    userId: string;
    firstName: string;
    lastName: string;
    designation: string;
    joiningDate: string;
    employmentType: EmploymentType;
    department: string;
    workstation: string;
    employeeId: string;
    shift: string;
    salary: SalaryStructure;
    canGenerateIdCard: boolean;
    /** Whether the person's app login is switched on. */
    syncAppUser: boolean;
    funds: EmployeeFunds;
    promotions: Promotion[];
}

export const BLANK_SALARY: SalaryStructure = {
    gross: 0, basic: 0, houseRent: 0, conveyance: 0, medical: 0, tada: 0, mobile: 0, providentFund: 0, securityFund: 0,
    taxApplicable: false, overtimeCountable: false,
};
