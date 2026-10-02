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
            { key: 'view', label: 'View', description: 'Open Configuration > Categories' },
            { key: 'add', label: 'Add', description: 'Create categories' },
            { key: 'edit', label: 'Edit', description: 'Rename categories' },
            { key: 'delete', label: 'Delete', description: 'Delete unused categories' },
        ],
    },
    {
        id: 'company',
        title: 'Company',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Configuration > Company and see the structure' },
            { key: 'create', label: 'Create', description: 'Add companies, branches, departments, teams and warehouses' },
            { key: 'edit', label: 'Edit', description: 'Edit, move, activate or deactivate units' },
            { key: 'delete', label: 'Delete', description: 'Delete empty companies and units' },
            { key: 'costs', label: 'View costs', description: 'See what each branch and department spent' },
        ],
    },
    {
        id: 'theme',
        title: 'Theme',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Configuration > Theme' },
            { key: 'edit', label: 'Edit', description: 'Save theme changes' },
        ],
    },
    {
        id: 'roles',
        title: 'Roles and permissions',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Configuration > Roles and permissions' },
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
        id: 'clients',
        title: 'Clients',
        permissions: [
            { key: 'view', label: 'View', description: "Open Clients. Without \"View all\", only the user's own client is shown" },
            { key: 'view_all', label: 'View all', description: 'See every client, project and document' },
            { key: 'add', label: 'Add', description: 'Create clients and projects' },
            { key: 'edit', label: 'Edit', description: 'Edit clients, post project updates and add company documents' },
            { key: 'delete', label: 'Delete', description: 'Delete clients and documents' },
            { key: 'assign_user', label: 'Assign user', description: 'Give a user login access to a client' },
            { key: 'share', label: 'Share', description: 'Share documents and projects by link or email' },
            { key: 'submit', label: 'Submit', description: 'Send requirements, purchase orders and other documents (client side)' },
        ],
    },
    {
        id: 'vendors',
        title: 'Vendors',
        permissions: [
            { key: 'view', label: 'View', description: "Open Vendors. Without \"View all\", only the user's own vendor is shown" },
            { key: 'view_all', label: 'View all', description: 'See every vendor, order, invoice and payment' },
            { key: 'add', label: 'Add', description: 'Create vendors' },
            { key: 'edit', label: 'Edit', description: 'Edit vendors and their product lists' },
            { key: 'delete', label: 'Delete', description: 'Delete vendors' },
            { key: 'assign_user', label: 'Assign user', description: 'Give a user login access to a vendor' },
            { key: 'create_po', label: 'Create purchase orders', description: 'Send purchase orders to product vendors' },
            { key: 'approve_invoice', label: 'Approve invoices', description: 'Approve or reject vendor invoices and answer due payment requests' },
            { key: 'approve_any', label: 'Approve any step', description: 'Approve vendor invoices at any step of the approval tree' },
            { key: 'pay', label: 'Record payments', description: 'Record payments made to vendors' },
            { key: 'submit', label: 'Submit', description: 'Submit invoices and due payment requests, and keep own product list (vendor side)' },
        ],
    },
    {
        id: 'projects',
        title: 'Projects',
        permissions: [
            { key: 'view', label: 'View', description: "Open Projects. Without \"View all\", a client sees their own and a manager sees the ones they manage" },
            { key: 'view_all', label: 'View all', description: 'See every project' },
            { key: 'add', label: 'Add', description: 'Create projects' },
            { key: 'edit', label: 'Edit', description: 'Edit projects, change progress and post updates' },
            { key: 'delete', label: 'Delete', description: 'Delete projects without costs' },
            { key: 'view_cost', label: 'View costing and profit', description: 'See budget use, costs and profit' },
        ],
    },
    {
        id: 'store',
        title: 'Store',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Store and see stock and the catalogue' },
            { key: 'catalog', label: 'Manage catalogue', description: 'Add stores and products, edit product details' },
            { key: 'receive', label: 'Receive stock', description: 'Receive items from expenses, vendor orders or by hand' },
            { key: 'issue', label: 'Issue stock', description: 'Take items out for a project or office use' },
            { key: 'transfer', label: 'Transfer', description: 'Move items between stores' },
            { key: 'adjust', label: 'Adjust counts', description: 'Correct stock after a physical count' },
            { key: 'cost', label: 'View cost', description: 'See unit costs and stock value' },
        ],
    },
    {
        id: 'users',
        title: 'Users',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Users: employees, admins, vendor and client logins' },
            { key: 'add', label: 'Add', description: 'Add employees and logins' },
            { key: 'edit', label: 'Edit', description: 'Edit people and switch them active or inactive' },
            { key: 'delete', label: 'Delete', description: 'Delete users' },
            { key: 'view_salary', label: 'View salary', description: 'See salary details and financial records' },
            { key: 'promote', label: 'Promote', description: 'Promote employees and change their salary structure' },
        ],
    },
    {
        id: 'expenses',
        title: 'Expenses',
        permissions: [
            { key: 'view', label: 'View', description: 'Open Expenses and see expenses you entered' },
            { key: 'view_all', label: 'View all', description: "See everyone's expenses" },
            { key: 'add', label: 'Add', description: 'Enter expenses' },
            { key: 'edit', label: 'Edit', description: 'Edit your own expenses that are waiting or were rejected' },
            { key: 'delete', label: 'Delete', description: 'Delete any unpaid expense' },
            { key: 'approve', label: 'Approve', description: "Approve or reject at the role's step in the approval tree" },
            { key: 'approve_any', label: 'Approve any step', description: 'Approve or reject at any step of the tree' },
            { key: 'pay', label: 'Record payments', description: 'Pay approved expenses, from a fund or otherwise' },
            { key: 'export', label: 'Export', description: 'Download and share expense reports' },
            { key: 'manage_categories', label: 'Expense settings', description: 'Change the no-approval limit. Categories are managed in Configuration > Categories' },
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
    /** Set for a client user: they only see this client's projects and documents. */
    clientId?: string | null;
    /** Set for a vendor user: they only see this vendor's orders, invoices and payments. */
    vendorId?: string | null;
    /** A customer login: someone who buys from us. It belongs to no client or vendor company. */
    customer?: boolean;
    address?: string;
    /** Profile details the person keeps up to date themselves. */
    phone?: string;
    /** Profile photo as a small data URL. Empty text means the photo was removed on purpose. */
    avatar?: string;
    /** Inactive people cannot be used to sign in. Missing means active. */
    active?: boolean;
    title?: string;
    about?: string;
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
