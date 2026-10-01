import { Component, EventEmitter, HostListener, Input, Output, ViewEncapsulation } from '@angular/core';

/**
 * The "+ Add" action for list pages. On desktop it is a compact button with a keyboard hint;
 * on phones it becomes a floating button so the action stays reachable while scrolling long tables.
 * Pressing the shortcut key (default "N") also triggers it, unless the user is typing or a drawer is open.
 */
@Component({
    selector: 'treasury-add-button',
    templateUrl: './add-button.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
})
export class AddButtonComponent {
    @Input({ required: true }) label: string;
    @Input() shortcut = 'N';
    @Output() pressed = new EventEmitter<void>();

    @HostListener('document:keydown', ['$event'])
    onKey(event: KeyboardEvent): void {
        if (
            event.repeat ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.key.toLowerCase() !== this.shortcut.toLowerCase()
        ) {
            return;
        }
        const target = event.target as HTMLElement | null;
        const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
        const overlayOpen = !!document.querySelector('[role="dialog"], .cdk-overlay-pane');
        if (!typing && !overlayOpen) {
            event.preventDefault();
            this.pressed.emit();
        }
    }
}
