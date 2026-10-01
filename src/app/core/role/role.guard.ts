import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, RoleService } from './role.service';

/** Blocks a route for roles that should not open it and sends them to the Funds page. */
export const roleGuard = (allowed: AppRole[]): CanActivateFn => {
    return () => {
        const roles = inject(RoleService);
        return roles.has(allowed) ? true : inject(Router).createUrlTree(['/treasury/funds']);
    };
};
