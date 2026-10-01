import { Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ClientsService } from '../clients/clients.service';
import { FundsService } from '../treasury/funds/funds.service';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { VendorsService } from '../vendors/vendors.service';
import { ProjectsService } from './projects.service';
import { BRANCHES, PROJECT_TYPES, Project, ProjectInput } from './projects.types';

/** Add or edit a project in a drawer. Emits the project id once saved. */
@Component({
    selector: 'projects-form',
    templateUrl: './project-form.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule, SlideOverComponent],
})
export class ProjectFormComponent implements OnInit {
    @Input() project: Project | null = null;
    @Output() saved = new EventEmitter<string>();
    @Output() cancelled = new EventEmitter<void>();

    readonly types = PROJECT_TYPES;
    readonly branches = BRANCHES;

    model: ProjectInput = {
        clientId: '', name: '', type: 'both', status: 'planning', startDate: DateTime.now().toISODate(),
        dueDate: DateTime.now().plus({ days: 60 }).toISODate(), manager: '', location: '', branch: BRANCHES[0], vendorIds: [],
        workOrder: '', description: '', contractValue: 0, budget: 0, paymentTerm: 'advance', advancePercent: 30,
        advanceReceived: 0, creditDays: 30,
    };
    error: string | null = null;

    constructor(
        private _projects: ProjectsService,
        public clients: ClientsService,
        public vendors: VendorsService,
        public funds: FundsService,
        public access: AccessService
    ) {}

    /** Staff who can run a project: everyone except client and vendor logins. */
    get managers(): string[] {
        return this.access.users().filter((u) => !u.clientId && !u.vendorId).map((u) => u.name);
    }

    ngOnInit(): void {
        if (this.project) {
            const { id, progress, updates, ...rest } = this.project;
            this.model = { ...rest, vendorIds: [...rest.vendorIds], startDate: rest.startDate.slice(0, 10), dueDate: rest.dueDate.slice(0, 10) };
        }
    }

    toggleVendor(id: string, event: Event): void {
        const on = (event.target as HTMLInputElement).checked;
        this.model.vendorIds = on ? [...this.model.vendorIds, id] : this.model.vendorIds.filter((v) => v !== id);
    }

    get advanceDue(): number {
        return Math.round((Number(this.model.contractValue) * Number(this.model.advancePercent)) / 100);
    }

    save(): void {
        const input = { ...this.model, startDate: DateTime.fromISO(this.model.startDate).toISO(), dueDate: DateTime.fromISO(this.model.dueDate).toISO() };
        if (this.project) {
            this._done(this._projects.update(this.project.id, input), this.project.id);
        } else {
            const result = this._projects.add(input);
            typeof result === 'string' ? this._done(result, '') : this._done(null, result.id);
        }
    }

    private _done(error: string | null, id: string): void {
        this.error = error;
        if (!error) {
            this.saved.emit(id);
        }
    }
}
