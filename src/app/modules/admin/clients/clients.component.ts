import { watchQuery } from 'app/core/navigation/deep-link';
import { Component, computed, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { ClientFormComponent } from './client-form.component';
import { ClientsService } from './clients.service';

@Component({
    selector: 'clients-list',
    templateUrl: './clients.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, AddButtonComponent, UserSwitchComponent, ClientFormComponent],
})
export class ClientsComponent implements OnInit {
    search = signal('');
    status = signal<'all' | 'active' | 'inactive'>('all');
    formOpen = signal(false);

    list = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.service
            .clients()
            .filter(
                (c) =>
                    (this.status() === 'all' || c.status === this.status()) &&
                    (!q || [c.id, c.name, c.contactPerson, c.city, c.email].some((v) => v.toLowerCase().includes(q)))
            );
    });

    /** Menu links: ?action=add, ?status=active|inactive */
    private _deep = watchQuery((q) => {
        const status = q.get('status');
        if (status === 'active' || status === 'inactive' || status === 'all') {
            this.status.set(status);
        }
        if (q.get('action') === 'add' && this.access.can('clients.add')) {
            this.formOpen.set(true);
        }
    });

    constructor(
        public service: ClientsService,
        public access: AccessService,
        private _router: Router
    ) {}

    ngOnInit(): void {
        // A client user has exactly one client, so skip the list.
        const only = this.service.clients();
        if (this.service.isClientUser && only.length === 1) {
            this._router.navigate(['/clients', only[0].id], { replaceUrl: true });
        }
    }

    open(id: string): void {
        this._router.navigate(['/clients', id]);
    }

    saved(id: string): void {
        this.formOpen.set(false);
        this.open(id);
    }
}
