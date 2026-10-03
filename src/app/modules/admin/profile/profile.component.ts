import { ConfirmService } from 'app/core/confirm/confirm.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { ALL_PERMISSIONS, ApprovalRule, FEATURES } from 'app/core/access/access.types';
import { UserService } from 'app/core/user/user.service';
import { ClientsService } from '../clients/clients.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FundsService } from '../treasury/funds/funds.service';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { VendorsService } from '../vendors/vendors.service';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, UserSwitchComponent],
})
export class ProfileComponent {
    readonly features = FEATURES;
    readonly totalPermissions = ALL_PERMISSIONS.length;

    form = { phone: '', title: '', about: '' };
    saved = signal(false);
    avatar = signal<string | null>(null);

    user = this.access.user;
    permissionCount = computed(() => ALL_PERMISSIONS.filter((p) => this.access.can(p)).length);

    /** Fund requests and vendor invoices waiting for this person's approval. */
    waitingRequests = computed(() => this.funds.requests().filter((r) => this.funds.canApprove(r)));
    waitingInvoices = computed(() => this.vendors.invoicesAwaitingMe());
    waitingExpenses = computed(() => this.expenses.awaitingMe());
    waitingCount = computed(() => this.waitingRequests().length + this.waitingInvoices().length + this.waitingExpenses().length);
    myRequests = computed(() => this.funds.requests().filter((r) => r.employee === this.user().name));

    constructor(
        public access: AccessService,
        private funds: FundsService,
        private vendors: VendorsService,
        private expenses: ExpensesService,
        private clients: ClientsService,
        users: UserService,
        private _confirm: ConfirmService
    ) {
        this._load();
        users.user$.subscribe((u) => this.avatar.set(u?.avatar ?? null));
    }

    photoError = signal<string | null>(null);

    /** The photo to show: the one the user chose, or the demo sign-in photo for Brian. */
    get photo(): string | null {
        return this.access.avatarFor(this.avatar() ?? undefined);
    }

    /** Reads the chosen image and shrinks it to a small square, so it is cheap to keep in the browser. */
    async pickPhoto(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        this.photoError.set(null);
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            this.photoError.set('Choose an image file (JPG, PNG or WebP).');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            this.photoError.set('That image is larger than 8 MB. Choose a smaller one.');
            return;
        }
        try {
            this.access.setAvatar(await this._shrink(file, 256));
        } catch {
            this.photoError.set('That image could not be read. Try another one.');
        }
    }

    async removePhoto(): Promise<void> {
        if (!(await this._confirm.delete('your photo', { message: 'Your initials are shown instead until you add a new photo.', confirmLabel: 'Yes, remove', note: '' }))) {
            return;
        }
        this.photoError.set(null);
        this.access.setAvatar('');
    }

    /** Crops to the centre square and scales to `size` pixels as a JPEG. */
    private _shrink(file: File, size: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const side = Math.min(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error('no canvas'));
                    return;
                }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('bad image'));
            };
            img.src = url;
        });
    }

    get organization(): string | null {
        const u = this.user();
        if (u.clientId) {
            return `Client: ${this.clients.client(u.clientId)?.name ?? u.clientId}`;
        }
        if (u.vendorId) {
            return `Vendor: ${this.vendors.vendor(u.vendorId)?.name ?? u.vendorId}`;
        }
        return null;
    }

    initials(): string {
        return this.user().name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
    }

    vendorName(id: string): string {
        return this.vendors.vendor(id)?.name ?? id;
    }

    featureAllowed(featureId: string): { label: string; description: string }[] {
        const f = this.features.find((x) => x.id === featureId);
        return (f?.permissions ?? []).filter((p) => this.access.can(`${featureId}.${p.key}`)).map((p) => ({ label: p.label, description: p.description }));
    }

    featureTotal(featureId: string): number {
        return this.features.find((x) => x.id === featureId)?.permissions.length ?? 0;
    }

    /** Approval branches where one of this person's roles is a step. */
    myPaths = computed(() =>
        [...this.access.rules()]
            .sort((a, b) => a.minAmount - b.minAmount)
            .map((rule) => ({ rule, mine: rule.steps.map((id) => this.access.hasRole(id)) }))
            .filter((x) => x.mine.some(Boolean))
    );

    rangeText(rule: ApprovalRule): string {
        const rules = [...this.access.rules()].sort((a, b) => a.minAmount - b.minAmount);
        const next = rules[rules.findIndex((r) => r.id === rule.id) + 1];
        const fmt = (n: number) => n.toLocaleString('en-US');
        return !next ? (rule.minAmount === 0 ? 'Any amount' : `${fmt(rule.minAmount)} and above`) : `${fmt(rule.minAmount)} to ${fmt(next.minAmount - 1)}`;
    }

    save(): void {
        this.access.updateProfile(this.form);
        this.saved.set(true);
    }

    private _load(): void {
        const u = this.access.user();
        this.form = { phone: u.phone ?? '', title: u.title ?? '', about: u.about ?? '' };
    }

    /** The form follows whoever is acting. */
    reload(): void {
        this._load();
        this.saved.set(false);
    }
}
