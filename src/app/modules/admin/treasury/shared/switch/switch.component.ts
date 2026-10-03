import { Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * The one on/off switch of the app. Works with [(ngModel)], or with [checked] and (toggled).
 * Give it a label (and optionally a hint) for a clickable row, or only an ariaLabel for a bare switch in a table.
 */
@Component({
    selector: 'treasury-switch',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SwitchComponent), multi: true }],
    template: `
        <button type="button" role="switch" class="app-switch-row" [class.app-switch-row-bare]="!label" [disabled]="disabled" [attr.aria-checked]="checked" [attr.aria-label]="label ? null : ariaLabel" (click)="flip()" (blur)="onTouched()">
            <span class="app-switch" [class.app-switch-on]="checked" [class.app-switch-sm]="size === 'sm'" aria-hidden="true"><span class="app-switch-knob"></span></span>
            @if (label) {
                <span class="app-switch-text">
                    <span class="app-switch-label">{{ label }}</span>
                    @if (hint) { <span class="app-switch-hint">{{ hint }}</span> }
                </span>
            }
        </button>
    `,
})
export class SwitchComponent implements ControlValueAccessor {
    @Input() checked = false;
    @Input() label = '';
    @Input() hint = '';
    @Input() ariaLabel = '';
    @Input() size: 'md' | 'sm' = 'md';
    @Input() disabled = false;
    @Output() toggled = new EventEmitter<boolean>();

    private _onChange: (v: boolean) => void = () => {};
    onTouched: () => void = () => {};

    flip(): void {
        if (this.disabled) {
            return;
        }
        this.checked = !this.checked;
        this._onChange(this.checked);
        this.toggled.emit(this.checked);
    }

    writeValue(value: boolean): void {
        this.checked = !!value;
    }
    registerOnChange(fn: (v: boolean) => void): void {
        this._onChange = fn;
    }
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }
    setDisabledState(disabled: boolean): void {
        this.disabled = disabled;
    }
}
