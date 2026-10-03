import { ConfirmService } from 'app/core/confirm/confirm.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { OrgFundsService } from '../../org-funds/org-funds.service';
import { FundsService } from '../funds.service';
import {
    EVENT_LABELS,
    FundRequest,
    FundReturn,
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
        public access: AccessService,
        private _confirm: ConfirmService
    ) {}

    get payments(): FundTransaction[] {
        return this.funds.transactions().filter((t) => t.requestId === this.request.id);
    }

    get remaining(): number {
        return this.funds.remaining(this.request);
    }

    get returns(): FundReturn[] {
        return this.funds.returnsFor(this.request.id);
    }

    get returnable(): number {
        return this.funds.returnable(this.request);
    }

    private get _isOwner(): boolean {
        return this.request.employee === this.funds.currentEmployee;
    }

    /** The requester (with "close own") or anyone with "close any" can close a partly paid request. */
    get canClose(): boolean {
        return this.funds.canClose(this.request);
    }

    /** The employee who received money can give unused money back. */
    get canReturn(): boolean {
        return (
            this.access.can('fund-requests.return') &&
            this._isOwner &&
            this.returnable > 0 &&
            ['paid', 'partially_paid', 'closed'].includes(this.request.status)
        );
    }

    get canDecideReturns(): boolean {
        return this.access.can('fund-requests.confirm_return');
    }

    get canEmployeeEdit(): boolean {
        return this.access.can('fund-requests.edit') && this._isOwner && this.request.status === 'pending';
    }

    /** Whether the acting user is the next approver in this request's approval path. */
    get canReview(): boolean {
        return this.funds.canApprove(this.request);
    }

    /** Who the request is waiting on, when the acting user is not that approver. */
    get waitingFor(): string | null {
        const step = this.funds.currentStep(this.request);
        return step && !this.canReview ? step.roleName : null;
    }

    get isLastStep(): boolean {
        const step = this.funds.currentStep(this.request);
        return !!step && this.request.approvals[this.request.approvals.length - 1] === step;
    }

    get canPay(): boolean {
        return this.access.can('fund-requests.pay') && this.remaining > 0 && ['approved', 'partially_paid'].includes(this.request.status);
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
                        ['Category', r.category],
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

    private _facts(extra: [string, string][] = []): [string, string][] {
        return [['Request', this.request.id], ['Employee', this.request.employee], ...extra];
    }

    async closeRequest(): Promise<void> {
        const ok = await this._confirm.ask({ title: 'Close this request?', message: 'The unpaid part of the approved amount is released and no more payments can be made.', tone: 'warning', icon: 'heroicons_outline:lock-closed', confirmLabel: 'Yes, close request', details: this._facts([['Paid so far', `BDT ${this.request.paidAmount.toLocaleString('en-US')}`]]) });
        if (!ok) {
            return;
        }
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

    async confirmReturn(): Promise<void> {
        if (this.confirmReturnForm.invalid || !this.activeReturnId) {
            this.confirmReturnForm.markAllAsTouched();
            return;
        }
        const ok = await this._confirm.ask({ title: 'Confirm the money received?', message: 'It is added to the chosen fund and the employee\'s balance is reduced.', tone: 'success', icon: 'heroicons_outline:check-circle', confirmLabel: 'Yes, confirm received', details: this._facts() });
        if (!ok) {
            return;
        }
        this._finish(this.funds.confirmReturn(this.activeReturnId, this.confirmReturnForm.value.fundId));
    }

    async rejectReturn(): Promise<void> {
        if (this.rejectReturnForm.invalid || !this.activeReturnId) {
            this.rejectReturnForm.markAllAsTouched();
            return;
        }
        const ok = await this._confirm.ask({ title: 'Reject this return?', message: 'The employee is told the money was not accepted.', tone: 'danger', icon: 'heroicons_outline:x-circle', confirmLabel: 'Yes, reject return', details: [...this._facts(), ['Reason', this.rejectReturnForm.value.reason || '-']] });
        if (!ok) {
            return;
        }
        this._finish(this.funds.rejectReturn(this.activeReturnId, this.rejectReturnForm.value.reason));
    }

    async cancelRequest(): Promise<void> {
        const ok = await this._confirm.ask({ title: 'Cancel this request?', message: 'The request is withdrawn and will not be approved or paid.', tone: 'danger', icon: 'heroicons_outline:x-circle', confirmLabel: 'Yes, cancel request', cancelLabel: 'Keep it', details: this._facts([['Amount', `BDT ${this.request.amount.toLocaleString('en-US')}`]]) });
        if (!ok) {
            return;
        }
        this.funds.cancel(this.request.id);
    }

    async approve(): Promise<void> {
        if (this.approveForm.invalid) {
            this.approveForm.markAllAsTouched();
            return;
        }
        const ok = await this._confirm.ask({ title: 'Approve this request?', message: 'Your approval is recorded with your name. The last step sets the approved amount.', tone: 'success', icon: 'heroicons_outline:check-circle', confirmLabel: 'Yes, approve', details: this._facts([['Amount', `BDT ${Number(this.approveForm.value.amount).toLocaleString('en-US')}`]]) });
        if (!ok) {
            return;
        }
        this._finish(this.funds.approve(this.request.id, Number(this.approveForm.value.amount)));
    }

    async reject(): Promise<void> {
        if (this.rejectForm.invalid) {
            this.rejectForm.markAllAsTouched();
            return;
        }
        const ok = await this._confirm.ask({ title: 'Reject this request?', message: 'It stops here and the employee is told why.', tone: 'danger', icon: 'heroicons_outline:x-circle', confirmLabel: 'Yes, reject', details: [...this._facts(), ['Reason', this.rejectForm.value.reason || '-']] });
        if (!ok) {
            return;
        }
        this._finish(this.funds.reject(this.request.id, this.rejectForm.value.reason));
    }

    async pay(): Promise<void> {
        if (this.payForm.invalid) {
            this.payForm.markAllAsTouched();
            return;
        }
        const v = this.payForm.getRawValue();
        const ok = await this._confirm.ask({ title: 'Record this payment?', message: 'The money is taken from the chosen fund and added to the amount paid.', tone: 'warning', icon: 'heroicons_outline:banknotes', confirmLabel: 'Yes, record payment', details: this._facts([['Amount', `BDT ${Number(v.amount).toLocaleString('en-US')}`], ['Method', v.method]]) });
        if (!ok) {
            return;
        }
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
                }
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
