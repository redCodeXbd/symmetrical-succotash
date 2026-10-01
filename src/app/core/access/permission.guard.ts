import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccessService } from './access.service';

/** Lets a route open only for someone with the permission; everyone else goes to the first page they may see. */
export const permissionGuard = (permission: string): CanActivateFn => {
    return () => {
        const access = inject(AccessService);
        if (access.can(permission)) {
            return true;
        }
        const router = inject(Router);
        return router.createUrlTree([access.can('fund-requests.view') ? '/treasury/funds' : '/treasury/transactions']);
    };
};
