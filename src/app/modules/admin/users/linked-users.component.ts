import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { AppUser } from 'app/core/access/access.types';
import { ClientsService } from '../clients/clients.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { SwitchComponent } from '../treasury/shared/switch/switch.component';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { VendorsService } from '../vendors/vendors.service';

type Kind = 'vendor' | 'client' | 'customer';

/** Logins of outside companies: one page for vendors, another for clients. Each login is tied to one company. */
@Component({
    selector: 'users-linked',
    templateUrl: './linked-users.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, RouterLink, AddButtonComponent, SlideOverComponent, SwitchComponent, UserSwitchComponent],
})
export class LinkedUsersComponent {
    kind = signal<Kind>('vendor');
    search = signal('');
    message = signal<{ text: string; ok: boolean } | null>(null);
    panel = signal<'form' | 'delete' | null>(null);
    target = signal<AppUser | null>(null);
    form = { name: '', email: '', phone: '', address: '', companyId: '', active: true };
    error: string | null = null;

    constructor(
        public access: AccessService,
        private _vendors: VendorsService,
        private _clients: ClientsService,
        route: ActivatedRoute
    ) {
        route.data.subscribe((d) => this.kind.set((d['kind'] as Kind) ?? 'vendor'));
    }

    get noun(): string {
        return this.kind() === 'vendor' ? 'Vendor' : this.kind() === 'client' ? 'Client' : 'Customer';
    }

    /** Vendor and client logins belong to a company; a customer login does not. */
    get needsCompany(): boolean {
        return this.kind() !== 'customer';
    }

    companies = computed(() =>
        this.kind() === 'vendor'
            ? this._vendors.vendors().map((v) => ({ id: v.id, name: v.name }))
            : this.kind() === 'client'
              ? this._clients.clients().map((c) => ({ id: c.id, name: c.name }))
              : []
    );

    rows = computed(() => {
        const q = this.search().trim().toLowerCase();
        const k = this.kind();
        return this.access
            .users()
            .filter((u) => (k === 'vendor' ? !!u.vendorId : k === 'client' ? !!u.clientId : !!u.customer))
            .filter((u) => !q || [u.name, u.email, u.phone ?? '', u.address ?? '', this.company(u)].some((v) => v.toLowerCase().includes(q)));
    });

    company(u: AppUser): string {
        const id = this.kind() === 'vendor' ? u.vendorId : u.clientId;
        return this.companies().find((c) => c.id === id)?.name ?? id ?? '';
    }

    link(u: AppUser): string[] {
        return [this.kind() === 'vendor' ? '/vendors' : '/clients', (this.kind() === 'vendor' ? u.vendorId : u.clientId) ?? ''];
    }

    openAdd(): void {
        this.target.set(null);
        this.form = { name: '', email: '', phone: '', address: '', companyId: '', active: true };
        this._open('form');
    }

    openEdit(u: AppUser): void {
        this.target.set(u);
        this.form = { name: u.name, email: u.email, phone: u.phone ?? '', address: u.address ?? '', companyId: (this.kind() === 'vendor' ? u.vendorId : u.clientId) ?? '', active: u.active !== false };
        this._open('form');
    }

    openDelete(u: AppUser): void {
        this.target.set(u);
        this._open('delete');
    }

    close(): void {
        this.panel.set(null);
    }

    save(): void {
        const t = this.target();
        const f = this.form;
        if (this.needsCompany && !f.companyId) {
            this.error = `Choose the ${this.noun.toLowerCase()} this login belongs to.`;
            return;
        }
        let error: string | null;
        if (t) {
            error = this.access.updateUser(t.id, { name: f.name, email: f.email, phone: f.phone, address: f.address, active: f.active });
            if (!error && this.needsCompany) {
                this._setCompany(t.id, f.companyId);
            }
        } else {
            error =
                this.kind() === 'vendor'
                    ? this.access.addVendorUser(f.name, f.email, f.companyId)
                    : this.kind() === 'client'
                      ? this.access.addClientUser(f.name, f.email, f.companyId)
                      : this.access.addCustomerUser(f.name, f.email);
            if (!error) {
                const created = this.access.users()[this.access.users().length - 1];
                error = this.access.updateUser(created.id, { phone: f.phone, address: f.address, active: f.active });
            }
        }
        this._finish(error, t ? `${this.noun} login updated.` : `${this.noun} login created.`);
    }

    /** A customer has no company to remove, so only vendor and client logins offer this. */
    unlink(u: AppUser): void {
        this._setCompany(u.id, null);
        this.message.set({ text: `${u.name} no longer has access to a ${this.noun.toLowerCase()}.`, ok: true });
    }

    remove(): void {
        const t = this.target();
        if (t) {
            this._finish(this.access.removeUser(t.id), `${t.name} deleted.`);
        }
    }

    private _setCompany(userId: string, id: string | null): void {
        this.kind() === 'vendor' ? this.access.setUserVendor(userId, id) : this.access.setUserClient(userId, id);
    }

    private _open(panel: 'form' | 'delete'): void {
        this.error = null;
        this.message.set(null);
        this.panel.set(panel);
    }

    private _finish(error: string | null, success: string): void {
        this.error = error;
        if (!error) {
            this.panel.set(null);
            this.message.set({ text: success, ok: true });
        }
    }
}
