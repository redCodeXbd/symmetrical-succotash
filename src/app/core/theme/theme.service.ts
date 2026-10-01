import { computed, Injectable, signal } from '@angular/core';
import chroma from 'chroma-js';
import { AppTheme, DEFAULT_LOGO, DEFAULT_THEME } from './theme.types';

const STORAGE_KEY = 'encore.theme';
const HUES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Runtime theming. Writes the colours as CSS variables on <body>, which the Fuse/Tailwind
 * utilities (bg-primary, bg-card, text-default ...) and our own styles already read, so the
 * whole interface follows. The saved theme lives in localStorage until there is a backend.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    /** The theme currently shown. It can differ from `saved` while the user is previewing. */
    readonly theme = signal<AppTheme>({ ...DEFAULT_THEME });
    private _saved = signal<AppTheme>({ ...DEFAULT_THEME });

    readonly dirty = computed(() => JSON.stringify(this.theme()) !== JSON.stringify(this._saved()));
    readonly logoUrl = computed(() => this.theme().logo ?? DEFAULT_LOGO);

    /** Loads the saved theme and applies it. Call once at startup. */
    init(): void {
        const saved = this._load();
        this._saved.set(saved);
        this.theme.set(saved);
        this._apply(saved);
    }

    /** Previews a change without saving it. */
    patch(changes: Partial<AppTheme>): void {
        const next = { ...this.theme(), ...changes };
        this.theme.set(next);
        this._apply(next);
    }

    save(): void {
        const theme = this.theme();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
        } catch {
            // Storage can be blocked or full (large logos); the theme then lasts for this session only.
        }
        this._saved.set(theme);
    }

    /** Drops unsaved changes. */
    revert(): void {
        this.theme.set(this._saved());
        this._apply(this._saved());
    }

    /** Back to the built-in Encore theme (still needs Save to stick). */
    restoreDefaults(): void {
        this.theme.set({ ...DEFAULT_THEME });
        this._apply(DEFAULT_THEME);
    }

    isValidColor(value: string): boolean {
        return /^#[0-9a-f]{6}$/i.test(value.trim());
    }

    /** WCAG contrast ratio of two colours, to warn about unreadable pairs. */
    contrast(a: string, b: string): number {
        return chroma.contrast(a, b);
    }

    /** Auto-picks readable text for a coloured background. */
    onColor(bg: string): string {
        return chroma.contrast(bg, '#ffffff') >= 4.5 ? '#ffffff' : '#111827';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private
    // -----------------------------------------------------------------------------------------------------

    private _load(): AppTheme {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (stored && typeof stored === 'object') {
                const theme = { ...DEFAULT_THEME };
                for (const key of Object.keys(DEFAULT_THEME) as (keyof AppTheme)[]) {
                    if (typeof stored[key] === typeof DEFAULT_THEME[key] || (key === 'logo' && typeof stored[key] === 'string')) {
                        (theme as any)[key] = stored[key];
                    }
                }
                return theme;
            }
        } catch {
            // Fall through to the defaults.
        }
        return { ...DEFAULT_THEME };
    }

    private _palette(base: string): Record<number, string> {
        const c = chroma(base);
        const light = (t: number) => chroma.mix('#ffffff', c, t, 'lab').hex();
        const dark = (t: number) => chroma.mix(c, '#000000', t, 'lab').hex();
        return {
            50: light(0.08), 100: light(0.16), 200: light(0.32), 300: light(0.5), 400: light(0.72),
            500: c.hex(),
            600: dark(0.08), 700: dark(0.17), 800: dark(0.3), 900: dark(0.45), 950: dark(0.6),
        };
    }

    private _apply(t: AppTheme): void {
        const vars: Record<string, string> = {};
        const rgb = (hex: string) => chroma(hex).rgb().join(',');
        const set = (name: string, hex: string) => {
            vars[`--fuse-${name}`] = hex;
            vars[`--fuse-${name}-rgb`] = rgb(hex);
        };

        // Palettes used by bg-primary-600, text-primary, mat buttons and so on.
        for (const [name, base] of [['primary', t.primary], ['accent', t.accent], ['warn', t.danger]] as const) {
            const palette = this._palette(base);
            for (const hue of HUES) {
                set(`${name}-${hue}`, palette[hue]);
                set(`on-${name}-${hue}`, this.onColor(palette[hue]));
            }
            set(name, base);
            set(`on-${name}`, this.onColor(base));
        }

        // Page, surfaces and text.
        const mix = (a: string, b: string, amount: number) => chroma.mix(a, b, amount, 'lab').hex();
        set('bg-default', t.pageBg);
        set('bg-card', t.cardBg);
        set('bg-dialog', t.cardBg);
        set('bg-app-bar', t.headerBg);
        set('bg-status-bar', mix(t.pageBg, t.text, 0.15));
        vars['--fuse-bg-hover'] = chroma(t.text).alpha(0.06).css();
        vars['--fuse-bg-hover-rgb'] = rgb(t.text);
        set('text-default', t.text);
        set('text-secondary', mix(t.text, t.cardBg, 0.4));
        set('text-hint', mix(t.text, t.cardBg, 0.55));
        set('text-disabled', mix(t.text, t.cardBg, 0.55));
        set('border', mix(t.cardBg, t.text, 0.14));

        // Our own variables: sidebar, header and the sign-in pages.
        set('app-sidebar-bg', t.sidebarBg);
        set('app-sidebar-text', t.sidebarText);
        set('app-sidebar-active', t.sidebarActive);
        set('app-sidebar-active-text', this.onColor(t.sidebarActive));
        set('app-header-bg', t.headerBg);
        set('app-header-text', t.headerText);

        set('auth-bg', t.sidebarBg);
        set('auth-card', mix(t.sidebarBg, t.sidebarText, 0.07));
        set('auth-input', mix(t.sidebarBg, t.sidebarText, 0.03));
        set('auth-border', mix(t.sidebarBg, t.sidebarText, 0.2));
        set('auth-border-strong', mix(t.sidebarBg, t.sidebarText, 0.3));
        set('auth-text', t.sidebarText);
        set('auth-muted', mix(t.sidebarText, t.sidebarBg, 0.35));
        set('auth-primary', t.primary);
        set('auth-primary-hover', mix(t.primary, '#ffffff', 0.12));
        set('auth-on-primary', this.onColor(t.primary));
        // A link must stay readable on the sign-in background, so lighten or darken it as needed.
        set('auth-link', this._readable(t.primary, t.sidebarBg));
        set('auth-accent', t.accent);
        vars['--fuse-auth-glow'] = chroma(t.primary).alpha(0.25).css();

        const style = document.body.style;
        for (const [name, value] of Object.entries(vars)) {
            style.setProperty(name, value);
        }
    }

    /** Nudges a colour until it reaches a 4.5:1 contrast against a background. */
    private _readable(color: string, bg: string): string {
        let c = chroma(color);
        const lighter = chroma(bg).luminance() < 0.5;
        for (let i = 0; i < 10 && chroma.contrast(c, bg) < 4.5; i++) {
            c = lighter ? c.brighten(0.4) : c.darken(0.4);
        }
        return c.hex();
    }
}
