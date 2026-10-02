import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { HelpService } from './help.service';
import { HelpGuide } from './help.types';

@Component({
    selector: 'help-guide',
    templateUrl: './help-guide.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatButtonModule, RouterLink],
})
export class HelpGuideComponent {
    private _id = signal('');
    /** The step the reader is pointing at, so its marker on the picture stands out. */
    active = signal<number | null>(null);
    zoom = signal<string | null>(null);

    guide = computed<HelpGuide | null>(() => this.help.guide(this._id()));
    related = computed(() => (this.guide()?.related ?? []).map((id) => this.help.guide(id)).filter((g): g is HelpGuide => !!g));

    constructor(
        public help: HelpService,
        public access: AccessService,
        route: ActivatedRoute
    ) {
        route.paramMap.subscribe((p) => {
            this._id.set(p.get('id') ?? '');
            this.active.set(null);
        });
    }

    /** Whether the acting user's roles are among those the guide is written for. */
    get forMe(): boolean {
        const g = this.guide();
        const ids = new Set(this.access.userRoles().map((r) => r.id));
        return !!g && g.audiences.some((a) => ids.has(a));
    }
}
