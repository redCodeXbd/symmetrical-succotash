import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';
import { ReportDoc, ReportFormat } from './report.types';

export interface ShareRecord {
    token: string;
    doc: ReportDoc;
    format: ReportFormat;
    createdAt: string;
    /** `null` means the link never expires. */
    expiresAt: string | null;
}

const KEY = 'encore.shares';

/**
 * Share links, kept in this browser's localStorage while there is no backend.
 * A link therefore only opens in the browser that created it. To make links work
 * for other people, replace `create` and `get` with API calls; callers stay unchanged.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
    create(doc: ReportDoc, format: ReportFormat, expiresInDays: number | null): ShareRecord {
        const record: ShareRecord = {
            token: this._token(),
            doc,
            format,
            createdAt: DateTime.now().toISO(),
            expiresAt: expiresInDays === null ? null : DateTime.now().plus({ days: expiresInDays }).toISO(),
        };
        this._write([...this._read(), record]);
        return record;
    }

    get(token: string): ShareRecord | null {
        const record = this._read().find((r) => r.token === token);
        if (!record || (record.expiresAt && DateTime.fromISO(record.expiresAt) < DateTime.now())) {
            return null;
        }
        return record;
    }

    url(token: string): string {
        return `${window.location.origin}/shared/${token}`;
    }

    private _token(): string {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    private _read(): ShareRecord[] {
        try {
            return JSON.parse(localStorage.getItem(KEY) ?? '[]');
        } catch {
            return [];
        }
    }

    private _write(records: ShareRecord[]): void {
        try {
            localStorage.setItem(KEY, JSON.stringify(records));
        } catch {
            // Storage can be blocked or full; the link then simply will not open later.
        }
    }
}
