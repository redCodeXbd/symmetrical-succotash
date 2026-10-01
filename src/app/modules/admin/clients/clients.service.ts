import { computed, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AccessService } from 'app/core/access/access.service';
import { ProjectsService } from '../projects/projects.service';
import { Client, ClientDocument, ClientInput, DocumentInput } from './clients.types';

/**
 * In-memory store for Clients, their projects and documents. Replace the methods with API calls once
 * there is a backend. Who may see or change what is decided here, from the acting user's permissions:
 * staff with "View all" see every client; a client user sees only the client they are linked to.
 */
@Injectable({ providedIn: 'root' })
export class ClientsService {
    private _clients = signal<Client[]>(this._seedClients());
    private _documents = signal<ClientDocument[]>(this._seedDocuments());

    constructor(
        private _access: AccessService,
        private _projects: ProjectsService
    ) {}

    /** Clients the acting user may open. */
    readonly clients = computed(() => {
        const all = this._clients();
        if (this._access.can('clients.view_all')) {
            return all;
        }
        const own = this._access.user().clientId;
        return all.filter((c) => c.id === own);
    });

    readonly documents = computed(() => this._visible(this._documents()));

    client(id: string): Client | null {
        return this.clients().find((c) => c.id === id) ?? null;
    }

    /** Projects of a client the acting user may see. They are kept in the Projects feature. */
    projectsOf(clientId: string) {
        return this._projects.projectsOf(clientId);
    }

    documentsOf(clientId: string): ClientDocument[] {
        return this.documents().filter((d) => d.clientId === clientId);
    }

    /** The people who can sign in as this client. */
    usersOf(clientId: string) {
        return this._access.users().filter((u) => u.clientId === clientId);
    }

    /** A client user acts for one client; staff act for the company. */
    get isClientUser(): boolean {
        return !this._access.can('clients.view_all') && !!this._access.user().clientId;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Clients. Each returns an error message, or null on success.
    // -----------------------------------------------------------------------------------------------------

    addClient(input: ClientInput): string | { id: string } {
        if (!this._access.can('clients.add')) {
            return 'You do not have permission to add clients.';
        }
        const error = this._validate(input);
        if (error) {
            return error;
        }
        const client: Client = { ...this._clean(input), id: this._nextId('C-', this._clients().map((c) => c.id), 1001), createdAt: DateTime.now().toISO() };
        this._clients.update((list) => [client, ...list]);
        return { id: client.id };
    }

    updateClient(id: string, input: ClientInput): string | null {
        if (!this._access.can('clients.edit')) {
            return 'You do not have permission to edit clients.';
        }
        const error = this._validate(input, id);
        if (error) {
            return error;
        }
        this._clients.update((list) => list.map((c) => (c.id === id ? { ...c, ...this._clean(input) } : c)));
        return null;
    }

    deleteClient(id: string): string | null {
        if (!this._access.can('clients.delete')) {
            return 'You do not have permission to delete clients.';
        }
        if (this._projects.projectsOf(id).length > 0) {
            return 'Delete or move this client\'s projects first.';
        }
        if (this._documents().some((d) => d.clientId === id)) {
            return 'Delete this client\'s documents first.';
        }
        this.usersOf(id).forEach((u) => this._access.setUserClient(u.id, null));
        this._clients.update((list) => list.filter((c) => c.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Documents
    // -----------------------------------------------------------------------------------------------------

    /** Staff (with "Edit") add company documents; a client (with "Submit") adds their own to their client. */
    canAddDocument(clientId: string): boolean {
        return (
            this._access.can('clients.edit') ||
            (this._access.can('clients.submit') && this._access.user().clientId === clientId)
        );
    }

    addDocument(clientId: string, input: DocumentInput): string | null {
        if (!this.canAddDocument(clientId)) {
            return 'You do not have permission to add documents for this client.';
        }
        if (!input.title.trim()) {
            return 'Enter a title.';
        }
        if (input.amount !== null && !(input.amount >= 0)) {
            return 'The amount cannot be negative.';
        }
        const fromClient = this.isClientUser;
        const doc: ClientDocument = {
            ...input,
            title: input.title.trim(),
            reference: input.reference.trim(),
            note: input.note.trim(),
            id: this._nextId('D-', this._documents().map((d) => d.id), 3001),
            clientId,
            from: fromClient ? 'client' : 'company',
            by: this._access.user().name,
            createdAt: DateTime.now().toISO(),
        };
        this._documents.update((list) => [doc, ...list]);
        return null;
    }

    canDeleteDocument(doc: ClientDocument): boolean {
        return this._access.can('clients.delete') || (doc.from === 'client' && this.isClientUser && doc.clientId === this._access.user().clientId);
    }

    deleteDocument(id: string): string | null {
        const doc = this._documents().find((d) => d.id === id);
        if (!doc || !this.canDeleteDocument(doc)) {
            return 'You cannot delete this document.';
        }
        this._documents.update((list) => list.filter((d) => d.id !== id));
        return null;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _visible<T extends { clientId: string }>(list: T[]): T[] {
        if (this._access.can('clients.view_all')) {
            return list;
        }
        const own = this._access.user().clientId;
        return list.filter((x) => x.clientId === own);
    }

    private _clean(input: ClientInput): ClientInput {
        const trimmed = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
        return trimmed as unknown as ClientInput;
    }

    private _validate(input: ClientInput, ignoreId?: string): string | null {
        if (!input.name.trim()) {
            return 'Enter the client name.';
        }
        if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
            return 'Enter a valid email address.';
        }
        const clash = this._clients().some((c) => c.id !== ignoreId && c.name.toLowerCase() === input.name.trim().toLowerCase());
        return clash ? 'A client with this name already exists.' : null;
    }

    private _nextId(prefix: string, ids: string[], start: number): string {
        const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length)) || 0), start - 1);
        return `${prefix}${max + 1}`;
    }

