import { ConfirmService } from 'app/core/confirm/confirm.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Component, computed, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../projects/projects.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { ExportMenuComponent } from '../treasury/shared/export-menu/export-menu.component';
import { ReportDoc } from '../treasury/shared/report.types';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { CompanyService } from '../settings/company/company.service';
import { ExpenseDetailComponent } from './expense-detail.component';
import { ExpenseFormComponent } from './expense-form.component';
import { ExpensesService } from './expenses.service';
import { Expense, STATUS_CLASSES, STATUS_LABELS } from './expenses.types';

type Range = 'this_month' | 'last_30' | 'this_year' | 'all' | 'custom';

@Component({
    selector: 'expenses-page',
    templateUrl: './expenses.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, AddButtonComponent, ExportMenuComponent, SlideOverComponent, UserSwitchComponent, ExpenseDetailComponent, ExpenseFormComponent],
})
export class ExpensesComponent {
    readonly statusLabels = STATUS_LABELS;
    readonly statusClasses = STATUS_CLASSES;
    readonly ranges: { id: Range; label: string }[] = [
        { id: 'this_month', label: 'This month' },
        { id: 'last_30', label: 'Last 30 days' },
        { id: 'this_year', label: 'This year' },
        { id: 'all', label: 'All time' },
        { id: 'custom', label: 'Custom dates' },
    ];

    // Filters
    search = signal('');
    range = signal<Range>('last_30');
    from = signal(DateTime.now().minus({ days: 30 }).toISODate());
    to = signal(DateTime.now().toISODate());
    categoryFilter = signal('all');
    statusFilter = signal<'all' | 'pending' | 'approved' | 'rejected' | 'unpaid'>('all');
    projectFilter = signal('all');
    unitFilter = signal('all');
    limit = signal(50);

    // Drawers
    selectedId = signal<string | null>(null);
    formOpen = signal(false);
    editing = signal<Expense | null>(null);
    settingsOpen = signal(false);
    toast = signal<string | null>(null);

    // Quick entry
    quick = this._blankQuick();
    quickError: string | null = null;
    @ViewChild('quickAmount') quickAmount?: { nativeElement: HTMLInputElement };

    // Settings
    settingsMessage: { text: string; ok: boolean } | null = null;
    limitDraft: number | null = null;

    constructor(
        public service: ExpensesService,
        public access: AccessService,
        public projects: ProjectsService,
        public company: CompanyService,
        private _confirm: ConfirmService
    ) {
        this.limitDraft = this.service.autoApproveLimit();
    }

    private _bounds = computed(() => {
        const now = DateTime.now();
        switch (this.range()) {
            case 'this_month':
                return [now.startOf('month').toISODate(), now.toISODate()];
            case 'last_30':
                return [now.minus({ days: 30 }).toISODate(), now.toISODate()];
            case 'this_year':
                return [now.startOf('year').toISODate(), now.toISODate()];
            case 'custom':
                return [this.from(), this.to()];
            default:
                return ['0000-01-01', '9999-12-31'];
        }
    });

    inRange = computed(() => {
        const [a, b] = this._bounds();
        return this.service.expenses().filter((e) => e.date >= a && e.date <= b);
    });

