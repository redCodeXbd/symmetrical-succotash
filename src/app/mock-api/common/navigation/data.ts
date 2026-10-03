/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

/* Three levels: a menu, the pages or groups under it, and the views, filters and actions of each page. */
/**
 * A page without options matches only the bare address, so it is not lit on every filtered view of the page;
 * a page with options matches when those options are in the address.
 */
const leaf = (id: string, title: string, link: string, queryParams?: Record<string, string>): FuseNavigationItem => ({
    id,
    title,
    type: 'basic',
    link,
    exactMatch: !queryParams,
    ...(queryParams ? { queryParams } : {})
});
const group = (id: string, title: string, icon: string, children: FuseNavigationItem[]): FuseNavigationItem => ({
    id,
    title,
    type: 'collapsable',
    icon,
    children
});

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id   : 'dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/dashboard'
    },
    group('settings', 'Configuration', 'heroicons_outline:adjustments-horizontal', [
        group('settings.company', 'Company', 'heroicons_outline:building-office-2', [
            leaf('settings.company.all', 'All companies', '/settings/company'),
            leaf('settings.company.add', 'Add company', '/settings/company', { action: 'add' })
        ]),
        group('settings.categories', 'Categories', 'heroicons_outline:tag', [
            leaf('settings.categories.org-funds', 'Organization funds', '/settings/categories', { section: 'org-funds' }),
            leaf('settings.categories.store-items', 'Store items', '/settings/categories', { section: 'store-items' }),
            leaf('settings.categories.expenses', 'Expense categories', '/settings/categories', { section: 'expense-types' })
        ]),
        group('settings.theme', 'Theme', 'heroicons_outline:swatch', [
            leaf('settings.theme.presets', 'Presets', '/settings/theme', { section: 'presets' }),
            leaf('settings.theme.company', 'Logo and company', '/settings/theme', { section: 'company' }),
            leaf('settings.theme.colors', 'Colours', '/settings/theme', { section: 'colors' }),
            leaf('settings.theme.tables', 'Tables', '/settings/theme', { section: 'tables' })
        ]),
        group('settings.roles', 'Roles and permissions', 'heroicons_outline:shield-check', [
            leaf('settings.roles.roles', 'Roles', '/settings/roles', { tab: 'roles' }),
            leaf('settings.roles.permissions', 'Permissions', '/settings/roles', { tab: 'permissions' }),
            leaf('settings.roles.people', 'People and their roles', '/settings/roles', { tab: 'employees' }),
            leaf('settings.roles.approvals', 'Approval tree', '/settings/roles', { tab: 'approvals' })
        ])
    ]),
    group('users', 'Users', 'heroicons_outline:users', [
        group('users.employees', 'Employees', 'heroicons_outline:identification', [
            leaf('users.employees.all', 'All employees', '/users/employees'),
            leaf('users.employees.add', 'Add employee', '/users/employees', { action: 'add' })
        ]),
        { id: 'users.admins', title: 'Admins', type: 'basic', icon: 'heroicons_outline:shield-exclamation', link: '/users/admins', exactMatch: true },
        group('users.vendors', 'Vendor logins', 'heroicons_outline:truck', [
            leaf('users.vendors.all', 'All vendor logins', '/users/vendors'),
            leaf('users.vendors.add', 'Add vendor login', '/users/vendors', { action: 'add' })
        ]),
        group('users.clients', 'Client logins', 'heroicons_outline:user-group', [
            leaf('users.clients.all', 'All client logins', '/users/clients'),
            leaf('users.clients.add', 'Add client login', '/users/clients', { action: 'add' })
        ]),
        group('users.customers', 'Customers', 'heroicons_outline:shopping-bag', [
            leaf('users.customers.all', 'All customers', '/users/customers'),
            leaf('users.customers.add', 'Add customer', '/users/customers', { action: 'add' })
        ])
    ]),
    group('expenses', 'Expenses', 'heroicons_outline:receipt-percent', [
        group('expenses.enter', 'Enter', 'heroicons_outline:pencil-square', [
            leaf('expenses.enter.quick', 'Quick entry', '/expenses', { action: 'quick' }),
            leaf('expenses.enter.add', 'Add expense', '/expenses', { action: 'add' })
        ]),
        group('expenses.review', 'Review', 'heroicons_outline:clipboard-document-check', [
            leaf('expenses.review.all', 'All expenses', '/expenses'),
            leaf('expenses.review.pending', 'Waiting for approval', '/expenses', { status: 'pending' }),
            leaf('expenses.review.unpaid', 'Approved, not paid', '/expenses', { status: 'unpaid' }),
            leaf('expenses.review.approved', 'Approved', '/expenses', { status: 'approved' }),
            leaf('expenses.review.rejected', 'Rejected', '/expenses', { status: 'rejected' })
        ]),
        group('expenses.reports', 'By period', 'heroicons_outline:calendar-days', [
            leaf('expenses.reports.month', 'This month', '/expenses', { range: 'this_month' }),
            leaf('expenses.reports.30', 'Last 30 days', '/expenses', { range: 'last_30' }),
            leaf('expenses.reports.year', 'This year', '/expenses', { range: 'this_year' }),
            leaf('expenses.reports.all', 'All time', '/expenses', { range: 'all' })
        ]),
        { id: 'expenses.settings', title: 'Expense settings', type: 'basic', icon: 'heroicons_outline:cog-6-tooth', link: '/expenses', queryParams: { action: 'settings' } }
    ]),
    group('treasury', 'Treasury', 'heroicons_outline:wallet', [
        group('treasury.organization-funds', 'Organization Funds', 'heroicons_outline:building-library', [
            leaf('treasury.organization-funds.overview', 'Funds overview', '/treasury/organization-funds'),
            leaf('treasury.organization-funds.add', 'Add fund', '/treasury/organization-funds', { action: 'add' })
        ]),
        group('treasury.funds', 'Funds', 'heroicons_outline:banknotes', [
            leaf('treasury.funds.new', 'Request funds', '/treasury/funds', { action: 'new' }),
            leaf('treasury.funds.all', 'All requests', '/treasury/funds'),
            leaf('treasury.funds.pending', 'Awaiting approval', '/treasury/funds', { status: 'pending' }),
            leaf('treasury.funds.approved', 'Awaiting payment', '/treasury/funds', { status: 'approved' }),
            leaf('treasury.funds.partial', 'Partly paid', '/treasury/funds', { status: 'partially_paid' })
        ]),
        group('treasury.transactions', 'Transactions', 'heroicons_outline:arrows-right-left', [
            leaf('treasury.transactions.payments', 'Payments', '/treasury/transactions', { tab: 'payments' }),
            leaf('treasury.transactions.returns', 'Returns', '/treasury/transactions', { tab: 'returns' }),
            leaf('treasury.transactions.actions', 'Actions', '/treasury/transactions', { tab: 'actions' }),
            leaf('treasury.transactions.movements', 'Treasury movements', '/treasury/transactions', { tab: 'movements' })
        ])
    ]),
    group('clients', 'Clients', 'heroicons_outline:user-group', [
        group('clients.directory', 'Directory', 'heroicons_outline:book-open', [
            leaf('clients.directory.all', 'All clients', '/clients'),
            leaf('clients.directory.active', 'Active clients', '/clients', { status: 'active' }),
            leaf('clients.directory.inactive', 'Inactive clients', '/clients', { status: 'inactive' })
        ]),
        group('clients.new', 'Create', 'heroicons_outline:plus-circle', [
            leaf('clients.new.client', 'Add client', '/clients', { action: 'add' }),
            leaf('clients.new.login', 'Add client login', '/users/clients', { action: 'add' })
        ])
    ]),
    group('vendors', 'Vendors', 'heroicons_outline:truck', [
        group('vendors.directory', 'Directory', 'heroicons_outline:book-open', [
            leaf('vendors.directory.all', 'All vendors', '/vendors'),
            leaf('vendors.directory.product', 'Product vendors', '/vendors', { type: 'product' }),
            leaf('vendors.directory.service', 'Service vendors', '/vendors', { type: 'service' }),
            leaf('vendors.directory.other', 'Other vendors', '/vendors', { type: 'other' })
        ]),
        group('vendors.new', 'Create', 'heroicons_outline:plus-circle', [
            leaf('vendors.new.vendor', 'Add vendor', '/vendors', { action: 'add' }),
            leaf('vendors.new.login', 'Add vendor login', '/users/vendors', { action: 'add' })
        ])
    ]),
    group('projects', 'Projects', 'heroicons_outline:briefcase', [
        group('projects.status', 'By status', 'heroicons_outline:funnel', [
            leaf('projects.status.all', 'All projects', '/projects'),
            leaf('projects.status.planning', 'Planning', '/projects', { status: 'planning' }),
            leaf('projects.status.progress', 'In progress', '/projects', { status: 'in_progress' }),
            leaf('projects.status.hold', 'On hold', '/projects', { status: 'on_hold' }),
            leaf('projects.status.delivered', 'Delivered', '/projects', { status: 'delivered' })
        ]),
        group('projects.new', 'Create', 'heroicons_outline:plus-circle', [
            leaf('projects.new.project', 'Add project', '/projects', { action: 'add' })
        ])
    ]),
    group('store', 'Store', 'heroicons_outline:archive-box', [
        group('store.stock', 'Stock', 'heroicons_outline:cube', [
            leaf('store.stock.levels', 'Stock levels', '/store', { tab: 'stock' }),
            leaf('store.stock.movements', 'Movements', '/store', { tab: 'movements' }),
            leaf('store.stock.purchases', 'Purchases', '/store', { tab: 'purchases' })
        ]),
        group('store.catalogue', 'Catalogue', 'heroicons_outline:rectangle-stack', [
            leaf('store.catalogue.products', 'Products', '/store', { tab: 'catalogue' }),
            leaf('store.catalogue.product', 'Add product', '/store', { action: 'product' }),
            leaf('store.catalogue.store', 'Add store', '/store', { action: 'store' })
        ]),
        group('store.actions', 'Actions', 'heroicons_outline:arrows-up-down', [
            leaf('store.actions.receive', 'Receive stock', '/store', { action: 'receive' }),
            leaf('store.actions.issue', 'Issue stock', '/store', { action: 'issue' }),
            leaf('store.actions.transfer', 'Transfer stock', '/store', { action: 'transfer' }),
            leaf('store.actions.count', 'Stock count', '/store', { action: 'count' })
        ])
    ]),
    group('help', 'Help', 'heroicons_outline:question-mark-circle', [
        group('help.guides', 'Guides', 'heroicons_outline:book-open', [
            leaf('help.guides.all', 'All guides', '/help'),
            leaf('help.guides.start', 'Getting started', '/help', { feature: 'Getting started' }),
            leaf('help.guides.treasury', 'Treasury guides', '/help', { feature: 'Treasury' }),
            leaf('help.guides.expenses', 'Expense guides', '/help', { feature: 'Expenses' }),
            leaf('help.guides.store', 'Store guides', '/help', { feature: 'Store' })
        ]),
        group('help.roles', 'By role', 'heroicons_outline:user-circle', [
            leaf('help.roles.employee', 'For employees', '/help', { audience: 'employee' }),
            leaf('help.roles.data-entry', 'For data entry', '/help', { audience: 'data-entry' }),
            leaf('help.roles.accountant', 'For accountants', '/help', { audience: 'accountant' }),
            leaf('help.roles.manager', 'For managers', '/help', { audience: 'manager' }),
            leaf('help.roles.admin', 'For admins', '/help', { audience: 'admin' }),
            leaf('help.roles.client', 'For clients', '/help', { audience: 'client' }),
            leaf('help.roles.vendor', 'For vendors', '/help', { audience: 'vendor' })
        ])
    ])
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'aside',
        icon    : 'heroicons_outline:wallet',
        children: [
            {
                id   : 'treasury.organization-funds',
                title: 'Organization Funds',
                type : 'basic',
                link : '/treasury/organization-funds'
            },
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            },
            {
                id   : 'treasury.transactions',
                title: 'Transactions',
                type : 'basic',
                link : '/treasury/transactions'
            }
        ]
    }
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'group',
        icon    : 'heroicons_outline:wallet',
        children: [
            {
                id   : 'treasury.organization-funds',
                title: 'Organization Funds',
                type : 'basic',
                link : '/treasury/organization-funds'
            },
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            },
            {
                id   : 'treasury.transactions',
                title: 'Transactions',
                type : 'basic',
                link : '/treasury/transactions'
            }
        ]
    }
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'group',
        icon    : 'heroicons_outline:wallet',
        children: [
            {
                id   : 'treasury.organization-funds',
                title: 'Organization Funds',
                type : 'basic',
                link : '/treasury/organization-funds'
            },
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            },
            {
                id   : 'treasury.transactions',
                title: 'Transactions',
                type : 'basic',
                link : '/treasury/transactions'
            }
        ]
    }
];
