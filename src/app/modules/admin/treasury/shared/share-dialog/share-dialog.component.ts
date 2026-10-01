import { DatePipe } from '@angular/common';
import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FORMAT_LABELS, ReportDoc, ReportFormat } from '../report.types';
import { ShareRecord, ShareService } from '../share.service';

export interface ShareDialogData {
    doc: ReportDoc;
    formats: ReportFormat[];
}

@Component({
    selector: 'treasury-share-dialog',
    templateUrl: './share-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, FormsModule, MatButtonModule, MatDialogModule],
})
export class ShareDialogComponent {
    readonly labels = FORMAT_LABELS;
    readonly expiries: { label: string; days: number | null }[] = [
        { label: '1 day', days: 1 },
        { label: '7 days', days: 7 },
        { label: '30 days', days: 30 },
        { label: 'Never', days: null },
    ];

    format: ReportFormat;
    days: number | null = 7;
    record: ShareRecord | null = null;
    url = '';
    copied = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: ShareDialogData,
        private _share: ShareService
    ) {
        this.format = data.formats[0];
    }

    generate(): void {
        this.record = this._share.create(this.data.doc, this.format, this.days);
        this.url = this._share.url(this.record.token);
        this.copied = false;
    }

    async copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.url);
            this.copied = true;
        } catch {
            this.copied = false;
        }
    }

    reset(): void {
        this.record = null;
    }
}
