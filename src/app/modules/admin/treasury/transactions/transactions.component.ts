import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { FundsService } from '../funds/funds.service';
import {
    EVENT_CLASSES,
    EVENT_LABELS,
    FundEventType,
    FundRequest,
    FundRole,
    PAYMENT_METHODS,
    RETURN_STATUS_CLASSES,
    RETURN_STATUS_LABELS,
} from '../funds/funds.types';
import { RequestDetailComponent } from '../funds/request-detail/request-detail.component';
import { MOVEMENT_LABELS } from '../org-funds/org-funds.types';
import { OrgFundsService } from '../org-funds/org-funds.service';
import { ExportMenuComponent } from '../shared/export-menu/export-menu.component';
import { ReportDoc } from '../shared/report.types';
import { UserSwitchComponent } from '../shared/user-switch/user-switch.component';

type Tab = 'payments' | 'returns' | 'actions' | 'movements';
type Preset = 'today' | 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_7', label: '7 days' },
    { id: 'last_30', label: '30 days' },
    { id: 'this_month', label: 'This month' },
    { id: 'last_month', label: 'Last month' },
    { id: 'this_year', label: 'This year' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' },
];

@Component({
    selector: 'treasury-transactions',
    templateUrl: './transactions.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        FormsModule,
        MatIconModule,
        ExportMenuComponent,
        UserSwitchComponent,
        RequestDetailComponent,
    ],
})
export class TransactionsComponent {
    readonly presets = PRESETS;
    readonly actionLabels = EVENT_LABELS;
    readonly actionClasses = EVENT_CLASSES;
    readonly actionTypes = Object.keys(EVENT_LABELS) as FundEventType[];
    readonly returnLabels = RETURN_STATUS_LABELS;
    readonly returnClasses = RETURN_STATUS_CLASSES;
    readonly returnStatuses = Object.keys(RETURN_STATUS_LABELS);
    readonly methods = PAYMENT_METHODS;
    readonly movementLabels = MOVEMENT_LABELS;
    readonly movementTypes = Object.keys(MOVEMENT_LABELS);

    tab = signal<Tab>('payments');
    preset = signal<Preset>('last_30');
    from = signal(DateTime.now().minus({ days: 29 }).toISODate());
    to = signal(DateTime.now().toISODate());
    search = signal('');
    employee = signal('all');
    kind = signal('all');
    selectedId = signal<string | null>(null);

    /** A role the user cannot open falls back to the first tab. */
    activeTab = computed<Tab>(() => (this.tab() === 'movements' && !this.access.can('transactions.view_movements') ? 'payments' : this.tab()));

    role = computed<FundRole>(() => (this.access.can('transactions.view_all') ? 'accounts' : 'employee'));

    /** Employees only ever get their own requests; accountants and admins get all. */
    private _requests = computed(() =>
        this.funds.requests().filter((r) => this.access.can('transactions.view_all') || r.employee === this.funds.currentEmployee)
    );
    private _requestMap = computed(() => new Map(this._requests().map((r) => [r.id, r])));

    employees = computed(() => [...new Set(this._requests().map((r) => r.employee))].sort());

    selected = computed<FundRequest | null>(() => this._requestMap().get(this.selectedId() ?? '') ?? null);

    /** The chosen period as start and end moments, or null for all time. */
    range = computed<{ start: DateTime; end: DateTime } | null>(() => {
        const now = DateTime.now();
        switch (this.preset()) {
            case 'today':
                return { start: now.startOf('day'), end: now.endOf('day') };
            case 'last_7':
                return { start: now.minus({ days: 6 }).startOf('day'), end: now.endOf('day') };
            case 'last_30':
                return { start: now.minus({ days: 29 }).startOf('day'), end: now.endOf('day') };
            case 'this_month':
                return { start: now.startOf('month'), end: now.endOf('day') };
            case 'last_month': {
                const m = now.minus({ months: 1 });
                return { start: m.startOf('month'), end: m.endOf('month') };
            }
            case 'this_year':
                return { start: now.startOf('year'), end: now.endOf('day') };
            case 'custom': {
                const start = DateTime.fromISO(this.from());
                const end = DateTime.fromISO(this.to());
                return start.isValid && end.isValid ? { start: start.startOf('day'), end: end.endOf('day') } : null;
            }
            default:
                return null;
        }
    });

