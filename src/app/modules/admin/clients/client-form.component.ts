import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { ClientsService } from './clients.service';
import { Client, ClientInput } from './clients.types';

/** Add or edit a client in a drawer. Emits the client id once saved. */
@Component({
    selector: 'clients-form',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, SlideOverComponent],
    template: `
        <treasury-slide-over [heading]="client ? 'Edit client' : 'New client'" [subheading]="client?.id ?? ''" (closed)="cancelled.emit()">
            <form id="client-form" class="flex flex-col gap-4" (ngSubmit)="save()">
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
                <button mat-flat-button color="primary" type="submit" form="client-form">Save client</button>
            </ng-container>
        </treasury-slide-over>
    `,
})
export class ClientFormComponent implements OnInit {
    @Input() client: Client | null = null;
    @Output() saved = new EventEmitter<string>();
    @Output() cancelled = new EventEmitter<void>();

    readonly fields: { key: keyof ClientInput; label: string; required?: boolean; type?: string }[] = [
        { key: 'name', label: 'Company name', required: true },
        { key: 'contactPerson', label: 'Contact person' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'country', label: 'Country' },
        { key: 'taxId', label: 'Tax / BIN number' },
        { key: 'industry', label: 'Industry' },
        { key: 'website', label: 'Website' },
    ];

    model: ClientInput = {
        name: '', contactPerson: '', email: '', phone: '', address: '', city: '', country: 'Bangladesh',
        taxId: '', industry: '', website: '', status: 'active', notes: '',
    };
    error: string | null = null;

    constructor(private _clients: ClientsService) {}

    ngOnInit(): void {
        if (this.client) {
            const { id, createdAt, ...rest } = this.client;
            this.model = { ...rest };
        }
    }

    save(): void {
        if (this.client) {
            const error = this._clients.updateClient(this.client.id, this.model);
            this._done(error, this.client.id);
        } else {
            const result = this._clients.addClient(this.model);
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
