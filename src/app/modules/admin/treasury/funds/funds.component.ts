import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DateTime } from 'luxon';
import { RoleService } from 'app/core/role/role.service';
import { RoleSwitchComponent } from '../shared/role-switch/role-switch.component';
import { FundsService } from './funds.service';
import { FundRequest, FundRequestStatus, FundRole, STATUS_CLASSES, STATUS_LABELS } from './funds.types';
import { AddButtonComponent } from '../shared/add-button/add-button.component';
import { ExportMenuComponent } from '../shared/export-menu/export-menu.component';
import { ReportDoc } from '../shared/report.types';
import { RequestDetailComponent } from './request-detail/request-detail.component';
import { RequestFormComponent } from './request-form/request-form.component';

type Tab = 'requests' | 'transactions';
type Range = 'this_month' | 'last_30' | 'all';

@Component({
    selector: 'treasury-funds',
    templateUrl: './funds.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        ExportMenuComponent,
        RoleSwitchComponent,
        RequestDetailComponent,
        RequestFormComponent,
        AddButtonComponent,
    ],
})
export class FundsComponent {
    readonly labels = STATUS_LABELS;
    readonly classes = STATUS_CLASSES;
    readonly statuses = Object.keys(STATUS_LABELS) as FundRequestStatus[];

    /** Preview switch between the two audiences; real permissions will drive this later. */
    role = computed<FundRole>(() => (this.roles.canSeeAll() ? 'accounts' : 'employee'));
    tab = signal<Tab>('requests');
    search = signal('');
    status = signal<'all' | FundRequestStatus>('all');
    range = signal<Range>('last_30');

    selectedId = signal<string | null>(null);
    formOpen = signal(false);
    editing = signal<FundRequest | null>(null);

    selected = computed(() => this.funds.requests().find((r) => r.id === this.selectedId()) ?? null);

    /** Requests the current audience is allowed to see. */
    scopedRequests = computed(() =>
        this.funds
            .requests()
            .filter((r) => this.role() === 'accounts' || r.employee === this.funds.currentEmployee)
    );

    scopedTransactions = computed(() => {
        const ids = new Set(this.scopedRequests().map((r) => r.id));
        return this.funds.transactions().filter((t) => ids.has(t.requestId));
    });

