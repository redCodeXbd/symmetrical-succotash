/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'collapsable',
        icon    : 'heroicons_outline:banknotes',
        children: [
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            }
        ]
    }
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'aside',
        icon    : 'heroicons_outline:banknotes',
        children: [
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            }
        ]
    }
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'group',
        icon    : 'heroicons_outline:banknotes',
        children: [
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            }
        ]
    }
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id      : 'treasury',
        title   : 'Treasury',
        type    : 'group',
        icon    : 'heroicons_outline:banknotes',
        children: [
            {
                id   : 'treasury.funds',
                title: 'Funds',
                type : 'basic',
                link : '/treasury/funds'
            }
        ]
    }
];
