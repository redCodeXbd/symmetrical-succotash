import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DateTime } from 'luxon';
import { CategoryService } from 'app/core/categories/categories.service';
import { FundsService } from '../funds.service';
import { FundRequest } from '../funds.types';
import { ChargedTo, ChargedToComponent } from '../../../settings/company/charged-to.component';
import { CompanyService } from '../../../settings/company/company.service';
import { SlideOverComponent } from '../../shared/slide-over/slide-over.component';

@Component({
    selector: 'funds-request-form',
    templateUrl: './request-form.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        SlideOverComponent,
        ChargedToComponent,
    ],
})
export class RequestFormComponent implements OnInit {
    /** Set to edit an existing pending request; leave empty to create one. */
    @Input() request: FundRequest | null = null;
    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<FundRequest>();

    form = this._fb.group({
        amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
        category: ['', Validators.required],
        purpose: ['', [Validators.required, Validators.maxLength(200)]],
        neededBy: [null as DateTime | null, Validators.required],
        workOrder: [null as string | null],
    });
    attachment: string | null = null;
    charged: ChargedTo = { ...this._company.placement() };
    minDate = DateTime.now().startOf('day');

    constructor(
        private _fb: FormBuilder,
        public funds: FundsService,
        public categories: CategoryService,
        private _company: CompanyService
    ) {}

    ngOnInit(): void {
        if (this.request) {
            this.form.patchValue({
                amount: this.request.amount,
                purpose: this.request.purpose,
                category: this.request.category,
                neededBy: DateTime.fromISO(this.request.neededBy),
                workOrder: this.request.workOrder,
            });
            this.attachment = this.request.attachment;
            this.charged = {
                branchId: this.request.branchId ?? this._company.byName(this.request.branch, 'branch')?.id ?? null,
                departmentId: this.request.departmentId ?? this._company.byName(this.request.department, 'department')?.id ?? null,
                branch: this.request.branch,
                department: this.request.department,
            };
        }
    }

    onFile(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        this.attachment = file ? file.name : this.attachment;
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const input = {
            amount: Number(v.amount),
            purpose: v.purpose.trim(),
            category: v.category,
            neededBy: v.neededBy.toISO(),
            workOrder: v.workOrder || null,
            attachment: this.attachment,
            ...(this.charged.branchId ? this.charged : {}),
        };
        if (this.request) {
            this.funds.update(this.request.id, input);
            this.saved.emit(this.funds.requestById().get(this.request.id));
        } else {
            this.saved.emit(this.funds.submit(input));
        }
    }
}
