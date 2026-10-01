import { AccessService } from 'app/core/access/access.service';
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
    readonly wallpapers: { id: AppTheme['sidebarWallpaper']; name: string; preview: string }[] = [
        { id: 'aurora', name: 'Aurora', preview: 'linear-gradient(135deg, #39a935, #d5af36 60%, #14808a)' },
        { id: 'ocean', name: 'Ocean', preview: 'linear-gradient(135deg, #0ea5e9, #6366f1 60%, #14b8a6)' },
        { id: 'sunset', name: 'Sunset', preview: 'linear-gradient(135deg, #f97316, #ec4899 60%, #facc15)' },
        { id: 'mono', name: 'Mono', preview: 'linear-gradient(135deg, #e2e8f0, #64748b 60%, #0b0f14)' },
        { id: 'solid', name: 'Solid colour', preview: 'linear-gradient(135deg, #1f2937, #1f2937)' },
        { id: 'image', name: 'My image', preview: 'repeating-linear-gradient(45deg, #cbd5e1 0 6px, #e2e8f0 6px 12px)' },
    ];
    wallpaperError: string | null = null;
    readonly densities: { id: AppTheme['tableDensity']; name: string }[] = [
        { id: 'comfortable', name: 'Comfortable' },
        { id: 'compact', name: 'Compact' },
    ];
    logoError: string | null = null;
    savedMessage = false;

    constructor(
        public theme: ThemeService,
        public access: AccessService
    ) {}

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

    /** Reads a wallpaper and shrinks it, so it stays small enough to store. */
    onWallpaper(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        this.wallpaperError = null;
        if (!file) {
            return;
        }
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            this.wallpaperError = 'Use a PNG, JPG or WebP image.';
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            this.wallpaperError = 'The image must be 8 MB or smaller.';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1000 / img.naturalHeight, 700 / img.naturalWidth);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);
                canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                this.set({ sidebarWallpaper: 'image', sidebarImage: canvas.toDataURL('image/jpeg', 0.82) });
            };
            img.onerror = () => (this.wallpaperError = 'The image could not be read.');
            img.src = reader.result as string;
        };
        reader.onerror = () => (this.wallpaperError = 'The image could not be read.');
        reader.readAsDataURL(file);
    }

    removeLogo(): void {
        this.logoError = null;
        this.set({ logo: null });
    }
}
