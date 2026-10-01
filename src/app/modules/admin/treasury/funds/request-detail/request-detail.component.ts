import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DateTime } from 'luxon';
import { RoleService } from 'app/core/role/role.service';
import { OrgFundsService } from '../../org-funds/org-funds.service';
import { FundsService } from '../funds.service';
import {
    EVENT_LABELS,
    FundRequest,
    FundReturn,
    FundRole,
    FundTransaction,
    PAYMENT_METHODS,
    RETURN_STATUS_CLASSES,
    RETURN_STATUS_LABELS,
    STATUS_CLASSES,
    STATUS_LABELS,
} from '../funds.types';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { ReportDoc } from '../../shared/report.types';
import { SlideOverComponent } from '../../shared/slide-over/slide-over.component';

type Mode = 'view' | 'approve' | 'reject' | 'pay' | 'close' | 'return' | 'confirmReturn' | 'rejectReturn';

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
        ExportMenuComponent,
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
    readonly eventLabels = EVENT_LABELS;
    readonly returnLabels = RETURN_STATUS_LABELS;
    readonly returnClasses = RETURN_STATUS_CLASSES;
    activeReturnId: string | null = null;

    mode: Mode = 'view';
    error: string | null = null;
    maxDate = DateTime.now();

    approveForm = this._fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });
    rejectForm = this._fb.group({ reason: ['', Validators.required] });
    closeForm = this._fb.group({ note: [''] });
    returnForm = this._fb.group({
        amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
        method: ['Cash', Validators.required],
        reference: [''],
        note: [''],
    });
    confirmReturnForm = this._fb.group({ fundId: ['', Validators.required] });
    rejectReturnForm = this._fb.group({ reason: ['', Validators.required] });
    payForm = this._fb.group({
        category: ['', Validators.required],
        fundId: ['', Validators.required],
        amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
        date: [DateTime.now(), Validators.required],
        method: ['Bank transfer', Validators.required],
        reference: [''],
    });

    constructor(
        private _fb: FormBuilder,
        public funds: FundsService,
        public org: OrgFundsService,
        public roles: RoleService
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

    get returns(): FundReturn[] {
        return this.funds.returnsFor(this.request.id);
    }

    get returnable(): number {
        return this.funds.returnable(this.request);
    }

    private get _isOwnerEmployee(): boolean {
        return this.roles.role() === 'employee' && this.request.employee === this.funds.currentEmployee;
    }

    /** The requester or an admin can close a request that was only partly paid. */
    get canClose(): boolean {
        return this.request.status === 'partially_paid' && (this._isOwnerEmployee || this.roles.isAdmin());
    }

    /** The employee who received money can give unused money back. */
    get canReturn(): boolean {
        return this._isOwnerEmployee && this.returnable > 0 && ['paid', 'partially_paid', 'closed'].includes(this.request.status);
    }

    get canDecideReturns(): boolean {
        return this.roles.canSeeAll();
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

    /** Categories that have at least one fund a payment can be given from. */
    get categories(): string[] {
        return this.org.categories().filter((c) => this.funds.funds().some((f) => f.category === c));
    }

    get categoryFunds() {
        const category = this.payForm.value.category;
        return this.funds.funds().filter((f) => f.category === category);
    }

    onCategoryChange(): void {
        this.payForm.patchValue({ fundId: '' });
    }

    /** The request as a printable record: fields, payments and timeline. */
    detailDoc = (): ReportDoc => {
        const r = this.request;
        const money = (n: number) => `${r.currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        const day = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y');
        return {
            kind: 'detail',
            title: `Fund request ${r.id}`,
            subtitle: r.purpose,
            badge: this.labels[r.status],
            sections: [
                {
                    rows: [
                        ['Requested by', r.employee],
                        ['Company', r.company],
                        ['Requested amount', money(r.amount)],
                        ['Approved amount', r.approvedAmount === null ? 'Not approved yet' : money(r.approvedAmount)],
                        ['Paid amount', money(r.paidAmount)],
                        ['Remaining approved', money(this.remaining)],
                        ...(r.returnedAmount ? ([['Returned by employee', money(r.returnedAmount)]] as [string, string][]) : []),
                        ...(r.closedAmount ? ([['Closed with unpaid', money(r.closedAmount)]] as [string, string][]) : []),
                        ['Needed by', day(r.neededBy)],
                        ['Work order', r.workOrder || 'None'],
                        ['Attachment', r.attachment || 'None'],
                        ...(r.rejectionReason ? ([['Rejection reason', r.rejectionReason]] as [string, string][]) : []),
                    ],
                },
            ],
            tables: [
                {
                    heading: 'Payments',
                    columns: ['Transaction', 'Date', 'Method', 'Fund', 'Amount'],
                    rows: this.payments.map((t) => [t.id, day(t.date), t.method, this.fundName(t.fundId), money(t.amount)]),
                },
                {
                    heading: 'Returns',
                    columns: ['Return', 'Date', 'Method', 'Status', 'Amount'],
                    rows: this.returns.map((x) => [x.id, day(x.createdAt), x.method, RETURN_STATUS_LABELS[x.status], money(x.amount)]),
                },
                {
                    heading: 'Timeline',
                    columns: ['When', 'Event', 'By', 'Note'],
                    rows: r.events.map((e) => [
                        DateTime.fromISO(e.at).toFormat('dd MMM y, h:mm a'),
                        EVENT_LABELS[e.type],
                        e.by,
                        e.note ?? '',
                    ]),
                },
            ],
        };
    };

    fundName(id: string): string {
        const fund = this.org.funds().find((f) => f.id === id);
        return fund ? `${fund.category} · ${fund.name}` : id;
    }

    /** Opens the confirm or reject form for one pending return. */
    startReturnDecision(mode: 'confirmReturn' | 'rejectReturn', returnId: string): void {
        this.error = null;
        this.activeReturnId = returnId;
        this.mode = mode;
        this.confirmReturnForm.reset({ fundId: this._lastFundId() });
        this.rejectReturnForm.reset({ reason: '' });
    }

    /** The fund this request was last paid from, offered as the default place to receive returned money. */
    private _lastFundId(): string {
        const last = this.funds.transactions().find((t) => t.requestId === this.request.id);
        return last && this.funds.funds().some((f) => f.id === last.fundId) ? last.fundId : '';
    }

    start(mode: Mode): void {
        this.error = null;
        this.mode = mode;
        if (mode === 'approve') {
            this.approveForm.reset({ amount: this.request.amount });
        } else if (mode === 'reject') {
            this.rejectForm.reset({ reason: '' });
        } else if (mode === 'close') {
            this.closeForm.reset({ note: '' });
        } else if (mode === 'return') {
            this.returnForm.reset({ amount: this.returnable, method: 'Cash', reference: '', note: '' });
        } else if (mode === 'pay') {
            this.payForm.reset({
                category: '',
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

    closeRequest(): void {
        this._finish(this.funds.closeRequest(this.request.id, this.closeForm.value.note ?? ''));
    }

    submitReturn(): void {
        if (this.returnForm.invalid) {
            this.returnForm.markAllAsTouched();
            return;
        }
        const v = this.returnForm.getRawValue();
        this._finish(
            this.funds.requestReturn(this.request.id, {
                amount: Number(v.amount),
                method: v.method,
                reference: v.reference ?? '',
                note: v.note ?? '',
            })
        );
    }

    confirmReturn(): void {
        if (this.confirmReturnForm.invalid || !this.activeReturnId) {
            this.confirmReturnForm.markAllAsTouched();
            return;
        }
        this._finish(this.funds.confirmReturn(this.activeReturnId, this.confirmReturnForm.value.fundId));
    }

    rejectReturn(): void {
        if (this.rejectReturnForm.invalid || !this.activeReturnId) {
            this.rejectReturnForm.markAllAsTouched();
            return;
        }
        this._finish(this.funds.rejectReturn(this.activeReturnId, this.rejectReturnForm.value.reason));
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
                    category: v.category,
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
