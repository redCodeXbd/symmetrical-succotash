/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id      : 'settings',
        title   : 'Configuration',
        type    : 'collapsable',
        icon    : 'heroicons_outline:adjustments-horizontal',
        children: [
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
        id   : 'dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/dashboard'
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
