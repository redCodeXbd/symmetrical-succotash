import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DateTime } from 'luxon';
import { FundsService } from '../funds/funds.service';
import { AddFundComponent } from './add-fund/add-fund.component';
import { FundDetailComponent } from './fund-detail/fund-detail.component';
import { OrgFundsService } from './org-funds.service';
import {
    FUND_TYPES,
    FundMovement,
    MOVEMENT_LABELS,
    OrgFund,
    STATUS_CLASSES,
    STATUS_LABELS,
} from './org-funds.types';

type Range = 'this_month' | 'last_30' | 'last_90';
type TrendMode = 'total' | 'company';

export interface Alert {
    kind: 'low' | 'insufficient' | 'overdue';
    message: string;
}

@Component({
    selector: 'treasury-org-funds',
    templateUrl: './org-funds.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatIconModule, NgApexchartsModule, FundDetailComponent, AddFundComponent],
})
export class OrgFundsComponent {
    readonly statusLabels = STATUS_LABELS;
    readonly statusClasses = STATUS_CLASSES;
    readonly movementLabels = MOVEMENT_LABELS;
    readonly fundTypes = FUND_TYPES;

    company = signal('all');
    range = signal<Range>('last_30');
    branch = signal('all');
    department = signal('all');
    currency = signal('BDT');
    type = signal('all');
    category = signal('all');
    addOpen = signal(false);
    trendMode = signal<TrendMode>('total');
    selectedId = signal<string | null>(null);

    companies = computed(() => this._unique((f) => f.company));
    branches = computed(() => this._unique((f) => f.branch));
    departments = computed(() => this._unique((f) => f.department));
    currencies = computed(() => this._unique((f) => f.currency));
    selected = computed(() => this.org.funds().find((f) => f.id === this.selectedId()) ?? null);

    /** Funds matching the filters. All amounts below are in the single selected currency. */
    funds = computed(() =>
        this.org
            .funds()
            .filter(
                (f) =>
                    f.currency === this.currency() &&
                    (this.company() === 'all' || f.company === this.company()) &&
                    (this.branch() === 'all' || f.branch === this.branch()) &&
                    (this.department() === 'all' || f.department === this.department()) &&
                    (this.type() === 'all' || f.type === this.type()) &&
                    (this.category() === 'all' || f.category === this.category())
            )
    );
    activeFunds = computed(() => this.funds().filter((f) => f.active));
    fundIds = computed(() => new Set(this.funds().map((f) => f.id)));

    current = computed(() => this._sum(this.activeFunds().map((f) => f.balance)));
    reserved = computed(() => this._sum(this.activeFunds().map((f) => f.reserved)));
    available = computed(() => this.current() - this.reserved());
    incoming = computed(() =>
        this._sum(this.org.expectedIncoming().filter((i) => this.fundIds().has(i.fundId)).map((i) => i.amount))
    );
    outgoing = computed(() =>
        this._sum(
            this.org
                .scheduledOutgoing()
                .filter((o) => !o.paid && this.fundIds().has(o.fundId))
                .map((o) => o.amount)
        )
    );

    /** Balances grouped by category, for the selected filters. */
    byCategory = computed(() =>
        this.org
            .categories()
            .map((name) => {
                const funds = this.activeFunds().filter((f) => f.category === name);
                const current = this._sum(funds.map((f) => f.balance));
                const reserved = this._sum(funds.map((f) => f.reserved));
                return { name, count: funds.length, current, available: current - reserved };
            })
            .filter((c) => c.count > 0)
    );

