import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { ALL_PERMISSIONS, ApprovalRule, FEATURES } from 'app/core/access/access.types';
import { UserService } from 'app/core/user/user.service';
import { ClientsService } from '../clients/clients.service';
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
    waitingCount = computed(() => this.waitingRequests().length + this.waitingInvoices().length);
    myRequests = computed(() => this.funds.requests().filter((r) => r.employee === this.user().name));

    constructor(
        public access: AccessService,
        private funds: FundsService,
        private vendors: VendorsService,
        private clients: ClientsService,
        users: UserService
    ) {
        this._load();
        users.user$.subscribe((u) => this.avatar.set(u?.avatar ?? null));
    }

    get showAvatar(): boolean {
        return !!this.avatar() && this.user().id === 'u-brian';
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