    /** The rows shown, after every filter. */
    rows = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.inRange()
            .filter(
                (e) =>
                    (this.categoryFilter() === 'all' || e.categoryId === this.categoryFilter()) &&
                    (this.projectFilter() === 'all' || e.projectId === this.projectFilter()) &&
                    (this.unitFilter() === 'all' || this.company.unitIdsOf(e).includes(this.unitFilter())) &&
                    (this.statusFilter() === 'all' ||
                        (this.statusFilter() === 'unpaid' ? e.status === 'approved' && !e.paid : e.status === this.statusFilter())) &&
                    (!q || [e.id, e.description, e.payee, e.createdBy, this.service.categoryName(e.categoryId)].some((v) => v.toLowerCase().includes(q)))
            )
            .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    });

    shown = computed(() => this.rows().slice(0, this.limit()));
    total = computed(() => this.rows().reduce((s, e) => s + e.amount, 0));
    spentInRange = computed(() => this.inRange().filter((e) => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0));
    pending = computed(() => this.service.expenses().filter((e) => e.status === 'pending'));
    pendingTotal = computed(() => this.pending().reduce((s, e) => s + e.amount, 0));
    toPay = computed(() => this.service.expenses().filter((e) => e.status === 'approved' && !e.paid));

    /** Spending per category inside the chosen dates, biggest first, for the bar chart. */
    byCategory = computed(() => {
        const sums = new Map<string, number>();
        for (const e of this.inRange().filter((x) => x.status !== 'rejected')) {
            sums.set(e.categoryId, (sums.get(e.categoryId) ?? 0) + e.amount);
        }
        const total = [...sums.values()].reduce((s, n) => s + n, 0);
        const max = Math.max(...sums.values(), 1);
        return [...sums.entries()]
            .map(([id, amount]) => ({ category: this.service.category(id)!, amount, share: total ? (amount / total) * 100 : 0, bar: (amount / max) * 100 }))
            .filter((x) => x.category)
            .sort((a, b) => b.amount - a.amount);
    });

    topCategory = computed(() => this.byCategory()[0] ?? null);
    selected = computed(() => this.service.expenses().find((e) => e.id === this.selectedId()) ?? null);

    // -----------------------------------------------------------------------------------------------------
    // @ Quick entry: date, category, amount and a few words. Enter saves it and gets ready for the next one.
    // -----------------------------------------------------------------------------------------------------

    addQuick(): void {
        const q = this.quick;
        const result = this.service.add({
            date: q.date, categoryId: q.categoryId, amount: Number(q.amount), description: q.description, payee: '', vendorId: null,
            projectId: q.projectId || null, branch: this.company.placement().branch || 'Head Office', branchId: this.company.placement().branchId, departmentId: this.company.placement().departmentId, paymentMethod: 'Cash', meta: {}, items: [], receipts: [],
        });
        if (typeof result === 'string') {
            this.quickError = result;
            return;
        }
        this.quickError = null;
        this._toast(`${result.id} saved`);
        this.quick = { ...this._blankQuick(), date: q.date, categoryId: q.categoryId };
        setTimeout(() => this.quickAmount?.nativeElement.focus());
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Drawers and filters
    // -----------------------------------------------------------------------------------------------------

    openForm(expense: Expense | null = null): void {
        this.editing.set(expense);
        this.selectedId.set(null);
        this.formOpen.set(true);
    }

    formSaved(id: string): void {
        this.formOpen.set(false);
        this.editing.set(null);
        this.selectedId.set(id);
    }

    toggleCategory(id: string): void {
        this.categoryFilter.set(this.categoryFilter() === id ? 'all' : id);
        this.limit.set(50);
    }

    clearFilters(): void {
        this.search.set('');
        this.categoryFilter.set('all');
        this.statusFilter.set('all');
        this.projectFilter.set('all');
        this.unitFilter.set('all');
    }

    get filtersActive(): boolean {
        return !!this.search() || this.categoryFilter() !== 'all' || this.statusFilter() !== 'all' || this.projectFilter() !== 'all' || this.unitFilter() !== 'all';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Settings
    // -----------------------------------------------------------------------------------------------------

    async saveLimit(): Promise<void> {
        const ok = await this._confirm.ask({
            title: 'Change the no-approval limit?',
            message: 'Expenses up to this amount are approved as soon as they are saved. Larger ones go to the approval tree.',
            tone: 'warning',
            icon: 'heroicons_outline:adjustments-horizontal',
            confirmLabel: 'Yes, change limit',
            details: [['New limit', `BDT ${Number(this.limitDraft ?? 0).toLocaleString('en-US')}`]],
        });
        if (!ok) {
            return;
        }
        const error = this.service.setAutoApproveLimit(Number(this.limitDraft ?? 0));
        this.settingsMessage = error ? { text: error, ok: false } : { text: 'Limit saved.', ok: true };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Export
    // -----------------------------------------------------------------------------------------------------

    doc = (): ReportDoc => {
        const ranges = Object.fromEntries(this.ranges.map((r) => [r.id, r.label]));
        const [a, b] = this._bounds();
        const when = this.range() === 'custom' ? `${a} to ${b}` : ranges[this.range()];
        const cat = this.categoryFilter() === 'all' ? 'All categories' : this.service.categoryName(this.categoryFilter());
        return {
            kind: 'table',
            title: 'Expenses',
            subtitle: `${when} · ${cat}${this.search().trim() ? ` · search "${this.search().trim()}"` : ''}`,
            columns: [
                { header: 'Date' }, { header: 'ID' }, { header: 'Category' }, { header: 'Details' }, { header: 'Project' },
                { header: 'Status' }, { header: 'Paid' }, { header: 'Entered by' }, { header: 'Amount (BDT)', format: 'number' as const },
            ],
            rows: this.rows().map((e) => [
                DateTime.fromISO(e.date).toFormat('dd MMM y'), e.id, this.service.categoryName(e.categoryId), e.description || e.payee,
                e.projectId ? this.projects.name(e.projectId) : '', STATUS_LABELS[e.status], e.paid ? 'Paid' : 'Not paid', e.createdBy, e.amount,
            ]),
            footer: ['', '', '', '', '', '', '', 'Total', this.total()],
        };
    };

    projectName(id: string | null): string {
        return id ? this.projects.name(id) : '';
    }

    private _blankQuick() {
        return { date: DateTime.now().toISODate(), categoryId: '', amount: null as number | null, description: '', projectId: '' };
    }

    private _toast(text: string): void {
        this.toast.set(text);
        setTimeout(() => this.toast.set(null), 3000);
    }
}
