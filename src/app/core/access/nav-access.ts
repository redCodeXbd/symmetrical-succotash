import { FuseNavigationItem } from '@fuse/components/navigation';
import { AccessService } from './access.service';

/** The permission that unlocks each menu item. Items that are not listed are visible to everyone. */
export const NAV_PERMISSIONS: Record<string, string> = {
    'treasury.organization-funds': 'org-funds.view',
    'treasury.funds': 'fund-requests.view',
    'treasury.transactions': 'transactions.view',
    clients: 'clients.view',
    vendors: 'vendors.view',
    'settings.theme': 'theme.view',
    'settings.categories': 'categories.view',
    'settings.roles': 'roles.view',
};

/** Returns the menu the acting user may see; a parent with no visible children disappears. */
export function filterNavigation(items: FuseNavigationItem[], access: AccessService): FuseNavigationItem[] {
    return items
        .filter((item) => !NAV_PERMISSIONS[item.id] || access.can(NAV_PERMISSIONS[item.id]))
        .map((item) => (item.children ? { ...item, children: filterNavigation(item.children, access) } : item))
        .filter((item) => !item.children || item.children.length > 0);
}
