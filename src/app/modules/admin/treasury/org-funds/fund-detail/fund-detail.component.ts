import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { DateTime } from 'luxon';
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
    imports: [DatePipe, DecimalPipe, SlideOverComponent],
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

    isOverdue(o: ScheduledOutgoing): boolean {
        return DateTime.fromISO(o.dueDate) < DateTime.now().startOf('day');
    }
}