    rangeError = computed(() => {
        if (this.preset() !== 'custom') {
            return null;
        }
        const r = this.range();
        return !r ? 'Choose both dates.' : r.start > r.end ? 'The start date is after the end date.' : null;
    });

    rangeLabel = computed(() => {
        const r = this.range();
        if (!r) {
            return this.preset() === 'all' ? 'All time' : 'Choose a valid date range';
        }
        return `${r.start.toFormat('dd MMM y')} to ${r.end.toFormat('dd MMM y')}`;
    });

    scopeLabel = computed(() =>
        this.access.can('transactions.view_movements') ? 'All data' : this.access.can('transactions.view_all') ? 'All fund transactions and actions' : 'Your transactions and actions only'
    );

    payments = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.funds
            .transactions()
            .filter((t) => this._requestMap().has(t.requestId) && this._inRange(t.date))
            .map((t) => ({ t, r: this._requestMap().get(t.requestId)!, fund: this.org.funds().find((f) => f.id === t.fundId) }))
            .filter(
                ({ t, r, fund }) =>
                    (this.employee() === 'all' || r.employee === this.employee()) &&
                    (this.kind() === 'all' || t.method === this.kind()) &&
                    (!q || [t.id, t.requestId, r.purpose, r.employee, t.reference, fund?.name ?? ''].some((v) => v.toLowerCase().includes(q)))
            )
            .sort((a, b) => b.t.date.localeCompare(a.t.date));
    });

    /** Money employees gave back, with whether it has been confirmed. */
    returns = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.funds
            .returns()
            .filter((x) => this._requestMap().has(x.requestId) && this._inRange(x.createdAt))
            .map((x) => ({ x, r: this._requestMap().get(x.requestId)!, fund: this.org.funds().find((f) => f.id === x.fundId) }))
            .filter(
                ({ x, r }) =>
                    (this.employee() === 'all' || r.employee === this.employee()) &&
                    (this.kind() === 'all' || x.status === this.kind()) &&
                    (!q || [x.id, x.requestId, r.purpose, r.employee, x.reference, x.note].some((v) => v.toLowerCase().includes(q)))
            )
            .sort((a, b) => b.x.createdAt.localeCompare(a.x.createdAt));
    });

    actions = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this._requests()
            .flatMap((r) => r.events.map((e) => ({ e, r })))
            .filter(
                ({ e, r }) =>
                    this._inRange(e.at) &&
                    (this.employee() === 'all' || r.employee === this.employee()) &&
                    (this.kind() === 'all' || e.type === this.kind()) &&
                    (!q || [r.id, r.purpose, r.employee, e.by, e.note ?? '', EVENT_LABELS[e.type]].some((v) => v.toLowerCase().includes(q)))
            )
            .sort((a, b) => b.e.at.localeCompare(a.e.at));
    });

    /** Every treasury movement, including deposits and transfers. Admin only. */
    movements = computed(() => {
        if (!this.access.can('transactions.view_movements')) {
            return [];
        }
        const q = this.search().trim().toLowerCase();
        const funds = new Map(this.org.funds().map((f) => [f.id, f]));
        return this.org
            .movements()
            .filter(
                (m) =>
                    this._inRange(m.date) &&
                    (this.kind() === 'all' || m.type === this.kind()) &&
                    (!q || [m.reference, m.description, funds.get(m.fundId)?.name ?? '', m.by].some((v) => v.toLowerCase().includes(q)))
            )
            .map((m) => ({ m, fund: funds.get(m.fundId) }))
            .sort((a, b) => b.m.date.localeCompare(a.m.date));
    });

    totalPaid = computed(() => this.payments().reduce((sum, p) => sum + p.t.amount, 0));

    constructor(
        public funds: FundsService,
        public access: AccessService,
        public org: OrgFundsService,
        private _router: Router
    ) {}

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.kind.set('all');
        this.search.set('');
    }

    setPreset(preset: Preset): void {
        this.preset.set(preset);
    }

    openRequest(id: string): void {
        this.selectedId.set(id);
    }

    /** Editing happens on the Funds page. */
    goToFunds(): void {
        this._router.navigate(['/treasury/funds']);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Downloads and share links: the report matches what is on screen
    // -----------------------------------------------------------------------------------------------------

    doc = (): ReportDoc => {
        const subtitle = `${this.scopeLabel()} · ${this.rangeLabel()}`;
        const all = this.access.can('transactions.view_all');
        const day = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y');
        const time = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y, h:mm a');

        if (this.activeTab() === 'actions') {
            return {
                kind: 'table',
                title: all ? 'Fund actions' : 'My fund actions',
                subtitle,
                columns: [
                    { header: 'When' }, { header: 'Request' }, { header: 'Purpose' },
                    ...(all ? [{ header: 'Employee' }] : []),
                    { header: 'Action' }, { header: 'By' }, { header: 'Note' },
                ],
                rows: this.actions().map(({ e, r }) => [
                    time(e.at), r.id, r.purpose, ...(all ? [r.employee] : []), EVENT_LABELS[e.type], e.by, e.note ?? '',
                ]),
            };
        }
        if (this.activeTab() === 'returns') {
            const rows = this.returns();
            return {
                kind: 'table',
                title: all ? 'Fund returns' : 'My fund returns',
                subtitle,
                columns: [
                    { header: 'Return' }, { header: 'Date' }, { header: 'Request' },
                    ...(all ? [{ header: 'Employee' }] : []),
                    { header: 'Method' }, { header: 'Reference' }, { header: 'Status' }, { header: 'Received into' },
                    { header: `Amount (${this.funds.currency})`, format: 'number' },
                ],
                rows: rows.map(({ x, r, fund }) => [
                    x.id, day(x.createdAt), r.id, ...(all ? [r.employee] : []), x.method, x.reference || '-',
                    RETURN_STATUS_LABELS[x.status], fund ? fund.name : '-', x.amount,
                ]),
            };
        }
        if (this.activeTab() === 'movements') {
            const rows = this.movements();
            return {
                kind: 'table',
                title: 'Treasury movements',
                subtitle,
                columns: [
                    { header: 'Date' }, { header: 'Company' }, { header: 'Fund' }, { header: 'Category' }, { header: 'Type' },
                    { header: 'Reference' }, { header: 'Description' }, { header: 'Recorded by' },
                    { header: 'Amount', format: 'number' },
                ],
                rows: rows.map(({ m, fund }) => [
                    day(m.date), fund?.company ?? '', fund?.name ?? '', fund?.category ?? '', MOVEMENT_LABELS[m.type],
                    m.reference, m.description, m.by, m.direction === 'in' ? m.amount : -m.amount,
                ]),
            };
        }
        const rows = this.payments();
        const columns = [
            { header: 'Transaction' }, { header: 'Date' }, { header: 'Request' }, { header: 'Purpose' },
            ...(all ? [{ header: 'Employee' }] : []),
            { header: 'Fund' }, { header: 'Method' }, { header: 'Reference' },
            { header: `Amount (${this.funds.currency})`, format: 'number' as const },
        ];
        return {
            kind: 'table',
            title: all ? 'Fund transactions' : 'My fund transactions',
            subtitle,
            columns,
            rows: rows.map(({ t, r, fund }) => [
                t.id, day(t.date), r.id, r.purpose, ...(all ? [r.employee] : []),
                fund ? `${fund.category} · ${fund.name}` : t.fundId, t.method, t.reference || '-', t.amount,
            ]),
            footer: ['Total', ...columns.slice(1, -1).map(() => ''), this.totalPaid()],
        };
    };

    private _inRange(iso: string): boolean {
        const r = this.range();
        if (!r) {
            return this.preset() === 'all';
        }
        const d = DateTime.fromISO(iso);
        return d >= r.start && d <= r.end;
    }
}
