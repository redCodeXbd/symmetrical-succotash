import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../../projects/projects.service';
import { StoreService } from '../../store/store.service';
import { SlideOverComponent } from '../../treasury/shared/slide-over/slide-over.component';
import { CompanyFormComponent } from './company-form.component';
import { CompanyService } from './company.service';
import { CHILD_KIND, KIND_LABEL, MONTHS, OrgUnit, UnitInput, UnitKind } from './company.types';

type Tab = 'overview' | 'structure' | 'warehouses' | 'people';
type Panel = { type: 'unit'; unit: OrgUnit | null; kind: UnitKind } | { type: 'warehouse'; id: string | null } | { type: 'delete-company' } | { type: 'delete-unit'; unit: OrgUnit };

interface TreeRow {
    unit: OrgUnit;
    depth: number;
    people: number;
}

@Component({
    selector: 'settings-company-detail',
    templateUrl: './company-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, SlideOverComponent, CompanyFormComponent],
})
export class CompanyDetailComponent {
    readonly months = MONTHS;
    readonly kindLabel = KIND_LABEL;
    readonly childKind = CHILD_KIND;
    readonly tabs: { id: Tab; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'structure', label: 'Structure' },
        { id: 'warehouses', label: 'Warehouses' },
        { id: 'people', label: 'People' },
    ];

    private _id = toSignal(this._route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
    company = computed(() => this.company_.company(this._id()));
    tab = signal<Tab>('overview');
    editing = signal(false);
    panel = signal<Panel | null>(null);
    selected = signal<string | null>(null);
    collapsed = signal<Set<string>>(new Set());
    message = signal<{ text: string; ok: boolean } | null>(null);
    peopleFilter = signal('');

    unitForm: UnitInput = this._blankUnit('branch', null);
    whForm = { name: '', type: 'office' as 'office' | 'project', projectId: '', location: '', branchId: '', managerId: '' };
    error: string | null = null;

    tree = computed<TreeRow[]>(() => {
        const c = this.company();
        if (!c) {
            return [];
        }
        const rows: TreeRow[] = [];
        const hidden = this.collapsed();
        const walk = (parentId: string | null, depth: number) => {
            for (const unit of this.company_.unitsOf(c.id, undefined, parentId)) {
                rows.push({ unit, depth, people: this.company_.peopleOf(c.id, unit.id).length });
                if (!hidden.has(unit.id)) {
                    walk(unit.id, depth + 1);
                }
            }
        };
        walk(null, 0);
        return rows;
    });

    selectedUnit = computed(() => this.company_.unit(this.selected()));
    selectedPeople = computed(() => (this.selectedUnit() ? this.company_.peopleOf(this.company()!.id, this.selected()) : []));

    warehouses = computed(() => this.company_.warehousesOf(this.company()?.id ?? ''));
    people = computed(() => {
        const c = this.company();
        const q = this.peopleFilter().trim().toLowerCase();
        return c ? this.company_.peopleOf(c.id).filter((r) => !q || [r.user.name, r.profile.designation, this.company_.path(r.profile.orgTeamId || r.profile.orgDeptId || r.profile.orgBranchId)].some((v) => v.toLowerCase().includes(q))) : [];
    });
    unassigned = computed(() => this.company_.peopleOf('').length);
    staff = computed(() => this.users().filter((u) => u.active !== false));

    constructor(
        public company_: CompanyService,
        public access: AccessService,
        public store: StoreService,
        public projects: ProjectsService,
        private _route: ActivatedRoute,
        private _router: Router
    ) {}

    users = () => this.access.users();

    userName(id: string | null): string {
        return this.access.users().find((u) => u.id === id)?.name ?? '—';
    }

    branchesOf = () => this.company_.unitsOf(this.company()!.id, 'branch', null, false);

    toggle(id: string): void {
        this.collapsed.update((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    parentChoices(kind: UnitKind): OrgUnit[] {
        const c = this.company();
        const parentKind = kind === 'department' ? 'branch' : kind === 'team' ? 'department' : null;
        return c && parentKind ? this.company_.unitsOf(c.id, parentKind, undefined, false) : [];
    }

    // ---- panels -------------------------------------------------------------------------------------------

    openUnit(kind: UnitKind, parent: OrgUnit | null, unit: OrgUnit | null = null): void {
        this.error = null;
        this.unitForm = unit ? { ...unit } : this._blankUnit(kind, parent?.id ?? null);
        this.panel.set({ type: 'unit', unit, kind });
    }

    openWarehouse(id: string | null): void {
        this.error = null;
        const s = id ? this.store.store(id) : null;
        this.whForm = { name: s?.name ?? '', type: s?.type ?? 'office', projectId: s?.projectId ?? '', location: s?.location ?? '', branchId: s?.branchId ?? this.branchesOf()[0]?.id ?? '', managerId: s?.managerId ?? '' };
        this.panel.set({ type: 'warehouse', id });
    }

    saveUnit(): void {
        const p = this.panel();
        if (p?.type !== 'unit') {
            return;
        }
        const input: UnitInput = { ...this.unitForm, kind: p.kind, companyId: this.company()!.id };
        const result = p.unit ? this.company_.updateUnit(p.unit.id, input) : this.company_.addUnit(input);
        if (typeof result === 'string') {
            this.error = result;
            return;
        }
        this.panel.set(null);
        this._say(`${KIND_LABEL[p.kind]} ${p.unit ? 'saved' : 'added'}.`);
    }

    saveWarehouse(): void {
        const p = this.panel();
        if (p?.type !== 'warehouse') {
            return;
        }
        const f = this.whForm;
        if (!f.branchId) {
            this.error = 'Choose the branch this warehouse belongs to.';
            return;
        }
        let result: string | null | { id: string };
        if (p.id) {
            result = this.store.setStoreOrg(p.id, f.branchId, f.managerId || null);
        } else {
            result = this.store.addStore(f.name, f.type, f.type === 'project' ? f.projectId || null : null, f.location, f.branchId, f.managerId || null);
        }
        if (typeof result === 'string') {
            this.error = result;
            return;
        }
        this.panel.set(null);
        this._say(p.id ? 'Warehouse saved.' : 'Warehouse added.');
    }

    toggleActive(unit: OrgUnit): void {
        const error = this.company_.setUnitActive(unit.id, !unit.active);
        this._say(error ?? `${unit.name} is now ${unit.active ? 'inactive' : 'active'}.`, !error);
    }

    confirmDelete(): void {
        const p = this.panel();
        if (p?.type === 'delete-unit') {
            const error = this.company_.deleteUnit(p.unit.id);
            if (error) {
                this.error = error;
                return;
            }
            this.selected.set(null);
            this.panel.set(null);
            this._say(`${p.unit.name} deleted.`);
        } else if (p?.type === 'delete-company') {
            const error = this.company_.deleteCompany(this.company()!.id);
            if (error) {
                this.error = error;
                return;
            }
            void this._router.navigate(['/settings/company']);
        }
    }

    askDelete(panel: Panel): void {
        this.error = null;
        this.panel.set(panel);
    }

    private _say(text: string, ok = true): void {
        this.message.set({ text, ok });
        setTimeout(() => this.message.set(null), 4000);
    }

    private _blankUnit(kind: UnitKind, parentId: string | null): UnitInput {
        return { companyId: '', kind, parentId, code: '', name: '', managerId: null, address: '', notes: '', active: true };
    }
}