    alerts = computed<Alert[]>(() => {
        const alerts: Alert[] = [];
        const cur = this.currency();
        for (const f of this.activeFunds()) {
            if (this.org.status(f) === 'low') {
                alerts.push({
                    kind: 'low',
                    message: `${f.name}: available ${cur} ${this._n(this.org.available(f))} is below the minimum of ${cur} ${this._n(f.minBalance)}.`,
                });
            }
        }
        const approved = this.funds$
            .requests()
            .filter((r) => r.status === 'approved' || r.status === 'partially_paid')
            .reduce((sum, r) => sum + this.funds$.remaining(r), 0);
        if (cur === this.funds$.currency && approved > this.available()) {
            alerts.push({
                kind: 'insufficient',
                message: `Approved requests need ${cur} ${this._n(approved)} but only ${cur} ${this._n(this.available())} is available.`,
            });
        }
        const today = DateTime.now().startOf('day');
        for (const o of this.org.scheduledOutgoing()) {
            if (!o.paid && this.fundIds().has(o.fundId) && DateTime.fromISO(o.dueDate) < today) {
                const fund = this.org.funds().find((f) => f.id === o.fundId);
                alerts.push({
                    kind: 'overdue',
                    message: `${o.description} (${cur} ${this._n(o.amount)}) from ${fund?.name} was due ${DateTime.fromISO(o.dueDate).toFormat('dd MMM y')}.`,
                });
            }
        }
        return alerts;
    });

    recentActivity = computed(() => {
        const start = this._rangeStart();
        const funds = new Map(this.org.funds().map((f) => [f.id, f]));
        return this.org
            .movements()
            .filter((m) => this.fundIds().has(m.fundId) && DateTime.fromISO(m.date) >= start)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 8)
            .map((m) => ({ movement: m, fund: funds.get(m.fundId) }));
    });

    chart = computed(() => {
        const start = this._rangeStart();
        const days: DateTime[] = [];
        for (let d = start; d <= DateTime.now().endOf('day'); d = d.plus({ days: 1 })) {
            days.push(d);
        }
        const movements = this.org.movements();
        const balanceOn = (fund: OrgFund, day: DateTime): number => {
            const after = movements
                .filter((m) => m.fundId === fund.id && DateTime.fromISO(m.date) > day.endOf('day'))
                .reduce((s, m) => s + (m.direction === 'in' ? m.amount : -m.amount), 0);
            return fund.balance - after;
        };
        const groups =
            this.trendMode() === 'company'
                ? this.companies().filter((c) => this.activeFunds().some((f) => f.company === c))
                : ['All selected funds'];
        const series = groups.map((name) => ({
            name,
            data: days.map((day) =>
                this._sum(
                    this.activeFunds()
                        .filter((f) => this.trendMode() === 'total' || f.company === name)
                        .map((f) => balanceOn(f, day))
                )
            ),
        }));
        return {
            series,
            categories: days.map((d) => d.toFormat('dd MMM')),
            colors: ['#39a935', '#d5af36', '#0ea5e9', '#8b5cf6'],
        };
    });

    constructor(
        public org: OrgFundsService,
        private funds$: FundsService
    ) {}

    fmtAxis = (n: number): string => this._n(n);

    onFundAdded(fund: OrgFund): void {
        this.addOpen.set(false);
        // Show the new fund even if the current filters would hide it.
        this.currency.set(fund.currency);
        this.company.set('all');
        this.branch.set('all');
        this.department.set('all');
        this.type.set('all');
        this.category.set('all');
        this.selectedId.set(fund.id);
    }

    cardFmt(n: number): string {
        return this._n(n);
    }

    private _rangeStart(): DateTime {
        switch (this.range()) {
            case 'this_month':
                return DateTime.now().startOf('month');
            case 'last_90':
                return DateTime.now().minus({ days: 89 }).startOf('day');
            default:
                return DateTime.now().minus({ days: 29 }).startOf('day');
        }
    }

    private _unique(fn: (f: OrgFund) => string): string[] {
        return [...new Set(this.org.funds().map(fn))].sort();
    }

    private _sum(values: number[]): number {
        return values.reduce((a, b) => a + b, 0);
    }

    private _n(n: number): string {
        return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
}
