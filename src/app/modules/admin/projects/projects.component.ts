import { DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { ClientsService } from '../clients/clients.service';
import { AddButtonComponent } from '../treasury/shared/add-button/add-button.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { ProjectFormComponent } from './project-form.component';
import { ProjectsService } from './projects.service';
import { PROJECT_STATUS_CLASSES, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, PROJECT_TYPES, ProjectStatus, ProjectType } from './projects.types';

@Component({
    selector: 'projects-list',
    templateUrl: './projects.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DecimalPipe, FormsModule, AddButtonComponent, UserSwitchComponent, ProjectFormComponent],
})
export class ProjectsComponent {
    readonly statusLabels = PROJECT_STATUS_LABELS;
    readonly statusClasses = PROJECT_STATUS_CLASSES;
    readonly typeLabels = PROJECT_TYPE_LABELS;
    readonly types = PROJECT_TYPES;
    readonly statuses = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];

    search = signal('');
    status = signal<'all' | ProjectStatus>('all');
    type = signal<'all' | ProjectType>('all');
    formOpen = signal(false);

    list = computed(() => {
        const q = this.search().trim().toLowerCase();
        return this.service
            .projects()
            .filter(
                (p) =>
                    (this.status() === 'all' || p.status === this.status()) &&
                    (this.type() === 'all' || p.type === this.type()) &&
                    (!q || [p.id, p.name, p.manager, p.location, this.clientName(p.clientId)].some((v) => v.toLowerCase().includes(q)))
            );
    });

    activeCount = computed(() => this.service.projects().filter((p) => p.status !== 'delivered').length);
    contractTotal = computed(() => this.service.projects().reduce((s, p) => s + p.contractValue, 0));
    budgetTotal = computed(() => this.service.projects().reduce((s, p) => s + p.budget, 0));
    profitTotal = computed(() => this.service.projects().reduce((s, p) => s + this.service.costing(p.id).profitToDate, 0));

    constructor(
        public service: ProjectsService,
        public access: AccessService,
        private _clients: ClientsService,
        private _router: Router
    ) {}

    clientName(id: string): string {
        return this._clients.client(id)?.name ?? id;
    }

    open(id: string): void {
        this._router.navigate(['/projects', id]);
    }

    saved(id: string): void {
        this.formOpen.set(false);
        this.open(id);
    }
}
