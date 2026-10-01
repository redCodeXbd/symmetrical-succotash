import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReportExportService } from 'app/modules/admin/treasury/shared/report-export.service';
import { FORMAT_LABELS, FORMATS_BY_KIND, ReportFormat } from 'app/modules/admin/treasury/shared/report.types';
import { ShareRecord, ShareService } from 'app/modules/admin/treasury/shared/share.service';

/** Public, read-only page that a share link opens. */
@Component({
    selector: 'shared-report',
    templateUrl: './shared-report.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DatePipe, DecimalPipe],
})
export class SharedReportComponent {
    readonly labels = FORMAT_LABELS;
    record: ShareRecord | null;
    busy = false;
    error: string | null = null;

    constructor(
        route: ActivatedRoute,
        share: ShareService,
        private _export: ReportExportService
    ) {
        this.record = share.get(route.snapshot.paramMap.get('token') ?? '');
    }

    get formats(): ReportFormat[] {
        return this.record ? FORMATS_BY_KIND[this.record.doc.kind] : [];
    }

    async download(format: ReportFormat): Promise<void> {
        if (!this.record) {
            return;
        }
        this.busy = true;
        this.error = null;
        try {
            await this._export.download(this.record.doc, format);
        } catch {
            this.error = 'The file could not be created. Please try again.';
        } finally {
            this.busy = false;
        }
    }
}
