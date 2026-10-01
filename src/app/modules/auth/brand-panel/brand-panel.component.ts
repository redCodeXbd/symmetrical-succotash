import { Component, ViewEncapsulation } from '@angular/core';
import { ThemeService } from 'app/core/theme/theme.service';

@Component({
    selector: 'auth-brand-panel',
    templateUrl: './brand-panel.component.html',
    encapsulation: ViewEncapsulation.None,
    host: { class: 'contents' },
    standalone: true,
})
export class AuthBrandPanelComponent {
    constructor(public theme: ThemeService) {}

    modules: string[] = [
        'Work Orders',
        'Sales',
        'Purchases',
        'Treasury',
        'HR & Payroll',
    ];
}
