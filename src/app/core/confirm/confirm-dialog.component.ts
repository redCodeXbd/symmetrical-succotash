import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmOptions, ConfirmTone } from './confirm.service';

const DEFAULT_ICONS: Record<ConfirmTone, string> = {
    danger: 'heroicons_outline:trash',
    warning: 'heroicons_outline:exclamation-triangle',
    primary: 'heroicons_outline:question-mark-circle',
    success: 'heroicons_outline:check-circle',
};

@Component({
    selector: 'app-confirm-dialog',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatDialogModule, MatIconModule],
    template: `
        <div class="confirm-card" [class]="'confirm-' + tone" role="alertdialog" aria-modal="true" [attr.aria-label]="data.title">
            <div class="confirm-badge" aria-hidden="true"><mat-icon [svgIcon]="icon"></mat-icon></div>
            <h2 class="confirm-title">{{ data.title }}</h2>
            @if (data.message) { <p class="confirm-message">{{ data.message }}</p> }
            @if (data.details?.length) {
                <dl class="confirm-details">
                    @for (d of data.details; track d[0]) {
                        <div><dt>{{ d[0] }}</dt><dd>{{ d[1] }}</dd></div>
                    }
                </dl>
            }
            <div class="confirm-actions">
                <button type="button" class="confirm-btn confirm-btn-cancel" [attr.data-autofocus]="tone === 'danger' ? '' : null" (click)="close(false)">{{ data.cancelLabel || 'Cancel' }}</button>
                <button type="button" class="confirm-btn confirm-btn-ok" [attr.data-autofocus]="tone !== 'danger' ? '' : null" (click)="close(true)">{{ data.confirmLabel || 'Confirm' }}</button>
            </div>
            @if (data.note) { <div class="confirm-note">{{ data.note }}</div> }
        </div>
    `,
})
export class ConfirmDialogComponent {
    constructor(
        private _ref: MatDialogRef<ConfirmDialogComponent, boolean>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmOptions
    ) {}

    get tone(): ConfirmTone {
        return this.data.tone ?? 'primary';
    }

    get icon(): string {
        return this.data.icon ?? DEFAULT_ICONS[this.tone];
    }

    close(result: boolean): void {
        this._ref.close(result);
    }
}
