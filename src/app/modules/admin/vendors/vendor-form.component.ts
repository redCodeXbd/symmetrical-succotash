import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { VendorsService } from './vendors.service';
import { Vendor, VendorInput, VENDOR_TYPES } from './vendors.types';

/** Add or edit a vendor in a drawer. Emits the vendor id once saved. */
@Component({
    selector: 'vendors-form',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, SlideOverComponent],
    template: `
        <treasury-slide-over [heading]="vendor ? 'Edit vendor' : 'New vendor'" [subheading]="vendor?.id ?? ''" (closed)="cancelled.emit()">
            <form id="vendor-form" class="flex flex-col gap-4" (ngSubmit)="save()">
                <fieldset>
                    <legend class="text-sm font-medium">Vendor type *</legend>
                    <div class="mt-2 grid grid-cols-1 gap-2">
                        @for (t of types; track t.id) {
                            <label class="flex cursor-pointer items-center gap-3 rounded-lg border p-3" [class]="model.type === t.id ? 'border-primary bg-primary/10' : ''">
                                <input type="radio" name="type" [value]="t.id" [(ngModel)]="model.type" />
                                <span><span class="font-medium">{{ t.label }}</span><span class="text-secondary block text-sm">{{ t.description }}</span></span>
                            </label>
                        }
                    </div>
                </fieldset>
                @for (f of fields; track f.key) {
                    <label class="block">
                        <span class="text-sm font-medium">{{ f.label }}{{ f.required ? ' *' : '' }}</span>
                        <input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" [type]="f.type ?? 'text'" [name]="f.key" [(ngModel)]="model[f.key]" />
                    </label>
                }
                <label class="block">
                    <span class="text-sm font-medium">Status</span>
                    <select class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="status" [(ngModel)]="model.status">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </label>
                <label class="block">
                    <span class="text-sm font-medium">Notes</span>
                    <textarea class="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-md" rows="3" name="notes" [(ngModel)]="model.notes"></textarea>
                </label>
                @if (error) {
                    <div class="rounded-lg bg-red-50 p-3 text-md text-red-800" role="alert">{{ error }}</div>
                }
            </form>
            <ng-container footer>
                <button mat-stroked-button type="button" (click)="cancelled.emit()">Cancel</button>
                <button mat-flat-button color="primary" type="submit" form="vendor-form">Save vendor</button>
            </ng-container>
        </treasury-slide-over>
    `,
})
export class VendorFormComponent implements OnInit {
    @Input() vendor: Vendor | null = null;
    @Output() saved = new EventEmitter<string>();
    @Output() cancelled = new EventEmitter<void>();

    readonly types = VENDOR_TYPES;
    readonly fields: { key: keyof VendorInput; label: string; required?: boolean; type?: string }[] = [
        { key: 'name', label: 'Vendor name', required: true },
        { key: 'contactPerson', label: 'Contact person' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'country', label: 'Country' },
        { key: 'taxId', label: 'Tax / BIN number' },
        { key: 'bankDetails', label: 'Bank details' },
        { key: 'paymentTerms', label: 'Payment terms' },
    ];

    model: VendorInput = {
        name: '', type: 'product', contactPerson: '', email: '', phone: '', address: '', city: '', country: 'Bangladesh',
        taxId: '', bankDetails: '', paymentTerms: '', status: 'active', notes: '',
    };
    error: string | null = null;

    constructor(private _vendors: VendorsService) {}

    ngOnInit(): void {
        if (this.vendor) {
            const { id, createdAt, ...rest } = this.vendor;
            this.model = { ...rest };
        }
    }

    save(): void {
        if (this.vendor) {
            this._done(this._vendors.updateVendor(this.vendor.id, this.model), this.vendor.id);
        } else {
            const result = this._vendors.addVendor(this.model);
            typeof result === 'string' ? this._done(result, '') : this._done(null, result.id);
        }
    }

    private _done(error: string | null, id: string): void {
        this.error = error;
        if (!error) {
            this.saved.emit(id);
        }
    }
}
