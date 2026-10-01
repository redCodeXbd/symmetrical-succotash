import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { permissionGuard } from 'app/core/access/permission.guard';
import { LayoutComponent } from 'app/layout/layout.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [

    // Redirect empty path to '/dashboard'
    {path: '', pathMatch : 'full', redirectTo: 'dashboard'},

    // Redirect signed-in user to the '/dashboard'
    //
    // After the user signs in, the sign-in page will redirect the user to the 'signed-in-redirect'
    // path. Below is another redirection for that path to redirect the user to the desired
    // location. This is a small convenience to keep all main routes together here on this file.
    {path: 'signed-in-redirect', pathMatch : 'full', redirectTo: 'dashboard'},

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'confirmation-required', loadChildren: () => import('app/modules/auth/confirmation-required/confirmation-required.routes')},
            {path: 'forgot-password', loadChildren: () => import('app/modules/auth/forgot-password/forgot-password.routes')},
            {path: 'reset-password', loadChildren: () => import('app/modules/auth/reset-password/reset-password.routes')},
            {path: 'sign-in', loadChildren: () => import('app/modules/auth/sign-in/sign-in.routes')},
            {path: 'sign-up', loadChildren: () => import('app/modules/auth/sign-up/sign-up.routes')}
        ]
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'sign-out', loadChildren: () => import('app/modules/auth/sign-out/sign-out.routes')},
            {path: 'unlock-session', loadChildren: () => import('app/modules/auth/unlock-session/unlock-session.routes')}
        ]
    },

    // Landing routes
    {
        path: '',
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'home', loadChildren: () => import('app/modules/landing/home/home.routes')},
            {path: 'shared', loadChildren: () => import('app/modules/landing/shared-report/shared-report.routes')},
        ]
    },

    // Admin routes
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            {path: 'dashboard', loadChildren: () => import('app/modules/admin/dashboard/dashboard.routes')},
            {path: 'clients', canActivate: [permissionGuard('clients.view')], loadChildren: () => import('app/modules/admin/clients/clients.routes')},
            {path: 'example', loadChildren: () => import('app/modules/admin/example/example.routes')},
            {path: 'settings/categories', canActivate: [permissionGuard('categories.view')], loadChildren: () => import('app/modules/admin/settings/categories/categories.routes')},
            {path: 'settings/theme', canActivate: [permissionGuard('theme.view')], loadChildren: () => import('app/modules/admin/settings/theme/theme.routes')},
            {path: 'settings/roles', canActivate: [permissionGuard('roles.view')], loadChildren: () => import('app/modules/admin/settings/roles/roles.routes')},
            {path: 'treasury/organization-funds', canActivate: [permissionGuard('org-funds.view')], loadChildren: () => import('app/modules/admin/treasury/org-funds/org-funds.routes')},
            {path: 'treasury/transactions', canActivate: [permissionGuard('transactions.view')], loadChildren: () => import('app/modules/admin/treasury/transactions/transactions.routes')},
            {path: 'treasury/funds', canActivate: [permissionGuard('fund-requests.view')], loadChildren: () => import('app/modules/admin/treasury/funds/funds.routes')},
        ]
    }
];