    private _daysAgo(days: number): string {
        return DateTime.now().minus({ days }).toISO();
    }

    private _seedClients(): Client[] {
        return [
            {
                id: 'C-1001', name: 'Bengal Steel Mills Ltd.', contactPerson: 'Karim Chowdhury', email: 'karim@bengalsteel.example',
                phone: '+880 1711-000111', address: 'Plot 14, BSCIC Industrial Area', city: 'Chattogram', country: 'Bangladesh',
                taxId: 'BIN 000123456-0101', industry: 'Manufacturing', website: 'bengalsteel.example', status: 'active',
                notes: 'Preferred contact by phone in the morning.', createdAt: this._daysAgo(200),
            },
            {
                id: 'C-1002', name: 'Delta Power Co.', contactPerson: 'Farhana Islam', email: 'farhana@deltapower.example',
                phone: '+880 1811-000222', address: 'House 8, Road 3, Gulshan', city: 'Dhaka', country: 'Bangladesh',
                taxId: 'BIN 000654321-0202', industry: 'Energy', website: 'deltapower.example', status: 'active',
                notes: '', createdAt: this._daysAgo(120),
            },
            {
                id: 'C-1003', name: 'Padma Textiles', contactPerson: 'Rashed Karim', email: 'rashed@padmatextiles.example',
                phone: '+880 1911-000333', address: 'Savar EPZ', city: 'Savar', country: 'Bangladesh',
                taxId: 'BIN 000777888-0303', industry: 'Textile', website: '', status: 'inactive',
                notes: 'On hold until next quarter.', createdAt: this._daysAgo(60),
            },
        ];
    }

    private _seedDocuments(): ClientDocument[] {
        const d = (id: string, clientId: string, projectId: string | null, type: ClientDocument['type'], title: string, reference: string, amount: number | null, days: number, from: 'client' | 'company', by: string, fileName: string | null): ClientDocument => ({
            id, clientId, projectId, type, title, reference, amount, date: this._daysAgo(days), note: '', fileName, from, by, createdAt: this._daysAgo(days),
        });
        return [
            d('D-3001', 'C-1001', 'P-2001', 'requirement', 'Panel specification and load list', 'REQ-BSM-01', null, 45, 'client', 'Karim Chowdhury', 'panel-spec.pdf'),
            d('D-3002', 'C-1001', 'P-2001', 'purchase_order', 'Purchase order for panel upgrade', 'PO-88231', 1850000, 40, 'client', 'Karim Chowdhury', 'po-88231.pdf'),
            d('D-3003', 'C-1001', 'P-2001', 'work_order', 'Work order WO-004-26-100051', 'WO-004-26-100051', 1850000, 38, 'company', 'Sara Khan', null),
            d('D-3004', 'C-1001', 'P-2001', 'delivery_challan', 'Delivery of panel boards', 'DC-0412', null, 9, 'company', 'Sara Khan', 'dc-0412.pdf'),
            d('D-3005', 'C-1001', 'P-2001', 'bill', 'Advance bill (50%)', 'INV-2026-114', 925000, 30, 'company', 'Nadia Rahman', 'inv-114.pdf'),
            d('D-3006', 'C-1002', 'P-2003', 'requirement', 'Generator capacity requirement', 'REQ-DPC-07', null, 28, 'client', 'Farhana Islam', 'gen-requirement.docx'),
            d('D-3007', 'C-1002', 'P-2003', 'purchase_order', 'Purchase order for generator', 'PO-DPC-552', 2400000, 26, 'client', 'Farhana Islam', null),
        ];
    }
}
