import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { CompanyService } from './company.service';

export interface ChargedTo {
    branchId: string | null;
    departmentId: string | null;
    /** Names, kept on the record so old screens and exports still read well. */
    branch: string;
    department: string;
}

/** Two linked pickers, branch then department, saying which part of the company a cost belongs to. */
@Component({
    selector: 'company-charged-to',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    template: `
        <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="text-sm font-medium">Branch</span>
                <select class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="charged-branch" aria-label="Charged to branch" [value]="branchId ?? ''" (change)="pickBranch($any($event.target).value)">
                    <option value="">Not set</option>
                    @for (b of branches(); track b.id) { <option [value]="b.id" [selected]="b.id === branchId">{{ label(b.id) }}</option> }
                </select>
            </label>
            <label class="block"><span class="text-sm font-medium">Department</span>
                <select class="mt-1 h-11 w-full rounded-lg border bg-transparent px-3 text-md" name="charged-dept" aria-label="Charged to department" [value]="departmentId ?? ''" [disabled]="!branchId" (change)="pickDept($any($event.target).value)">
                    <option value="">Whole branch</option>
                    @for (d of departments(); track d.id) { <option [value]="d.id" [selected]="d.id === departmentId">{{ d.name }}</option> }
                </select>
            </label>
        </div>
    `,
})
export class ChargedToComponent {
    @Input() branchId: string | null = null;
    @Input() departmentId: string | null = null;
    @Output() changed = new EventEmitter<ChargedTo>();

    constructor(private _company: CompanyService) {}

    branches = () => this._company.companies().filter((c) => c.active).flatMap((c) => this._company.unitsOf(c.id, 'branch', null, false));
    departments = () => (this.branchId ? this._company.children(this.branchId).filter((d) => d.active) : []);

    label(branchId: string): string {
        const b = this._company.unit(branchId);
        return this._company.companies().length > 1 && b ? `${this._company.company(b.companyId)?.code} · ${b.name}` : (b?.name ?? '');
    }

    pickBranch(id: string): void {
        this._emit(id || null, null);
    }

    pickDept(id: string): void {
        this._emit(this.branchId, id || null);
    }

    private _emit(branchId: string | null, departmentId: string | null): void {
        this.branchId = branchId;
        this.departmentId = departmentId;
        this.changed.emit({ branchId, departmentId, branch: this._company.unit(branchId)?.name ?? '', department: this._company.unit(departmentId)?.name ?? '' });
    }
}
