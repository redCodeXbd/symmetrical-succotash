import { computed, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { RoleService, AppRole } from 'app/core/role/role.service';
import { FundsService } from 'app/modules/admin/treasury/funds/funds.service';
import { FundEventType, FundRequest, FundRequestEvent } from 'app/modules/admin/treasury/funds/funds.types';
import { Notification } from './notifications.types';

const STORAGE_KEY = 'encore.notifications';
/** Older events are treated as already read, so a fresh login does not start with a wall of unread items. */
const UNREAD_WITHIN_DAYS = 3;
const MAX_ITEMS = 40;

interface RoleState {
    read: string[];
    unread: string[];
    dismissed: string[];
}

const ICONS: Record<FundEventType, string> = {
    submitted: 'heroicons_solid:plus-circle',
    edited: 'heroicons_solid:pencil-square',
    approved: 'heroicons_solid:check-circle',
    rejected: 'heroicons_solid:x-circle',
    cancelled: 'heroicons_solid:no-symbol',
    payment: 'heroicons_solid:banknotes',
    closed: 'heroicons_solid:lock-closed',
    return_requested: 'heroicons_solid:arrow-uturn-left',
    return_received: 'heroicons_solid:inbox-arrow-down',
    return_rejected: 'heroicons_solid:x-circle',
};

const escape = (text: string): string =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Builds the bell's notifications from the actions on fund requests.
 *
 *  - Admin: every action.
 *  - Accountant: every action taken by an employee (new requests, edits, cancellations, returns, closing).
 *  - Employee: actions Accounts or Admin took on his own requests (approved, rejected, paid, return confirmed...).
 *
 * Read, unread and dismissed flags are remembered per role in this browser.
 */
@Injectable({ providedIn: 'root' })
export class FundNotificationsService {
    private _state = signal<Record<string, RoleState>>(this._load());

    readonly notifications = computed<Notification[]>(() => {
        const role = this._roles.role();
        const state = this._state()[role] ?? { read: [], unread: [], dismissed: [] };
        const read = new Set(state.read);
        const unread = new Set(state.unread);
        const dismissed = new Set(state.dismissed);
        const cutoff = DateTime.now().minus({ days: UNREAD_WITHIN_DAYS });

        return this._funds
            .requests()
            .flatMap((r) => r.events.map((e) => ({ r, e })))
            .filter(({ r, e }) => this._visible(role, r, e))
            .map(({ r, e }) => {
                const id = `${r.id}|${e.at}|${e.type}`;
                const isOld = DateTime.fromISO(e.at) < cutoff;
                return {
                    id,
                    icon: ICONS[e.type],
                    title: this._title(r, e),
                    description: this._description(r, e),
                    time: e.at,
                    link: '/treasury/funds',
                    queryParams: { request: r.id },
                    useRouter: true,
                    read: read.has(id) || (isOld && !unread.has(id)),
                } as Notification;
            })
            .filter((n) => !dismissed.has(n.id))
            .sort((a, b) => b.time.localeCompare(a.time))
            .slice(0, MAX_ITEMS);
    });

    readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

    constructor(
        private _funds: FundsService,
        private _roles: RoleService
    ) {}

    markRead(id: string): void {
        this._update((s) => ({ ...s, read: add(s.read, id), unread: without(s.unread, id) }));
    }

    toggleRead(n: Notification): void {
        this._update((s) =>
            n.read
                ? { ...s, read: without(s.read, n.id), unread: add(s.unread, n.id) }
                : { ...s, read: add(s.read, n.id), unread: without(s.unread, n.id) }
        );
    }

    markAllRead(): void {
        const ids = this.notifications().map((n) => n.id);
        this._update((s) => ({ ...s, read: [...new Set([...s.read, ...ids])], unread: [] }));
    }

    dismiss(id: string): void {
        this._update((s) => ({ ...s, dismissed: add(s.dismissed, id) }));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Rules and wording
    // -----------------------------------------------------------------------------------------------------

    /** Who is allowed to be told about an event. */
    private _visible(role: AppRole, request: FundRequest, event: FundRequestEvent): boolean {
        const byStaff = event.by === 'Accounts' || event.by === 'Admin';
        switch (role) {
            case 'admin':
                return true;
            case 'accountant':
                return !byStaff;
            default:
                return request.employee === this._funds.currentEmployee && byStaff;
        }
    }

    private _title(r: FundRequest, e: FundRequestEvent): string {
        const id = `<strong>${escape(r.id)}</strong>`;
        const labels: Record<FundEventType, string> = {
            submitted: `New request ${id}`,
            edited: `Request ${id} edited`,
            approved: `Request ${id} approved`,
            rejected: `Request ${id} rejected`,
            cancelled: `Request ${id} cancelled`,
            payment: `Payment on ${id}`,
            closed: `Request ${id} closed`,
            return_requested: `Return requested on ${id}`,
            return_received: `Return received on ${id}`,
            return_rejected: `Return rejected on ${id}`,
        };
        return labels[e.type];
    }

    private _description(r: FundRequest, e: FundRequestEvent): string {
        const who = this._roles.role() === 'employee' ? '' : `${escape(e.by)}${e.by === r.employee ? '' : ` on ${escape(r.employee)}'s request`}. `;
        const detail = e.note ? escape(e.note) : escape(r.purpose);
        return `${who}${detail}`;
    }

    private _update(fn: (s: RoleState) => RoleState): void {
        const role = this._roles.role();
        this._state.update((all) => ({ ...all, [role]: fn(all[role] ?? { read: [], unread: [], dismissed: [] }) }));
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state()));
        } catch {
            // Storage can be blocked; flags then last for this session only.
        }
    }

    private _load(): Record<string, RoleState> {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        } catch {
            return {};
        }
    }
}

const add = (list: string[], id: string): string[] => (list.includes(id) ? list : [...list, id]);
const without = (list: string[], id: string): string[] => list.filter((x) => x !== id);
