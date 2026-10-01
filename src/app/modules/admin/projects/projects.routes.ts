import { Routes } from '@angular/router';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectsComponent } from './projects.component';

export default [
    { path: '', component: ProjectsComponent },
    { path: ':id', component: ProjectDetailComponent },
] as Routes;
