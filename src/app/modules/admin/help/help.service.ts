import { Injectable } from '@angular/core';
import guides from './help-guides.json';
import pins from './help-pins.json';
import { Audience, HelpGuide, HelpGuideSpec, Pin } from './help.types';

/** Help guides come from help-guides.json; pins (where each step points) are measured by tools/help-capture.js. */
@Injectable({ providedIn: 'root' })
export class HelpService {
    readonly guides: HelpGuide[] = (guides as unknown as HelpGuideSpec[]).map((g) => {
        let n = 0;
        const shots = g.shots.map((s) => ({
            id: s.id,
            caption: s.caption,
            image: `images/help/${g.id}-${s.id}.jpg`,
            steps: s.steps.map((st, i) => {
                n += 1;
                const pin = ((pins as unknown as Record<string, (Pin | null)[]>)[`${g.id}.${s.id}`] ?? [])[i] ?? null;
                return { n, text: st.text, pin };
            }),
        }));
        return { ...g, shots, stepCount: n };
    });

    guide(id: string): HelpGuide | null {
        return this.guides.find((g) => g.id === id) ?? null;
    }

    forAudience(audience: Audience | 'all'): HelpGuide[] {
        return audience === 'all' ? this.guides : this.guides.filter((g) => g.audiences.includes(audience));
    }

    features(): string[] {
        return [...new Set(this.guides.map((g) => g.feature))];
    }

    search(list: HelpGuide[], query: string): HelpGuide[] {
        const q = query.trim().toLowerCase();
        if (!q) {
            return list;
        }
        return list.filter((g) =>
            [g.title, g.feature, g.brief, ...g.useCases, ...g.shots.flatMap((s) => s.steps.map((x) => x.text))].some((t) => t.toLowerCase().includes(q))
        );
    }
}
