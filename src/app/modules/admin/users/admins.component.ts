import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AccessService } from 'app/core/access/access.service';
import { AppUser } from 'app/core/access/access.types';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { UsersService } from './users.service';

/** People with the Admin role. Adding or removing admin access goes through the role assignment safeguards. */
@Component({
    selector: 'users-admins',
    templateUrl: './admins.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, UserSwitchComponent],
})
export class AdminsComponent {
    message = signal<{ text: string; ok: boolean } | null>(null);
    pickId = '';

    admins = computed(() => this.access.users().filter((u) => u.roleIds.includes('admin')));
    candidates = computed(() => this.users.staff().filter((u) => !u.roleIds.includes('admin') && u.active !== false));

    constructor(
        public access: AccessService,
        private users: UsersService
    ) {}

    otherRoles(u: AppUser): string[] {
        return this.access.roles().filter((r) => u.roleIds.includes(r.id) && r.id !== 'admin').map((r) => r.name);
    }

    add(): void {
        const user = this.access.users().find((u) => u.id === this.pickId);
        if (!user) {
            this._report('Choose a person to make an admin.', null);
            return;
        }
        this._report(this.access.setUserRoles(user.id, [...user.roleIds, 'admin']), `${user.name} is now an admin.`);
        this.pickId = '';
    }

    remove(u: AppUser): void {
        const roleIds = u.roleIds.filter((r) => r !== 'admin');
        // A person always keeps at least a basic role.
        this._report(this.access.setUserRoles(u.id, roleIds.length ? roleIds : ['employee']), `${u.name} is no longer an admin.`);
    }

    toggleActive(u: AppUser): void {
        const error = this.access.updateUser(u.id, { active: u.active === false });
        this._report(error, u.active === false ? `${u.name} is active again.` : `${u.name} is now inactive.`);
    }

    private _report(error: string | null, success: string | null): void {
        this.message.set(error ? { text: error, ok: false } : success ? { text: success, ok: true } : null);
    }
}
