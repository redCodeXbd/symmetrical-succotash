import { Routes } from '@angular/router';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsComponent } from './clients.component';

export default [
    { path: '', component: ClientsComponent },
    { path: ':id', component: ClientDetailComponent },
] as Routes;
