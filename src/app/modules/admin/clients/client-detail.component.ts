import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { DetailDoc } from '../treasury/shared/report.types';
import { ShareService } from '../treasury/shared/share.service';
import { SlideOverComponent } from '../treasury/shared/slide-over/slide-over.component';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { ClientFormComponent } from './client-form.component';
import { ClientsService } from './clients.service';
import {
    Client,
    ClientDocument,
    DOCUMENT_LABELS,
    DOCUMENT_TYPES,
    DocumentType,
    PROJECT_STATUS_CLASSES,
    PROJECT_STATUS_LABELS,
    Project,
    ProjectStatus,
} from './clients.types';

type Tab = 'overview' | 'projects' | 'documents' | 'access';

interface ShareTarget {
    title: string;
    subtitle: string;
    doc: DetailDoc;
}

@Component({
    selector: 'clients-detail',
    templateUrl: './client-detail.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, RouterLink, SlideOverComponent, UserSwitchComponent, ClientFormComponent],
})
export class ClientDetailComponent {
    readonly statusLabels = PROJECT_STATUS_LABELS;
    readonly statusClasses = PROJECT_STATUS_CLASSES;
    readonly statuses = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];
    readonly docTypes = DOCUMENT_TYPES;
    readonly docLabels = DOCUMENT_LABELS;
    readonly expiries: { label: string; days: number | null }[] = [
        { label: '1 day', days: 1 },
        { label: '7 days', days: 7 },
        { label: '30 days', days: 30 },
        { label: 'Never', days: null },
    ];

    private _id = signal('');
    tab = signal<Tab>('overview');
    message = signal<{ text: string; ok: boolean } | null>(null);
    editing = signal(false);
    confirmDelete = signal(false);

    client = computed<Client | null>(() => this.service.client(this._id()));
    projects = computed(() => this.service.projectsOf(this._id()));
    documents = computed(() => this.service.documentsOf(this._id()));
    linkedUsers = computed(() => this.service.usersOf(this._id()));
    /** Users who can still be linked: not already attached to a client. */
    freeUsers = computed(() => this.access.users().filter((u) => !u.clientId && !u.vendorId && !u.customer));

    docType = signal<'all' | DocumentType>('all');
    docProject = signal('all');
    shownDocs = computed(() =>
        this.documents().filter(
            (d) => (this.docType() === 'all' || d.type === this.docType()) && (this.docProject() === 'all' || d.projectId === this.docProject())
        )
    );

    // Document form
    docFormOpen = false;
    docDraft = this._blankDoc();

    // Access
    linkUserId = '';
    newUser = { name: '', email: '' };

    // Sharing
    share = signal<ShareTarget | null>(null);
    shareDays: number | null = 7;
    shareUrl = '';
    shareEmail = '';
    copied = false;

    constructor(
        public service: ClientsService,
        public access: AccessService,
        private _shares: ShareService,
        route: ActivatedRoute,
        private _router: Router
    ) {
        route.paramMap.subscribe((p) => this._id.set(p.get('id') ?? ''));
    }

    get tabs(): { id: Tab; label: string }[] {
        const tabs: { id: Tab; label: string }[] = [
            { id: 'overview', label: 'Overview' },
            { id: 'projects', label: `Projects (${this.projects().length})` },
            { id: 'documents', label: `Documents (${this.documents().length})` },
        ];
        if (this.access.can('clients.assign_user')) {
            tabs.push({ id: 'access', label: `Portal access (${this.linkedUsers().length})` });
        }
        return tabs;
    }

    setTab(tab: Tab): void {
        this.tab.set(tab);
        this.message.set(null);
    }

    projectName(id: string | null): string {
        return this.projects().find((p) => p.id === id)?.name ?? 'General';
    }

    amountOf(type: DocumentType): boolean {
        return !!DOCUMENT_TYPES.find((t) => t.id === type)?.hasAmount;
    }

    countOf(type: DocumentType): number {
        return this.documents().filter((d) => d.type === type).length;
    }

    activeProjects(): number {
        return this.projects().filter((p) => p.status !== 'delivered').length;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Client
    // -----------------------------------------------------------------------------------------------------

    saved(): void {
        this.editing.set(false);
        this._report(null, 'Client saved.');
    }

    deleteClient(): void {
        const error = this.service.deleteClient(this._id());
        this.confirmDelete.set(false);
        if (error) {
            this._report(error, null);
        } else {
            this._router.navigate(['/clients']);
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Documents
    // -----------------------------------------------------------------------------------------------------

    pickFile(event: Event): void {
        this.docDraft.fileName = (event.target as HTMLInputElement).files?.[0]?.name ?? null;
    }

    addDocument(): void {
        const d = this.docDraft;
        const error = this.service.addDocument(this._id(), {
            type: d.type,
            title: d.title,
            reference: d.reference,
            amount: this.amountOf(d.type) && d.amount !== null && `${d.amount}` !== '' ? Number(d.amount) : null,
            date: DateTime.fromISO(d.date).toISO(),
            note: d.note,
            projectId: d.projectId || null,
            fileName: d.fileName,
        });
        this._report(error, 'Document added.');
        if (!error) {
            this.docFormOpen = false;
            this.docDraft = this._blankDoc();
        }
    }

    deleteDocument(d: ClientDocument): void {
        this._report(this.service.deleteDocument(d.id), 'Document deleted.');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Portal access
    // -----------------------------------------------------------------------------------------------------

    linkUser(): void {
        if (!this.linkUserId) {
            this._report('Choose a user to give access.', null);
            return;
        }
        this.access.setUserClient(this.linkUserId, this._id());
        this.linkUserId = '';
        this._report(null, 'Access given. They now see this client\'s projects and documents when they sign in.');
    }

    createUser(): void {
        const error = this.access.addClientUser(this.newUser.name, this.newUser.email, this._id());
        this._report(error, 'Client login created.');
        if (!error) {
            this.newUser = { name: '', email: '' };
        }
    }

    unlinkUser(userId: string): void {
        this.access.setUserClient(userId, null);
        this._report(null, 'Access removed.');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Sharing: a link to read-only details, copied or sent by email
    // -----------------------------------------------------------------------------------------------------

    shareDocument(d: ClientDocument): void {
        const c = this.client();
        const day = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y');
        const money = (n: number) => `BDT ${n.toLocaleString('en-US')}`;
        this._openShare({
            title: d.title,
            subtitle: `${DOCUMENT_LABELS[d.type]} ${d.reference}`.trim(),
            doc: {
                kind: 'detail',
                title: d.title,
                subtitle: `${DOCUMENT_LABELS[d.type]} for ${c?.name}`,
                badge: DOCUMENT_LABELS[d.type],
                sections: [
                    {
                        rows: [
                            ['Client', c?.name ?? ''],
                            ['Type', DOCUMENT_LABELS[d.type]],
                            ['Reference', d.reference || '-'],
                            ['Project', this.projectName(d.projectId)],
                            ['Date', day(d.date)],
                            ...(d.amount !== null ? ([['Amount', money(d.amount)]] as [string, string][]) : []),
                            ['File', d.fileName ?? 'No file attached'],
                            ['Sent by', `${d.by} (${d.from === 'client' ? 'client' : 'Encore'})`],
                            ...(d.note ? ([['Note', d.note]] as [string, string][]) : []),
                        ],
                    },
                ],
                tables: [],
            },
        });
    }

    shareProject(p: Project): void {
        const c = this.client();
        const day = (iso: string) => DateTime.fromISO(iso).toFormat('dd MMM y');
        this._openShare({
            title: p.name,
            subtitle: `Project status for ${c?.name}`,
            doc: {
                kind: 'detail',
                title: p.name,
                subtitle: `Project status for ${c?.name}`,
                badge: this.statusLabels[p.status],
                sections: [
                    {
                        rows: [
                            ['Client', c?.name ?? ''],
                            ['Status', this.statusLabels[p.status]],
                            ['Progress', `${p.progress}%`],
                            ['Work order', p.workOrder || '-'],
                            ['Project manager', p.manager || '-'],
                            ['Start', day(p.startDate)],
                            ['Due', day(p.dueDate)],
                        ],
                    },
                ],
                tables: [
                    {
                        heading: 'Updates',
                        columns: ['When', 'By', 'Update'],
                        rows: p.updates.map((u) => [DateTime.fromISO(u.at).toFormat('dd MMM y'), u.by, u.text]),
                    },
                ],
            },
        });
    }

    private _openShare(target: ShareTarget): void {
        this.share.set(target);
        this.shareUrl = '';
        this.shareEmail = this.client()?.email ?? '';
        this.copied = false;
    }

    generateLink(): void {
        const target = this.share();
        if (target) {
            this.shareUrl = this._shares.url(this._shares.create(target.doc, 'pdf', this.shareDays).token);
            this.copied = false;
        }
    }

    async copyLink(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.shareUrl);
            this.copied = true;
        } catch {
            this.copied = false;
        }
    }

    /** Opens the visitor's mail app with the link filled in. */
    get mailHref(): string {
        const t = this.share();
        const subject = encodeURIComponent(`${t?.title ?? ''} - Encore Engineering Ltd.`);
        const body = encodeURIComponent(
            `Hello,\n\nPlease find "${t?.title ?? ''}" at the link below:\n${this.shareUrl}\n\nRegards,\n${this.access.user().name}\nEncore Engineering Ltd.`
        );
        return `mailto:${encodeURIComponent(this.shareEmail.trim())}?subject=${subject}&body=${body}`;
    }

    private _report(error: string | null, success: string | null): void {
        this.message.set(error ? { text: error, ok: false } : success ? { text: success, ok: true } : null);
    }

    private _blankDoc() {
        return { type: 'requirement' as DocumentType, title: '', reference: '', amount: null as number | null, date: DateTime.now().toISODate(), note: '', projectId: '', fileName: null as string | null };
    }
}
