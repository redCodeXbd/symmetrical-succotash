import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from 'app/core/theme/theme.service';
import { AppTheme, THEME_PRESETS, ThemePreset } from 'app/core/theme/theme.types';
import { ColorFieldComponent } from './color-field.component';

const MAX_LOGO_BYTES = 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

@Component({
    selector: 'settings-theme',
    templateUrl: './theme.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatButtonModule, MatIconModule, ColorFieldComponent],
})
export class ThemeSettingsComponent implements OnDestroy {
    readonly presets = THEME_PRESETS;
    readonly tableStyles: { id: AppTheme['tableStyle']; name: string; hint: string }[] = [
        { id: 'lines', name: 'Lines', hint: 'A thin line between rows' },
        { id: 'striped', name: 'Striped', hint: 'Every second row tinted' },
        { id: 'grid', name: 'Grid', hint: 'Lines around every cell' },
    ];
    readonly densities: { id: AppTheme['tableDensity']; name: string }[] = [
        { id: 'comfortable', name: 'Comfortable' },
        { id: 'compact', name: 'Compact' },
    ];
    logoError: string | null = null;
    savedMessage = false;

    constructor(public theme: ThemeService) {}

    get t(): AppTheme {
        return this.theme.theme();
    }

    /** Leaving the page drops anything that was only being previewed. */
    ngOnDestroy(): void {
        this.theme.revert();
    }

    set(changes: Partial<AppTheme>): void {
        this.savedMessage = false;
        this.theme.patch(changes);
    }

    applyPreset(preset: ThemePreset): void {
        this.set({ ...preset.colors, ...this.theme.deriveTable(preset.colors) });
    }

    isActive(preset: ThemePreset): boolean {
        const t = this.theme.theme();
        return (Object.keys(preset.colors) as (keyof ThemePreset['colors'])[]).every(
            (key) => preset.colors[key].toLowerCase() === t[key].toLowerCase()
        );
    }

    matchTable(): void {
        this.set(this.theme.deriveTable(this.t));
    }

    save(): void {
        this.theme.save();
        this.savedMessage = true;
    }

    discard(): void {
        this.savedMessage = false;
        this.theme.revert();
    }

    restoreDefaults(): void {
        this.savedMessage = false;
        this.theme.restoreDefaults();
    }

    /** "Low contrast" message when text on a background would be hard to read, else null. */
    contrastWarning(text: string, background: string, what: string): string | null {
        const ratio = this.theme.contrast(text, background);
        return ratio < 4.5 ? `${what} may be hard to read (contrast ${ratio.toFixed(1)}:1, aim for 4.5:1).` : null;
    }

    onLogo(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        this.logoError = null;
        if (!file) {
            return;
        }
        if (!LOGO_TYPES.includes(file.type)) {
            this.logoError = 'Use a PNG, JPG, WebP or SVG image.';
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            this.logoError = 'The logo must be 1 MB or smaller.';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => this.set({ logo: reader.result as string });
        reader.onerror = () => (this.logoError = 'The logo could not be read.');
        reader.readAsDataURL(file);
    }

    removeLogo(): void {
        this.logoError = null;
        this.set({ logo: null });
    }
}
