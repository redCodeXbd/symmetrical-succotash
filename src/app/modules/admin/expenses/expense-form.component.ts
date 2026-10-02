import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTime } from 'luxon';
import { ProjectsService } from '../projects/projects.service';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { StoreService } from '../store/store.service';
import { VendorsService } from '../vendors/vendors.service';
import { ExpensesService } from './expenses.service';
import { shrinkImage } from './expenses.util';
import { BRANCHES, Expense, ExpenseInput, KIND_FIELDS, PAYMENT_METHODS } from './expenses.types';

/** Add or edit an expense in a drawer. The category decides which extra fields appear. */
@Component({
    selector: 'expenses-form',
    templateUrl: './expense-form.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DecimalPipe, FormsModule, MatButtonModule, SlideOverComponent],
})
export class ExpenseFormComponent implements OnInit {
    @Input() expense: Expense | null = null;
    @Input() presetCategoryId = '';
    @Output() saved = new EventEmitter<string>();
    @Output() cancelled = new EventEmitter<void>();

    readonly methods = PAYMENT_METHODS;
    readonly branches = BRANCHES;

    model: ExpenseInput = this._blank();
    error: string | null = null;
    uploadError: string | null = null;

    constructor(
        public service: ExpensesService,
        public projects: ProjectsService,
        public vendors: VendorsService,
        private _store: StoreService
    ) {}

    get kind() {
        return this.service.category(this.model.categoryId)?.kind ?? 'general';
    }

    get fields() {
        return KIND_FIELDS[this.kind];
    }

    /** What is still owed to the chosen vendor, as a hint for a payment. */
    get vendorDue(): number | null {
        return this.kind === 'vendor' && this.model.vendorId ? this.vendors.due(this.model.vendorId) : null;
    }

    get itemsTotal(): number {
        return this.model.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitCost) || 0), 0);
    }

    get needsApproval(): boolean {
        const amount = this.kind === 'purchase' && this.itemsTotal > 0 ? this.itemsTotal : Number(this.model.amount);
        return amount > this.service.autoApproveLimit();
    }

    get catalogue(): string[] {
        return this._store.products().map((p) => p.name);
    }

    ngOnInit(): void {
        if (this.expense) {
            const { id, status, approvals, rejectionReason, paid, paidAt, fundId, paymentReference, createdBy, createdAt, events, ...rest } = this.expense;
            this.model = { ...rest, meta: { ...rest.meta }, items: rest.items.map((i) => ({ ...i })), receipts: [...rest.receipts] };
        } else if (this.presetCategoryId) {
            this.model.categoryId = this.presetCategoryId;
        }
        if (this.model.items.length === 0) {
            this.model.items = [{ name: '', qty: 1, unit: 'pcs', unitCost: 0 }];
        }
    }

    setCategory(id: string): void {
        this.model.categoryId = id;
        this.model.meta = {};
    }

    /** Picking a catalogue product fills its unit. */
    pickItem(i: { name: string; unit: string }): void {
        const p = this._store.products().find((x) => x.name.toLowerCase() === i.name.toLowerCase());
        if (p) {
            i.unit = p.unit;
        }
    }

    addItem(): void {
        this.model.items = [...this.model.items, { name: '', qty: 1, unit: 'pcs', unitCost: 0 }];
    }

    removeItem(n: number): void {
        this.model.items = this.model.items.filter((_, i) => i !== n);
        if (this.model.items.length === 0) {
            this.addItem();
        }
    }

    async pickReceipts(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        input.value = '';
        this.uploadError = null;
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                this.uploadError = 'Receipts must be photos or scans (images).';
                continue;
            }
            try {
                this.model.receipts = [...this.model.receipts, { name: file.name, data: await shrinkImage(file) }];
            } catch {
                this.uploadError = `${file.name} could not be read.`;
            }
        }
    }

    removeReceipt(n: number): void {
        this.model.receipts = this.model.receipts.filter((_, i) => i !== n);
    }

    save(): void {
        const input: ExpenseInput = { ...this.model };
        const result = this.expense ? this.service.update(this.expense.id, input) : this.service.add(input);
        const error = typeof result === 'string' ? result : null;
        this.error = error;
        if (!error) {
            this.saved.emit(this.expense ? this.expense.id : (result as { id: string }).id);
        }
    }

    private _blank(): ExpenseInput {
        return {
            date: DateTime.now().toISODate(), categoryId: '', amount: 0, description: '', payee: '', vendorId: null, projectId: null,
            branch: BRANCHES[0], paymentMethod: PAYMENT_METHODS[0], meta: {}, items: [], receipts: [],
        };
    }
}
