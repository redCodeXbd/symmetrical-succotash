import { Component, ViewEncapsulation } from '@angular/core';

@Component({
    selector: 'auth-brand-panel',
    templateUrl: './brand-panel.component.html',
    encapsulation: ViewEncapsulation.None,
    host: { class: 'contents' },
    standalone: true,
})
export class AuthBrandPanelComponent {
    modules: string[] = [
        'Work Orders',
        'Sales',
        'Purchases',
        'Treasury',
        'HR & Payroll',
    ];
}
