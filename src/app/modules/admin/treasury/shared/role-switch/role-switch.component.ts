import { Component, ViewEncapsulation } from '@angular/core';
import { AppRole, ROLE_LABELS, RoleService } from 'app/core/role/role.service';

/** "Preview as" switch. Demo control: it stands in for the signed-in user's real role. */
@Component({
    selector: 'treasury-role-switch',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    template: `
        <div class="fund-segment" role="group" aria-label="Preview as">
            @for (r of roles; track r) {
                <button
                    type="button"
                    [class.fund-segment-on]="roleService.role() === r"
                    [attr.aria-pressed]="roleService.role() === r"
                    (click)="roleService.set(r)"
                >
                    {{ labels[r] }}
                </button>
            }
        </div>
    `,
})
export class RoleSwitchComponent {
    readonly roles: AppRole[] = ['employee', 'accountant', 'admin'];
    readonly labels = ROLE_LABELS;

    constructor(public roleService: RoleService) {}
}
