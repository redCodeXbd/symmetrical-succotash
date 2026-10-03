import { watchQuery } from 'app/core/navigation/deep-link';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccessService } from 'app/core/access/access.service';
import { AddButtonComponent } from '../../treasury/shared/add-button/add-button.component';
import { CompanyFormComponent } from './company-form.component';
import { CompanyService } from './company.service';

@Component({
    selector: 'settings-company-list',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, RouterLink, MatIconModule, AddButtonComponent, CompanyFormComponent],
    template: `
        <div class="flex min-w-0 flex-auto flex-col">
            <div class="flex-auto p-6 sm:p-10">
                <div class="text-secondary text-md">Configuration / Company</div>
                <div class="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h1 class="text-4xl font-extrabold leading-tight tracking-tight">Companies</h1>
                    @if (access.can('company.create')) {
                        <treasury-add-button label="Add company" (pressed)="adding.set(true)" />
                    }
                </div>
                <div class="text-secondary mt-0.5 text-lg">Your companies and how each is organised into branches, departments, teams and warehouses.</div>

                <div class="mt-6 flex flex-wrap gap-3">
                    <input type="search" class="h-11 w-full max-w-sm rounded-lg border bg-card px-3 text-md" placeholder="Search by name or code" aria-label="Search companies" [ngModel]="search()" (ngModelChange)="search.set($event)" />
                    <select class="h-11 rounded-lg border bg-card px-3 text-md" aria-label="Filter by status" [ngModel]="status()" (ngModelChange)="status.set($event)">
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                @if (rows().length === 0) {
                    <div class="text-secondary mt-8 rounded-2xl bg-card p-10 text-center text-md shadow">No companies match.</div>
                } @else {
                    <div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        @for (r of rows(); track r.company.id) {
                            <a [routerLink]="[r.company.id]" class="company-card block rounded-2xl bg-card p-6 shadow transition hover:shadow-lg">
                                <div class="flex items-start gap-4">
                                    <div class="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-primary/15 text-xl font-extrabold text-primary">{{ r.company.code.slice(0, 3) }}</div>
                                    <div class="min-w-0 flex-auto">
                                        <div class="truncate text-xl font-semibold">{{ r.company.name }}</div>
                                        <div class="text-secondary truncate text-md">{{ r.company.code }} · {{ r.company.currency }}</div>
                                    </div>
                                    <span class="rounded-full px-2.5 py-0.5 text-sm font-medium" [class]="r.company.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'">{{ r.company.active ? 'Active' : 'Inactive' }}</span>
                                </div>
                                <div class="mt-5 grid grid-cols-4 gap-2 text-center">
                                    <div><div class="text-2xl font-semibold">{{ r.branches }}</div><div class="text-secondary text-sm">Branches</div></div>
                                    <div><div class="text-2xl font-semibold">{{ r.departments }}</div><div class="text-secondary text-sm">Depts</div></div>
                                    <div><div class="text-2xl font-semibold">{{ r.warehouses }}</div><div class="text-secondary text-sm">Warehouses</div></div>
                                    <div><div class="text-2xl font-semibold">{{ r.people }}</div><div class="text-secondary text-sm">People</div></div>
                                </div>
                            </a>
                        }
                    </div>
                }
            </div>
        </div>
        @if (adding()) {
            <company-form (closed)="adding.set(false)" (saved)="opened($event)" />
        }
    `,
})
export class CompanyListComponent {
    search = signal('');
    status = signal('all');
    adding = signal(false);

    rows = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.company
            .companies()
            .filter((c) => (this.status() === 'all' || (this.status() === 'active') === c.active) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)))
            .map((c) => ({
                company: c,
                branches: this.company.unitsOf(c.id, 'branch').length,
                departments: this.company.unitsOf(c.id, 'department').length,
                warehouses: this.company.warehousesOf(c.id).length,
                people: this.company.headcount(c.id),
            }));
    });

    /** Menu link: ?action=add */
    private _deep = watchQuery((q) => {
        if (q.get('action') === 'add' && this.access.can('company.create')) {
            this.adding.set(true);
        }
    });

    constructor(
        public company: CompanyService,
        public access: AccessService,
        private _router: Router
    ) {}

    opened(id: string): void {
        this.adding.set(false);
        void this._router.navigate(['/settings/company', id]);
    }
}
