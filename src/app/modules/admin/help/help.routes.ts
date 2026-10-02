import { Routes } from '@angular/router';
import { HelpGuideComponent } from './help-guide.component';
import { HelpComponent } from './help.component';

export default [
    { path: '', component: HelpComponent },
    { path: ':id', component: HelpGuideComponent },
] as Routes;
