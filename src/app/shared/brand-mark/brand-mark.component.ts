import { Component } from '@angular/core';

/** The Encore "E" mark. Its two letters use the theme's primary and accent colours. */
@Component({
    selector: 'app-brand-mark',
    standalone: true,
    template: `
        <svg viewBox="0 0 100 120" class="block h-auto w-full" role="img" aria-label="Encore">
            <g fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
                <path d="M50 10H14V82H50M14 46H42" stroke="var(--fuse-primary)" />
                <path d="M50 38H86V110H50M86 74H58" stroke="var(--fuse-accent)" />
            </g>
        </svg>
    `,
    host: { class: 'inline-block' },
})
export class BrandMarkComponent {}
