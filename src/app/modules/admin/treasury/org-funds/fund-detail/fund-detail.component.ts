import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { DateTime } from 'luxon';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { ReportDoc } from '../../shared/report.types';
import { SlideOverComponent } from '../../shared/slide-over/slide-over.component';
import { OrgFundsService } from '../org-funds.service';
import {
    ExpectedIncoming,
    FundMovement,
    MOVEMENT_LABELS,
    OrgFund,
    ScheduledOutgoing,
    STATUS_CLASSES,
    STATUS_LABELS,
} from '../org-funds.types';

@Component({
    selector: 'treasury-fund-detail',
    templateUrl: './fund-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, ExportMenuComponent, SlideOverComponent],
})
export class FundDetailComponent {
    @Input() fund: OrgFund;
    @Output() closed = new EventEmitter<void>();

    readonly statusLabels = STATUS_LABELS;
    readonly statusClasses = STATUS_CLASSES;
    readonly movementLabels = MOVEMENT_LABELS;
    tab: 'overview' | 'transactions' = 'overview';

    constructor(public org: OrgFundsService) {}

    get available(): number {
        return this.org.available(this.fund);
    }

    get incoming(): ExpectedIncoming[] {
        return this.org.expectedIncoming().filter((i) => i.fundId === this.fund.id);
    }

    get outgoing(): ScheduledOutgoing[] {
        return this.org.scheduledOutgoing().filter((o) => o.fundId === this.fund.id && !o.paid);
    }

    get incomingTotal(): number {
        return this.incoming.reduce((s, i) => s + i.amount, 0);
    }

    get outgoingTotal(): number {
        return this.outgoing.reduce((s, o) => s + o.amount, 0);
    }

    get movements(): FundMovement[] {
        return this.org
            .movements()
            .filter((m) => m.fundId === this.fund.id)
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    fundDoc = (): ReportDoc => {
        const f = this.fund;
        const money = (n: number) => `${f.currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        const day = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y');
        return {
            kind: 'detail',
            title: `Fund ${f.name}`,
            subtitle: `${f.company} · ${f.category}`,
            badge: STATUS_LABELS[this.org.status(f)],
            sections: [
                {
                    rows: [
                        ['Current balance', money(f.balance)],
                        ['Reserved', money(f.reserved)],
                        ['Available', money(this.available)],
                        ['Expected incoming', money(this.incomingTotal)],
                        ['Scheduled outgoing', money(this.outgoingTotal)],
                        ['Minimum balance', money(f.minBalance)],
                        ['Category', f.category],
                        ['Type', f.type],
                        ['Branch', f.branch],
                        ['Department', f.department],
                    ],
                },
            ],
            tables: [
                {
                    heading: 'Expected incoming',
                    columns: ['Description', 'Expected', 'Amount'],
                    rows: this.incoming.map((i) => [i.description, day(i.expectedDate), money(i.amount)]),
                },
                {
                    heading: 'Scheduled outgoing',
                    columns: ['Description', 'Due', 'Amount'],
                    rows: this.outgoing.map((o) => [o.description, day(o.dueDate), money(o.amount)]),
                },
                {
                    heading: 'Transactions',
                    columns: ['Date', 'Type', 'Reference', 'Description', 'Amount'],
                    rows: this.movements.map((m) => [
                        day(m.date),
                        MOVEMENT_LABELS[m.type],
                        m.reference,
                        m.description,
                        `${m.direction === 'in' ? '+' : '-'}${money(m.amount)}`,
                    ]),
                },
            ],
        };
    };

    isOverdue(o: ScheduledOutgoing): boolean {
        return DateTime.fromISO(o.dueDate) < DateTime.now().startOf('day');
    }
}
