import { Routes } from '@angular/router';
import { CompanyListComponent } from './company-list.component';
import { CompanyDetailComponent } from './company-detail.component';

export default [
    { path: '', component: CompanyListComponent },
    { path: ':id', component: CompanyDetailComponent },
] as Routes;
