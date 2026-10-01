import { Component, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { SlideOverComponent } from '../../shared/slide-over/slide-over.component';
import { OrgFundsService } from '../org-funds.service';
import { FUND_TYPES, OrgFund } from '../org-funds.types';

const NEW_CATEGORY = '__new__';

@Component({
    selector: 'treasury-add-fund',
    templateUrl: './add-fund.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        SlideOverComponent,
    ],
})
export class AddFundComponent {
    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<OrgFund>();

    readonly types = FUND_TYPES;
    readonly newCategory = NEW_CATEGORY;

    form = this._fb.group({
        name: ['', Validators.required],
        category: ['', Validators.required],
        newCategoryName: [''],
        company: ['', Validators.required],
        branch: ['', Validators.required],
        department: ['', Validators.required],
        type: ['Bank', Validators.required],
        currency: ['BDT', Validators.required],
        openingBalance: [0, [Validators.required, Validators.min(0)]],
        minBalance: [0, [Validators.required, Validators.min(0)]],
    });

    constructor(
        private _fb: FormBuilder,
        public org: OrgFundsService
    ) {}

    get companies(): string[] {
        return [...new Set(this.org.funds().map((f) => f.company))].sort();
    }

    get currencies(): string[] {
        return [...new Set(this.org.funds().map((f) => f.currency))].sort();
    }

    get branches(): string[] {
        return [...new Set(this.org.funds().map((f) => f.branch))].sort();
    }

    get departments(): string[] {
        return [...new Set(this.org.funds().map((f) => f.department))].sort();
    }

    get creatingCategory(): boolean {
        return this.form.value.category === NEW_CATEGORY;
    }

    submit(): void {
        const v = this.form.getRawValue();
        const category = this.creatingCategory ? v.newCategoryName.trim() : v.category;
        if (this.creatingCategory && !category) {
            this.form.controls.newCategoryName.setErrors({ required: true });
        }
        if (this.form.invalid || !category) {
            this.form.markAllAsTouched();
            return;
        }
        this.saved.emit(
            this.org.addFund(
                {
                    name: v.name,
                    category,
                    company: v.company,
                    branch: v.branch,
                    department: v.department,
                    type: v.type as OrgFund['type'],
                    currency: v.currency,
                    openingBalance: Number(v.openingBalance),
                    minBalance: Number(v.minBalance),
                },
                'Accounts'
            )
        );
    }
}
