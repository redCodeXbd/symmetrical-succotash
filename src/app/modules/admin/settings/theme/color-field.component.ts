import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { ThemeService } from 'app/core/theme/theme.service';

let nextId = 0;

/** A colour swatch picker with a hex text box. Emits only valid #rrggbb values. */
@Component({
    selector: 'theme-color-field',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    template: `
        <div class="flex flex-col gap-1.5">
            <label [attr.for]="id" class="text-sm font-medium">{{ label }}</label>
            <div class="flex items-center gap-2">
                <input
                    type="color"
                    class="h-11 w-12 flex-none cursor-pointer rounded-lg border bg-transparent p-1"
                    [value]="value"
                    [attr.aria-label]="label + ' colour picker'"
                    (input)="pick($any($event.target).value)"
                />
                <input
                    [id]="id"
                    type="text"
                    maxlength="7"
                    spellcheck="false"
                    class="h-11 min-w-0 flex-auto rounded-lg border bg-transparent px-3 font-mono text-md uppercase"
                    [value]="value"
                    [attr.aria-invalid]="invalid"
                    (input)="type($any($event.target).value)"
                    (blur)="invalid = false; $any($event.target).value = value"
                />
            </div>
            @if (invalid) {
                <div class="text-xs text-red-600">Use a hex colour such as #39a935</div>
            } @else if (hint) {
                <div class="text-secondary text-xs">{{ hint }}</div>
            }
        </div>
    `,
})
export class ColorFieldComponent {
    @Input({ required: true }) label: string;
    @Input({ required: true }) value: string;
    @Input() hint = '';
    @Output() valueChange = new EventEmitter<string>();

    readonly id = `theme-color-${nextId++}`;
    invalid = false;

    constructor(private _theme: ThemeService) {}

    pick(value: string): void {
        this.invalid = false;
        this.valueChange.emit(value.toLowerCase());
    }

    type(raw: string): void {
        const value = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
        this.invalid = !this._theme.isValidColor(value);
        if (!this.invalid) {
            this.valueChange.emit(value.toLowerCase());
        }
    }
}
