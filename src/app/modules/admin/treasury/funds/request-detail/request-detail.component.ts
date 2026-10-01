import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DateTime } from 'luxon';
import { FundsService } from '../funds.service';
import {
    FundRequest,
    FundRole,
    FundTransaction,
    PAYMENT_METHODS,
    STATUS_CLASSES,
    STATUS_LABELS,
} from '../funds.types';
import { SlideOverComponent } from '../../shared/slide-over/slide-over.component';

type Mode = 'view' | 'approve' | 'reject' | 'pay';

@Component({
    selector: 'funds-request-detail',
    templateUrl: './request-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        SlideOverComponent,
    ],
})
export class RequestDetailComponent {
    @Input() request: FundRequest;
    @Input() role: FundRole = 'employee';
    @Output() closed = new EventEmitter<void>();
    @Output() edit = new EventEmitter<FundRequest>();

    readonly labels = STATUS_LABELS;
    readonly classes = STATUS_CLASSES;
    readonly methods = PAYMENT_METHODS;

    mode: Mode = 'view';
    error: string | null = null;
    maxDate = DateTime.now();

    approveForm = this._fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });
    rejectForm = this._fb.group({ reason: ['', Validators.required] });
    payForm = this._fb.group({
        fundId: ['', Validators.required],
        amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
        date: [DateTime.now(), Validators.required],
        method: ['Bank transfer', Validators.required],
        reference: [''],
    });

    constructor(
        private _fb: FormBuilder,
        public funds: FundsService
    ) {}

    get payments(): FundTransaction[] {
        return this.funds.transactions().filter((t) => t.requestId === this.request.id);
    }

    get remaining(): number {
        return this.funds.remaining(this.request);
    }

    get actor(): string {
        return this.role === 'accounts' ? 'Accounts' : this.funds.currentEmployee;
    }

    get canEmployeeEdit(): boolean {
        return this.role === 'employee' && this.request.status === 'pending';
    }

    get canReview(): boolean {
        return this.role === 'accounts' && this.request.status === 'pending';
    }

    get canPay(): boolean {
        return this.role === 'accounts' && this.remaining > 0 && ['approved', 'partially_paid'].includes(this.request.status);
    }

    fundName(id: string): string {
        return this.funds.funds().find((f) => f.id === id)?.name ?? id;
    }

    start(mode: Mode): void {
        this.error = null;
        this.mode = mode;
        if (mode === 'approve') {
            this.approveForm.reset({ amount: this.request.amount });
        } else if (mode === 'reject') {
            this.rejectForm.reset({ reason: '' });
        } else if (mode === 'pay') {
            this.payForm.reset({
                fundId: '',
                amount: this.remaining,
                date: DateTime.now(),
                method: 'Bank transfer',
                reference: '',
            });
        }
    }

    back(): void {
        this.error = null;
        this.mode = 'view';
    }

    cancelRequest(): void {
        this.funds.cancel(this.request.id);
    }

    approve(): void {
        if (this.approveForm.invalid) {
            this.approveForm.markAllAsTouched();
            return;
        }
        this._finish(this.funds.approve(this.request.id, Number(this.approveForm.value.amount), this.actor));
    }

    reject(): void {
        if (this.rejectForm.invalid) {
            this.rejectForm.markAllAsTouched();
            return;
        }
        this._finish(this.funds.reject(this.request.id, this.rejectForm.value.reason, this.actor));
    }

    pay(): void {
        if (this.payForm.invalid) {
            this.payForm.markAllAsTouched();
            return;
        }
        const v = this.payForm.getRawValue();
        this._finish(
            this.funds.recordPayment(
                this.request.id,
                {
                    fundId: v.fundId,
                    amount: Number(v.amount),
                    date: v.date.toISO(),
                    method: v.method,
                    reference: v.reference ?? '',
                },
                this.actor
            )
        );
    }

    private _finish(error: string | null): void {
        this.error = error;
        if (!error) {
            this.mode = 'view';
        }
    }
}
