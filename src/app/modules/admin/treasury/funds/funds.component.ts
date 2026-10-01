import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { DateTime } from 'luxon';
import { FundsService } from './funds.service';
import { FundRequest, FundRequestStatus, FundRole, STATUS_CLASSES, STATUS_LABELS } from './funds.types';
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
        MatButtonToggleModule,
        MatIconModule,
        RequestDetailComponent,
        RequestFormComponent,
    ],
})
export class FundsComponent {
    readonly labels = STATUS_LABELS;
    readonly classes = STATUS_CLASSES;
    readonly statuses = Object.keys(STATUS_LABELS) as FundRequestStatus[];

    /** Preview switch between the two audiences; real permissions will drive this later. */
    role = signal<FundRole>('employee');
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

    constructor(public funds: FundsService) {}

    setRole(role: FundRole): void {
        this.role.set(role);
        this.selectedId.set(null);
    }

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
