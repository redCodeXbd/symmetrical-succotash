export interface PermissionDef {
    /** Short key within the feature, such as "view" or "approve". */
    key: string;
    label: string;
    description: string;
}

export interface FeatureDef {
    id: string;
    title: string;
    permissions: PermissionDef[];
}

/**
 * Everything a role can be allowed to do. A permission id is "<feature>.<key>", for example
 * "fund-requests.approve". Only permissions the app actually enforces are listed here.
 * To protect a new feature, add it here and check `AccessService.can()` where it is used.
 */
export const FEATURES: FeatureDef[] = [
    {
        id: 'fund-requests',
        title: 'Fund requests',
        permissions: [
            { key: 'view', label: 'View', description: 'Open the Funds page and see own requests' },
            { key: 'view_all', label: 'View all', description: "See every employee's requests" },
            { key: 'add', label: 'Add', description: 'Submit new fund requests' },
            { key: 'edit', label: 'Edit', description: 'Edit or cancel own pending requests' },
            { key: 'approve', label: 'Approve', description: 'Approve or reject at the role\'s step in the approval tree' },
            { key: 'approve_any', label: 'Approve any step', description: 'Approve or reject at any step of the tree' },
            { key: 'pay', label: 'Record payment', description: 'Record payments against approved requests' },
            { key: 'close', label: 'Close own', description: 'Close own partly paid requests' },
            { key: 'close_any', label: 'Close any', description: "Close anyone's partly paid request" },
            { key: 'return', label: 'Return funds', description: 'Give unused money back' },
            { key: 'confirm_return', label: 'Confirm returns', description: 'Confirm or reject returned money' },
            { key: 'export', label: 'Export', description: 'Download and share request reports' },
        ],
    },
    {
        id: 'org-funds',
        title: 'Organization funds',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Organization Funds' },
            { key: 'add', label: 'Add', description: 'Create new funds' },
            { key: 'export', label: 'Export', description: 'Download and share fund reports' },
        ],
    },
    {
        id: 'transactions',
        title: 'Transactions',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Transactions and see own records' },
            { key: 'view_all', label: 'View all', description: "See every employee's transactions and actions" },
            { key: 'view_movements', label: 'View treasury movements', description: 'See every deposit, transfer and disbursement' },
            { key: 'export', label: 'Export', description: 'Download and share transaction reports' },
        ],
    },
    {
        id: 'categories',
        title: 'Categories',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Settings > Categories' },
            { key: 'add', label: 'Add', description: 'Create categories' },
            { key: 'edit', label: 'Edit', description: 'Rename categories' },
            { key: 'delete', label: 'Delete', description: 'Delete unused categories' },
        ],
    },
    {
        id: 'theme',
        title: 'Theme',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Settings > Theme' },
            { key: 'edit', label: 'Edit', description: 'Save theme changes' },
        ],
    },
    {
        id: 'roles',
        title: 'Roles and permissions',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Settings > Roles and permissions' },
            { key: 'add', label: 'Add', description: 'Create roles' },
            { key: 'edit', label: 'Edit', description: 'Rename roles and change what they can do' },
            { key: 'delete', label: 'Delete', description: 'Delete unused roles' },
            { key: 'assign', label: 'Assign', description: 'Give roles to employees' },
        ],
    },
    {
        id: 'approvals',
        title: 'Approval tree',
        permissions: [
            { key: 'view', label: 'View', description: 'See who approves what' },
            { key: 'edit', label: 'Edit', description: 'Change the approval tree' },
        ],
    },
    {
        id: 'notifications',
        title: 'Notifications',
        permissions: [
            { key: 'view_all', label: 'All actions', description: 'Be notified of every action' },
            { key: 'view_employee', label: 'Employee actions', description: 'Be notified of actions employees take' },
        ],
    },
];

export const ALL_PERMISSIONS: string[] = FEATURES.flatMap((f) => f.permissions.map((p) => `${f.id}.${p.key}`));

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    /** The built-in administrator role. It always has every permission and cannot be edited or deleted. */
    locked: boolean;
}

export interface AppUser {
    id: string;
    name: string;
    email: string;
    /** An employee can hold several roles; their permissions add together. */
    roleIds: string[];
}

/**
 * One branch of the approval tree: requests from `minAmount` up (until the next rule) go through
 * these roles in order. Every request starts at the first step.
 */
export interface ApprovalRule {
    id: string;
    minAmount: number;
    steps: string[];
}

export type ApprovalStepStatus = 'waiting' | 'pending' | 'approved' | 'rejected';

/** A request's own copy of its approval path, fixed when it was submitted. */
export interface ApprovalStep {
    roleId: string;
    roleName: string;
    status: ApprovalStepStatus;
    by: string | null;
    at: string | null;
}