    requests = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.scopedRequests().filter(
            (r) =>
                (this.status() === 'all' || r.status === this.status()) &&
                this._inRange(r.submittedAt) &&
                (!q || [r.id, r.purpose, r.employee].some((v) => v.toLowerCase().includes(q)))
        );
    });

    transactions = computed(() => {
        const q = this.search().trim().toLowerCase();
        const requests = this.funds.requestById();
        return this.scopedTransactions().filter(
            (t) =>
                this._inRange(t.date) &&
                (!q ||
                    [t.id, t.requestId, t.reference, requests.get(t.requestId)?.purpose ?? ''].some((v) =>
                        v.toLowerCase().includes(q)
                    ))
        );
    });

    awaitingApproval = computed(() => this.scopedRequests().filter((r) => r.status === 'pending'));
    awaitingPayment = computed(() =>
        this.scopedRequests().filter((r) => r.status === 'approved' || r.status === 'partially_paid')
    );
    receivedThisMonth = computed(() => {
        const start = DateTime.now().startOf('month');
        return this.scopedTransactions().filter((t) => DateTime.fromISO(t.date) >= start);
    });

    awaitingApprovalTotal = computed(() => this._sum(this.awaitingApproval().map((r) => r.amount)));
    awaitingPaymentTotal = computed(() =>
        this._sum(this.awaitingPayment().map((r) => this.funds.remaining(r)))
    );
    receivedTotal = computed(() => this._sum(this.receivedThisMonth().map((t) => t.amount)));

    // -----------------------------------------------------------------------------------------------------
    // @ Employee wallet: money this employee has received from funds
    // -----------------------------------------------------------------------------------------------------

    private _ownPayments = computed(() => {
        const ids = new Set(
            this.funds
                .requests()
                .filter((r) => r.employee === this.funds.currentEmployee)
                .map((r) => r.id)
        );
        return this.funds.transactions().filter((t) => ids.has(t.requestId));
    });

    walletTotal = computed(() => this._sum(this._ownPayments().map((t) => t.amount)));
    /** Money the employee gave back that Accounts or Admin confirmed. */
    walletReturned = computed(() =>
        this._sum(
            this.funds
                .requests()
                .filter((r) => r.employee === this.funds.currentEmployee)
                .map((r) => r.returnedAmount)
        )
    );
    walletHolding = computed(() => this.walletTotal() - this.walletReturned());
    walletCount = computed(() => this._ownPayments().length);
    walletLast = computed(
        () => [...this._ownPayments()].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    );

    /** Where the money came from, by fund category. */
    walletCategories = computed(() => {
        const totals = new Map<string, number>();
        for (const t of this._ownPayments()) {
            const name = this.funds.fundCategory(t.fundId);
            totals.set(name, (totals.get(name) ?? 0) + t.amount);
        }
        return [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    });

    /** Received per month for the last six months, with bar heights relative to the biggest month. */
    walletMonths = computed(() => {
        const months = Array.from({ length: 6 }, (_, i) => DateTime.now().startOf('month').minus({ months: 5 - i }));
        const totals = months.map((m) =>
            this._sum(
                this._ownPayments()
                    .filter((t) => DateTime.fromISO(t.date).hasSame(m, 'month'))
                    .map((t) => t.amount)
            )
        );
        const max = Math.max(...totals, 1);
        return months.map((m, i) => ({
            label: m.toFormat('LLL'),
            total: totals[i],
            pct: Math.round((totals[i] / max) * 100),
        }));
    });

    /** Plain-text version of the chart for screen readers. */
    walletSummary(): string {
        return this.walletMonths()
            .map((m) => `${m.label} ${this._sum([m.total]).toLocaleString('en-US')}`)
            .join(', ');
    }

    constructor(
        public funds: FundsService,
        public roles: RoleService
    ) {}

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.search.set('');
    }

    openNew(): void {
        this.editing.set(null);
        this.formOpen.set(true);
    }

    openEdit(request: FundRequest): void {
        this.editing.set(request);
        this.formOpen.set(true);
    }

    onSaved(request: FundRequest): void {
        this.formOpen.set(false);
        this.editing.set(null);
        this.selectedId.set(request.id);
    }

    openRequest(id: string): void {
        this.selectedId.set(id);
    }

    /** Statement of the transactions currently listed, with the active filters in the subtitle. */
    transactionsDoc = (): ReportDoc => {
        const accounts = this.role() === 'accounts';
        const requests = this.funds.requestById();
        const rows = this.transactions();
        const ranges = { this_month: 'This month', last_30: 'Last 30 days', all: 'All time' };
        const columns = [
            { header: 'Transaction' },
            { header: 'Date' },
            { header: 'Request' },
            { header: 'Purpose' },
            ...(accounts ? [{ header: 'Employee' }] : []),
            { header: 'Method' },
            { header: 'Reference' },
            { header: `Amount (${this.funds.currency})`, format: 'number' as const },
        ];
        return {
            kind: 'table',
            title: accounts ? 'Fund transactions' : 'My fund transactions',
            subtitle: `${ranges[this.range()]}${this.search().trim() ? ` · search "${this.search().trim()}"` : ''}`,
            columns,
            rows: rows.map((t) => {
                const r = requests.get(t.requestId);
                return [
                    t.id,
                    DateTime.fromISO(t.date).toFormat('dd MMM y'),
                    t.requestId,
                    r?.purpose ?? '',
                    ...(accounts ? [r?.employee ?? ''] : []),
                    t.method,
                    t.reference || '-',
                    t.amount,
                ];
            }),
            footer: [
                'Total',
                ...columns.slice(1, -1).map(() => ''),
                this._sum(rows.map((t) => t.amount)),
            ],
        };
    };

    private _sum(values: number[]): number {
        return values.reduce((a, b) => a + b, 0);
    }

    private _inRange(iso: string): boolean {
        const date = DateTime.fromISO(iso);
        switch (this.range()) {
            case 'this_month':
                return date >= DateTime.now().startOf('month');
            case 'last_30':
                return date >= DateTime.now().minus({ days: 30 }).startOf('day');
            default:
                return true;
        }
    }
}
