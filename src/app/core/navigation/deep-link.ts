import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

/**
 * Lets a menu link open a page already on the right tab, filter or form, such as `/expenses?status=pending`
 * or `/expenses?action=add`. Call it once while a component is being created.
 *
 * The handler runs when the page opens and again whenever the query changes. A one-shot `action` (open a
 * form) is removed from the address afterwards so a refresh does not open it again; tabs and filters stay.
 */
export function watchQuery(handler: (query: ParamMap) => void, oneShot: string[] = ['action']): void {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((query) => {
        // Wait a tick so every field of the component exists before the handler uses it.
        Promise.resolve().then(() => handler(query));
        if (oneShot.some((k) => query.has(k))) {
            void router.navigate([], {
                relativeTo: route,
                queryParams: Object.fromEntries(oneShot.map((k) => [k, null])),
                queryParamsHandling: 'merge',
                replaceUrl: true,
            });
        }
    });
}

/** Scrolls an element with this id into view once the page has drawn. */
export function scrollToId(id: string): void {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}
