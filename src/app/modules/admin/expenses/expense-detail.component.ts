import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../projects/projects.service';
import { StoreService } from '../store/store.service';
import { ExportMenuComponent } from '../treasury/shared/export-menu/export-menu.component';
import { ReportDoc } from '../treasury/shared/report.types';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { VendorsService } from '../vendors/vendors.service';
import { ExpensesService } from './expenses.service';
import { Expense, KIND_FIELDS, PAYMENT_METHODS, STATUS_CLASSES, STATUS_LABELS } from './expenses.types';

type Mode = 'view' | 'reject' | 'pay';

@Component({
    selector: 'expenses-detail',
    templateUrl: './expense-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, ExportMenuComponent, SlideOverComponent],
})
export class ExpenseDetailComponent {
    @Input({ required: true }) expense: Expense;
    @Output() closed = new EventEmitter<void>();
    @Output() edit = new EventEmitter<Expense>();

    readonly labels = STATUS_LABELS;
    readonly classes = STATUS_CLASSES;
    readonly methods = PAYMENT_METHODS;

    mode: Mode = 'view';
    error: string | null = null;
    rejectReason = '';
    pay = { fundId: '', method: 'Cash', reference: '', date: DateTime.now().toISODate() };
    preview: string | null = null;

    constructor(
        public service: ExpensesService,
        public access: AccessService,
        private _projects: ProjectsService,
        private _vendors: VendorsService,
        private _store: StoreService
    ) {}

    get category() {
        return this.service.category(this.expense.categoryId);
    }

    get metaRows(): [string, string][] {
        const fields = KIND_FIELDS[this.category?.kind ?? 'general'];
        return fields.filter((f) => this.expense.meta[f.key]).map((f) => [f.label, this.expense.meta[f.key]] as [string, string]);
    }

    get project(): string {
        return this.expense.projectId ? this._projects.name(this.expense.projectId) : '';
    }

    get vendor(): string {
        return this.expense.vendorId ? (this._vendors.vendor(this.expense.vendorId)?.name ?? this.expense.vendorId) : '';
    }

    get fundName(): string {
        return this.service.fundOptions().find((f) => f.id === this.expense.fundId)?.name ?? this.expense.fundId ?? '';
    }

    get waitingFor(): string | null {
        const step = this.service.currentStep(this.expense);
        return step && !this.service.canApprove(this.expense) ? step.roleName : null;
    }

    get isLastStep(): boolean {
        return this.expense.approvals.findIndex((s) => s.status === 'pending') === this.expense.approvals.length - 1;
    }

    get stocked(): boolean {
        return this._store.stockedRefs().has(this.expense.id);
    }

    get canReceive(): boolean {
        return this.category?.kind === 'purchase' && this.expense.status === 'approved' && !this.stocked && this.access.can('store.receive');
    }

    get canPay(): boolean {
        return this.access.can('expenses.pay') && this.expense.status === 'approved' && !this.expense.paid;
    }

    get funds() {
        return this.service.fundOptions();
    }

    start(mode: Mode): void {
        this.error = null;
        this.mode = mode;
        if (mode === 'pay') {
            this.pay = { fundId: '', method: this.expense.paymentMethod, reference: '', date: DateTime.now().toISODate() };
        }
    }

    back(): void {
        this.error = null;
        this.mode = 'view';
    }

    approve(): void {
        this._finish(this.service.approve(this.expense.id));
    }

    reject(): void {
        this._finish(this.service.reject(this.expense.id, this.rejectReason));
    }

    submitPay(): void {
        this._finish(this.service.pay(this.expense.id, { fundId: this.pay.fundId || null, method: this.pay.method, reference: this.pay.reference, date: this.pay.date }));
    }

    remove(): void {
        const error = this.service.delete(this.expense.id);
        this.error = error;
        if (!error) {
            this.closed.emit();
        }
    }

    /** The expense as a printable record. */
    detailDoc = (): ReportDoc => {
        const e = this.expense;
        const money = (n: number) => `BDT ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        return {
            kind: 'detail',
            title: `Expense ${e.id}`,
            subtitle: e.description || e.payee,
            badge: STATUS_LABELS[e.status],
            sections: [
                {
                    rows: [
                        ['Category', this.category?.name ?? ''],
                        ['Date', DateTime.fromISO(e.date).toFormat('dd MMM y')],
                        ['Amount', money(e.amount)],
                        ['Paid to', e.payee || this.vendor || '-'],
                        ['Project', this.project || '-'],
                        ['Branch', e.branch],
                        ...this.metaRows,
                        ['Payment', e.paid ? `Paid by ${e.paymentMethod}${this.fundName ? ` from ${this.fundName}` : ''}` : 'Not paid yet'],
                        ['Entered by', e.createdBy],
                    ],
                },
            ],
            tables: [
                ...(e.items.length
                    ? [{ heading: 'Items', columns: ['Item', 'Qty', 'Unit cost', 'Amount'], rows: e.items.map((i) => [i.name, `${i.qty} ${i.unit}`, money(i.unitCost), money(i.qty * i.unitCost)]) }]
                    : []),
                { heading: 'Timeline', columns: ['When', 'Event', 'By', 'Note'], rows: e.events.map((x) => [DateTime.fromISO(x.at).toFormat('dd MMM y, h:mm a'), x.title, x.by, x.note ?? '']) },
            ],
        };
    };

    private _finish(error: string | null): void {
        this.error = error;
        if (!error) {
            this.mode = 'view';
        }
    }
}
