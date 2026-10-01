import { Component, ViewEncapsulation } from '@angular/core';
import { AccessService } from 'app/core/access/access.service';

/** "Acting as" picker. Demo control: it stands in for whoever signs in, and shows their roles. */
@Component({
    selector: 'treasury-user-switch',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    template: `
        <label class="user-switch">
            <span class="user-switch-label">Acting as</span>
            <select
                class="user-switch-select"
                aria-label="Acting as"
                [value]="access.userId()"
                (change)="access.actAs($any($event.target).value)"
            >
                @for (u of access.users(); track u.id) {
                    @if (u.active !== false) {
                    <option [value]="u.id" [selected]="u.id === access.userId()">{{ u.name }}</option>
                    }
                }
            </select>
            <span class="user-switch-roles">{{ roleNames() }}</span>
        </label>
    `,
})
export class UserSwitchComponent {
    constructor(public access: AccessService) {}

    roleNames(): string {
        return this.access.userRoles().map((r) => r.name).join(' + ');
    }
}
