import { FuseNavigationItem } from '@fuse/components/navigation';
import { AppRole } from './role.service';

/** Which roles may see each menu item. Items that are not listed are visible to everyone. */
export const NAV_ACCESS: Record<string, AppRole[]> = {
    'treasury.organization-funds': ['accountant', 'admin'],
    settings: ['admin'],
    'settings.theme': ['admin'],
};

/** Returns the menu a role is allowed to see; a parent with no visible children disappears. */
export function filterNavigation(items: FuseNavigationItem[], role: AppRole): FuseNavigationItem[] {
    return items
        .filter((item) => !NAV_ACCESS[item.id] || NAV_ACCESS[item.id].includes(role))
        .map((item) => (item.children ? { ...item, children: filterNavigation(item.children, role) } : item))
        .filter((item) => !item.children || item.children.length > 0);
}
