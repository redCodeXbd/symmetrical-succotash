import { FuseNavigationItem } from '@fuse/components/navigation';
import { AccessService } from './access.service';

/** The permission that unlocks each menu item. Items that are not listed are visible to everyone. */
export const NAV_PERMISSIONS: Record<string, string> = {
    'treasury.organization-funds': 'org-funds.view',
    'treasury.organization-funds.add': 'org-funds.add',
    'treasury.funds': 'fund-requests.view',
    'treasury.funds.new': 'fund-requests.add',
    'treasury.transactions': 'transactions.view',
    'treasury.transactions.movements': 'transactions.view_movements',
    clients: 'clients.view',
    'clients.new.client': 'clients.add',
    'clients.new.login': 'users.add',
    vendors: 'vendors.view',
    'vendors.new.vendor': 'vendors.add',
    'vendors.new.login': 'users.add',
    projects: 'projects.view',
    'projects.new': 'projects.add',
    store: 'store.view',
    'store.catalogue.product': 'store.catalog',
    'store.catalogue.store': 'store.catalog',
    'store.actions.receive': 'store.receive',
    'store.actions.issue': 'store.issue',
    'store.actions.transfer': 'store.transfer',
    'store.actions.count': 'store.adjust',
    expenses: 'expenses.view',
    'expenses.enter': 'expenses.add',
    'expenses.settings': 'expenses.manage_categories',
    users: 'users.view',
    'users.employees': 'users.view',
    'users.employees.add': 'users.add',
    'users.admins': 'users.view',
    'users.vendors': 'users.view',
    'users.vendors.add': 'users.add',
    'users.clients': 'users.view',
    'users.clients.add': 'users.add',
    'users.customers': 'users.view',
    'users.customers.add': 'users.add',
    'settings.company': 'company.view',
    'settings.company.add': 'company.create',
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
