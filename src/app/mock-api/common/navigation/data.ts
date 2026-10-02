/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id   : 'dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/dashboard'
    },
    {
        id      : 'settings',
        title   : 'Configuration',
        type    : 'collapsable',
        icon    : 'heroicons_outline:adjustments-horizontal',
        children: [
            {
                id   : 'settings.company',
                title: 'Company',
                type : 'basic',
                link : '/settings/company'
            },
            {
                id   : 'settings.categories',
                title: 'Categories',
                type : 'basic',
                link : '/settings/categories'
            },
            {
                id   : 'settings.theme',
                title: 'Theme',
                type : 'basic',
                link : '/settings/theme'
            },
            {
                id   : 'settings.roles',
                title: 'Roles and permissions',
                type : 'basic',
                link : '/settings/roles'
            }
        ]
    },
    {
        id      : 'users',
        title   : 'Users',
        type    : 'collapsable',
        icon    : 'heroicons_outline:users',
        children: [
            { id: 'users.employees', title: 'Employees', type: 'basic', link: '/users/employees' },
            { id: 'users.admins', title: 'Admins', type: 'basic', link: '/users/admins' },
            { id: 'users.vendors', title: 'Vendors', type: 'basic', link: '/users/vendors' },
            { id: 'users.clients', title: 'Clients', type: 'basic', link: '/users/clients' },
            { id: 'users.customers', title: 'Customers', type: 'basic', link: '/users/customers' }
        ]
    },
    {
        id   : 'expenses',
        title: 'Expenses',
        type : 'basic',
        icon : 'heroicons_outline:receipt-percent',
        link : '/expenses'
    },
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'collapsable',
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
    },
    {
        id   : 'clients',
        title: 'Clients',
        type : 'basic',
        icon : 'heroicons_outline:user-group',
        link : '/clients'
    },
    {
        id   : 'vendors',
        title: 'Vendors',
        type : 'basic',
        icon : 'heroicons_outline:truck',
        link : '/vendors'
    },
    {
        id   : 'projects',
        title: 'Projects',
        type : 'basic',
        icon : 'heroicons_outline:briefcase',
        link : '/projects'
    },
    {
        id   : 'store',
        title: 'Store',
        type : 'basic',
        icon : 'heroicons_outline:archive-box',
        link : '/store'
    },
    {
        id   : 'help',
        title: 'Help',
        type : 'basic',
        icon : 'heroicons_outline:question-mark-circle',
        link : '/help'
    }
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
