import { Routes } from '@angular/router';
import { SharedReportComponent } from './shared-report.component';

export default [
    {
        path: ':token',
        component: SharedReportComponent,
    },
] as Routes;
