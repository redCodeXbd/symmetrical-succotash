import { Routes } from '@angular/router';
import { AdminsComponent } from './admins.component';
import { EmployeesComponent } from './employees.component';
import { LinkedUsersComponent } from './linked-users.component';

export default [
    { path: '', pathMatch: 'full', redirectTo: 'employees' },
    { path: 'employees', component: EmployeesComponent },
    { path: 'admins', component: AdminsComponent },
    { path: 'vendors', component: LinkedUsersComponent, data: { kind: 'vendor' } },
    { path: 'clients', component: LinkedUsersComponent, data: { kind: 'client' } },
    { path: 'customers', component: LinkedUsersComponent, data: { kind: 'customer' } },
] as Routes;
