import { watchQuery } from 'app/core/navigation/deep-link';
import { DecimalPipe } from '@angular/common';
import { Component, computed, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { VendorFormComponent } from './vendor-form.component';
import { VendorsService } from './vendors.service';
import { VENDOR_TYPE_CLASSES, VENDOR_TYPE_LABELS, VENDOR_TYPES, VendorType } from './vendors.types';

@Component({
    selector: 'vendors-list',
    templateUrl: './vendors.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DecimalPipe, FormsModule, AddButtonComponent, UserSwitchComponent, VendorFormComponent],
})
export class VendorsComponent implements OnInit {
    readonly types = VENDOR_TYPES;
    readonly typeLabels = VENDOR_TYPE_LABELS;
    readonly typeClasses = VENDOR_TYPE_CLASSES;

    search = signal('');
    type = signal<'all' | VendorType>('all');
    formOpen = signal(false);

    list = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.service
            .vendors()
            .filter((v) => (this.type() === 'all' || v.type === this.type()) && (!q || [v.id, v.name, v.contactPerson, v.city, v.email].some((x) => x.toLowerCase().includes(q))));
    });

    /** Menu links: ?action=add, ?type=product|service|other */
    private _deep = watchQuery((q) => {
        const type = q.get('type');
        if (type === 'product' || type === 'service' || type === 'other' || type === 'all') {
            this.type.set(type);
        }
        if (q.get('action') === 'add' && this.access.can('vendors.add')) {
            this.formOpen.set(true);
        }
    });

    constructor(
        public service: VendorsService,
        public access: AccessService,
        private _router: Router
    ) {}

    ngOnInit(): void {
        // A vendor user has exactly one vendor, so skip the list.
        const only = this.service.vendors();
        if (this.service.isVendorUser && only.length === 1) {
            this._router.navigate(['/vendors', only[0].id], { replaceUrl: true });
        }
    }

    countOf(type: VendorType): number {
        return this.service.vendors().filter((v) => v.type === type).length;
    }

    open(id: string): void {
        this._router.navigate(['/vendors', id]);
    }

    saved(id: string): void {
        this.formOpen.set(false);
        this.open(id);
    }
}
