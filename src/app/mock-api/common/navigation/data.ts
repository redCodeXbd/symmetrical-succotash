/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
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
        id      : 'settings',
        title   : 'Settings',
        type    : 'collapsable',
        icon    : 'heroicons_outline:adjustments-horizontal',
        children: [
            {
                id   : 'settings.theme',
                title: 'Theme',
                type : 'basic',
                link : '/settings/theme'
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
