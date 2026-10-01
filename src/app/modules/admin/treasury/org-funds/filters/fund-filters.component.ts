import { Component, EventEmitter, HostListener, Input, Output, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type DateRange = 'last_30' | 'this_month' | 'last_90';

export interface FundFilters {
    company: string;
    range: DateRange;
    currency: string;
    category: string;
    type: string;
}

export const DEFAULT_FILTERS: Omit<FundFilters, 'currency'> = {
    company: 'all',
    range: 'last_30',
    category: 'all',
    type: 'all',
};

interface ActiveChip {
    key: keyof FundFilters;
    label: string;
}

const RANGES: { value: DateRange; label: string; short: string }[] = [
    { value: 'last_30', label: 'Last 30 days', short: '30D' },
    { value: 'this_month', label: 'This month', short: 'Month' },
    { value: 'last_90', label: 'Last 90 days', short: '90D' },
];

/**
 * Filter panel for Organization Funds. Wide screens show every group as chips;
 * phones get a compact bar plus a bottom sheet so nothing is cramped or hidden.
 */
@Component({
    selector: 'treasury-fund-filters',
    templateUrl: './fund-filters.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [NgTemplateOutlet, MatIconModule],
})
export class FundFiltersComponent {
    @Input({ required: true }) value: FundFilters;
    @Input() companies: string[] = [];
    @Input() categories: string[] = [];
    @Input() types: string[] = [];
    @Input() currencies: string[] = [];
    /** How many funds the current filters match, shown on the sheet's apply button. */
    @Input() resultCount = 0;
    @Output() valueChange = new EventEmitter<FundFilters>();

    readonly ranges = RANGES;
    sheetOpen = false;

    private get _defaultCurrency(): string {
        return this.currencies[0] ?? this.value.currency;
    }

    /** Filters that differ from the defaults, as removable chips. */
    get active(): ActiveChip[] {
        const v = this.value;
        const chips: ActiveChip[] = [];
        if (v.company !== 'all') chips.push({ key: 'company', label: v.company });
        if (v.category !== 'all') chips.push({ key: 'category', label: v.category });
        if (v.type !== 'all') chips.push({ key: 'type', label: v.type });
        if (v.currency !== this._defaultCurrency) chips.push({ key: 'currency', label: v.currency });
        if (v.range !== DEFAULT_FILTERS.range) chips.push({ key: 'range', label: RANGES.find((r) => r.value === v.range)!.label });
        return chips;
    }

    set<K extends keyof FundFilters>(key: K, value: FundFilters[K]): void {
        this.valueChange.emit({ ...this.value, [key]: value });
    }

    clear(key: keyof FundFilters): void {
        this.set(key, key === 'currency' ? this._defaultCurrency : (DEFAULT_FILTERS as any)[key]);
    }

    reset(): void {
        this.valueChange.emit({ ...DEFAULT_FILTERS, currency: this._defaultCurrency });
    }

    @HostListener('document:keydown.escape')
    closeOnEscape(): void {
        this.sheetOpen = false;
    }
}
