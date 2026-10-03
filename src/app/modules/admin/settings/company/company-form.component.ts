import { ConfirmService } from 'app/core/confirm/confirm.service';
import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { SwitchComponent } from '../../treasury/shared/switch/switch.component';
import { SlideOverComponent } from '../../treasury/shared/slide-over/slide-over.component';
import { CompanyService } from './company.service';
import { Company, CompanyInput, CURRENCIES, MONTHS } from './company.types';

/** Slide-over to add a company, or edit the one passed in. */
@Component({
    selector: 'company-form',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, SlideOverComponent, SwitchComponent],
    template: `
        <treasury-slide-over [heading]="company ? 'Edit company' : 'Add company'" subheading="Legal and contact details" (closed)="closed.emit()">
            <form id="company-form" class="flex flex-col gap-4" (ngSubmit)="save()">
                <div class="grid grid-cols-3 gap-3">
                    <label class="col-span-2 block"><span class="text-sm font-medium">Company name *</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="name" [(ngModel)]="form.name" /></label>
                    <label class="block"><span class="text-sm font-medium">Code *</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md uppercase" name="code" maxlength="6" [(ngModel)]="form.code" /></label>
                </div>
                <label class="block"><span class="text-sm font-medium">Legal name</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="legal" [(ngModel)]="form.legalName" /></label>
                <div class="grid grid-cols-2 gap-3">
                    <label class="block"><span class="text-sm font-medium">Trade licence</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="tl" [(ngModel)]="form.tradeLicense" /></label>
                    <label class="block"><span class="text-sm font-medium">TIN / BIN</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="tin" [(ngModel)]="form.taxId" /></label>
                    <label class="block"><span class="text-sm font-medium">Phone</span><input class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="phone" [(ngModel)]="form.phone" /></label>
                    <label class="block"><span class="text-sm font-medium">Email</span><input type="email" class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="email" [(ngModel)]="form.email" /></label>
                    <label class="block"><span class="text-sm font-medium">Currency</span><select class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="cur" [(ngModel)]="form.currency">@for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }</select></label>
                    <label class="block"><span class="text-sm font-medium">Fiscal year starts</span><select class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="fy" [(ngModel)]="form.fiscalStartMonth">@for (m of months; track m; let i = $index) { <option [ngValue]="i + 1">{{ m }}</option> }</select></label>
                </div>
                <label class="block"><span class="text-sm font-medium">Address</span><textarea rows="2" class="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-md" name="addr" [(ngModel)]="form.address"></textarea></label>
                <treasury-switch name="active" label="Active" hint="Switch off to hide the company from pickers" [(ngModel)]="form.active" />
                @if (error) {
                    <div class="text-sm text-red-600" role="alert">{{ error }}</div>
                }
            </form>
            <ng-container footer>
                <button mat-stroked-button type="button" (click)="closed.emit()">Cancel</button>
                <button mat-flat-button color="primary" type="submit" form="company-form">{{ company ? 'Save changes' : 'Add company' }}</button>
            </ng-container>
        </treasury-slide-over>
    `,
})
export class CompanyFormComponent implements OnInit {
    @Input() company: Company | null = null;
    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<string>();

    readonly currencies = CURRENCIES;
    readonly months = MONTHS;
    form: CompanyInput = { code: '', name: '', legalName: '', tradeLicense: '', taxId: '', address: '', phone: '', email: '', currency: 'BDT', fiscalStartMonth: 7, active: true };
    error: string | null = null;

    constructor(private _company: CompanyService, private _confirm: ConfirmService) {}

    ngOnInit(): void {
        if (this.company) {
            const { id, ...rest } = this.company;
            this.form = { ...rest };
        }
    }

    async save(): Promise<void> {
        if (this.company && !(await this._confirm.update(`the company "${this.company.name}"`))) {
            return;
        }
        const result = this.company ? this._company.updateCompany(this.company.id, this.form) : this._company.addCompany(this.form);
        if (typeof result === 'string') {
            this.error = result;
            return;
        }
        this.saved.emit(this.company ? this.company.id : (result as { id: string } | null)?.id ?? '');
    }
}
