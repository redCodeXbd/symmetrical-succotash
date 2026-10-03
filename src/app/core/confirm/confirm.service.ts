import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';

export type ConfirmTone = 'danger' | 'warning' | 'primary' | 'success';

export interface ConfirmOptions {
    title: string;
    message?: string;
    tone?: ConfirmTone;
    /** A heroicons_outline icon name; each tone has a default. */
    icon?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Key facts shown in a small card, such as who, what and how much. */
    details?: [string, string][];
    /** A short footnote under the buttons, such as "This cannot be undone". */
    note?: string;
}

/**
 * The one floating confirmation of the app. Ask before anything that deletes, changes or moves money:
 * `if (await this._confirm.delete('this vendor')) { ... }`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
    constructor(private _dialog: MatDialog) {}

    async ask(options: ConfirmOptions): Promise<boolean> {
        const ref = this._dialog.open(ConfirmDialogComponent, {
            data: options,
            width: '440px',
            maxWidth: '94vw',
            panelClass: 'confirm-panel',
            backdropClass: 'confirm-backdrop',
            autoFocus: '[data-autofocus]',
            restoreFocus: true,
        });
        return (await firstValueFrom(ref.afterClosed())) === true;
    }

    /** Delete confirmations: red, with "cannot be undone". */
    delete(what: string, options: Partial<ConfirmOptions> = {}): Promise<boolean> {
        return this.ask({
            title: `Delete ${what}?`,
            message: 'This removes it from the records.',
            tone: 'danger',
            icon: 'heroicons_outline:trash',
            confirmLabel: 'Yes, delete',
            note: 'This cannot be undone.',
            ...options,
        });
    }

    /** Saving changes to something that already exists. */
    update(what: string, options: Partial<ConfirmOptions> = {}): Promise<boolean> {
        return this.ask({
            title: `Save changes to ${what}?`,
            message: 'The existing details will be replaced.',
            tone: 'primary',
            icon: 'heroicons_outline:pencil-square',
            confirmLabel: 'Yes, save',
            ...options,
        });
    }
}
