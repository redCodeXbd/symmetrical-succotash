import { Component, Input, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ReportExportService } from '../report-export.service';
import { FORMAT_LABELS, ReportDoc, ReportFormat } from '../report.types';
import { ShareDialogComponent } from '../share-dialog/share-dialog.component';

/** "Download" menu (one item per format) plus a share-link generator. */
@Component({
    selector: 'treasury-export-menu',
    templateUrl: './export-menu.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule],
})
export class ExportMenuComponent {
    /** Builds the report from the current screen state when an action is chosen. */
    @Input({ required: true }) build: () => ReportDoc;
    @Input() formats: ReportFormat[] = ['pdf'];
    @Input() disabled = false;

    readonly labels = FORMAT_LABELS;
    busy: ReportFormat | null = null;
    error: string | null = null;

    constructor(
        private _export: ReportExportService,
        private _dialog: MatDialog
    ) {}

    async download(format: ReportFormat): Promise<void> {
        this.busy = format;
        this.error = null;
        try {
            await this._export.download(this.build(), format);
        } catch {
            this.error = 'The file could not be created. Please try again.';
        } finally {
            this.busy = null;
        }
    }

    share(): void {
        this._dialog.open(ShareDialogComponent, {
            width: '480px',
            maxWidth: '95vw',
            data: { doc: this.build(), formats: this.formats },
        });
    }
}
