import { Routes } from '@angular/router';
import { VendorDetailComponent } from './vendor-detail.component';
import { VendorsComponent } from './vendors.component';

export default [
    { path: '', component: VendorsComponent },
    { path: ':id', component: VendorDetailComponent },
] as Routes;
