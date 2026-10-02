export type UnitKind = 'branch' | 'department' | 'team';

export interface Company {
    id: string;
    code: string;
    name: string;
    legalName: string;
    tradeLicense: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    /** Month the fiscal year starts, 1 to 12. */
    fiscalStartMonth: number;
    active: boolean;
}

export type CompanyInput = Omit<Company, 'id'>;

/** A branch, department or team. Branches sit under a company, departments under a branch, teams under a department. */
export interface OrgUnit {
    id: string;
    companyId: string;
    kind: UnitKind;
    parentId: string | null;
    code: string;
    name: string;
    managerId: string | null;
    address: string;
    notes: string;
    active: boolean;
}

export type UnitInput = Omit<OrgUnit, 'id'>;

export const KIND_LABEL: Record<UnitKind, string> = { branch: 'Branch', department: 'Department', team: 'Team' };
export const CHILD_KIND: Record<UnitKind, UnitKind | null> = { branch: 'department', department: 'team', team: null };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'AED'];

/** Seeded departments of the head office, matched to the free-text department of the seeded employees. */
export const SEED_DEPARTMENT_IDS: Record<string, string> = {
    'Service Team': 'U-3',
    'Encore Admin': 'U-4',
    Procurement: 'U-5',
    Sales: 'U-6',
    Operations: 'U-7',
    Accounts: 'U-8',
};
