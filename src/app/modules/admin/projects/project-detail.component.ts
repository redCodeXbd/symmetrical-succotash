import { ConfirmService } from 'app/core/confirm/confirm.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { ClientsService } from '../clients/clients.service';
import { StoreService } from '../store/store.service';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { VendorsService } from '../vendors/vendors.service';
import { ProjectFormComponent } from './project-form.component';
import { ProjectsService } from './projects.service';
import { COST_SOURCE_LABELS, CostSource, PROJECT_STATUS_CLASSES, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, Project, ProjectStatus } from './projects.types';

type Tab = 'overview' | 'costing' | 'store' | 'updates';

@Component({
    selector: 'projects-detail',
    templateUrl: './project-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, UserSwitchComponent, ProjectFormComponent],
})
export class ProjectDetailComponent {
    readonly statusLabels = PROJECT_STATUS_LABELS;
    readonly statusClasses = PROJECT_STATUS_CLASSES;
    readonly typeLabels = PROJECT_TYPE_LABELS;
    readonly sourceLabels = COST_SOURCE_LABELS;
    readonly statuses = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];
    readonly sources = Object.keys(COST_SOURCE_LABELS) as CostSource[];

    private _id = signal('');
    tab = signal<Tab>('overview');
    message = signal<{ text: string; ok: boolean } | null>(null);
    editing = signal(false);
    sourceFilter = signal<'all' | CostSource>('all');
    updateText = '';
    advance: number | null = null;

    project = computed<Project | null>(() => this.service.project(this._id()));
    costing = computed(() => this.service.costing(this._id()));
    shownLines = computed(() => this.costing().lines.filter((l) => this.sourceFilter() === 'all' || l.source === this.sourceFilter()));
    projectStores = computed(() => this.store.stores().filter((s) => s.projectId === this._id()));
    issued = computed(() => this.store.movements().filter((m) => m.type === 'issue' && m.projectId === this._id()));

    constructor(
        public service: ProjectsService,
        public access: AccessService,
        public store: StoreService,
        private _clients: ClientsService,
        private _vendors: VendorsService,
        route: ActivatedRoute,
        private _router: Router,
        private _confirm: ConfirmService
    ) {
        route.paramMap.subscribe((p) => this._id.set(p.get('id') ?? ''));
    }

    get tabs(): { id: Tab; label: string }[] {
        const tabs: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }];
        if (this.access.can('projects.view_cost')) {
            tabs.push({ id: 'costing', label: 'Costing and profit' });
        }
        if (this.access.can('store.view')) {
            tabs.push({ id: 'store', label: 'Store' });
        }
        tabs.push({ id: 'updates', label: `Updates (${this.project()?.updates.length ?? 0})` });
        return tabs;
    }

    clientName(id: string): string {
        return this._clients.client(id)?.name ?? id;
    }

    vendorName(id: string): string {
        return this._vendors.vendor(id)?.name ?? id;
    }

    /** Share of the whole bar a cost source takes, for the stacked bar. */
    share(amount: number): number {
        const total = this.costing().total;
        return total > 0 ? (amount / total) * 100 : 0;
    }

    get advanceDue(): number {
        const p = this.project();
        return p ? Math.round((p.contractValue * p.advancePercent) / 100) : 0;
    }

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.message.set(null);
    }

    saved(): void {
        this.editing.set(false);
        this._report(null, 'Project saved.');
    }

    async deleteProject(): Promise<void> {
        const p = this.project();
        if (!(await this._confirm.delete('this project', { message: 'The project and its updates are removed.', details: p ? [['Project', p.name]] : [] }))) {
            return;
        }
        const error = this.service.delete(this._id());
        error ? this._report(error, null) : this._router.navigate(['/projects']);
    }

    changeStatus(status: ProjectStatus, progress: number): void {
        this._report(this.service.setStatus(this._id(), status, progress), 'Project updated.');
    }

    saveAdvance(): void {
        this._report(this.service.recordAdvance(this._id(), Number(this.advance ?? 0)), 'Advance saved.');
    }

    postUpdate(): void {
        const error = this.service.addUpdate(this._id(), this.updateText);
        this._report(error, 'Update posted. The client can see it now.');
        if (!error) {
            this.updateText = '';
        }
    }

    private _report(error: string | null, success: string | null): void {
        this.message.set(error ? { text: error, ok: false } : success ? { text: success, ok: true } : null);
    }
}
