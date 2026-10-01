import { DOCUMENT } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Placeholder landing page. While it is open the side menu pulses (see `.on-dashboard` in
 * _app-theme.scss) so people know to use it. Replace the content when the real dashboard exists.
 */
@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatIconModule],
})
export class DashboardComponent implements OnInit, OnDestroy {
    private _body = inject(DOCUMENT).body;

    readonly bars = [38, 56, 44, 72, 60, 88, 68, 96];

    ngOnInit(): void {
        this._body.classList.add('on-dashboard');
    }

    ngOnDestroy(): void {
        this._body.classList.remove('on-dashboard');
    }
}
