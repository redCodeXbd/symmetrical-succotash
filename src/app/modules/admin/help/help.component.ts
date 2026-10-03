import { watchQuery } from 'app/core/navigation/deep-link';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccessService } from 'app/core/access/access.service';
import { UserSwitchComponent } from '../treasury/shared/user-switch/user-switch.component';
import { HelpService } from './help.service';
import { AUDIENCES, Audience } from './help.types';

@Component({
    selector: 'help-center',
    templateUrl: './help.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, RouterLink, UserSwitchComponent],
})
export class HelpComponent {
    readonly audiences = AUDIENCES;
    search = signal('');
    /** Starts on the signed-in person's own roles; "all" shows everything. */
    audience = signal<Audience | 'all'>('all');
    feature = signal('all');

    /** Menu links: ?audience=employee|admin|..., ?feature=Expenses */
    private _deep = watchQuery((q) => {
        const audience = q.get('audience');
        if (audience) {
            this.audience.set(audience as Audience | 'all');
        }
        const feature = q.get('feature');
        if (feature) {
            this.feature.set(feature);
        }
    }, []);

    constructor(
        public help: HelpService,
        public access: AccessService
    ) {
        this.audience.set(this.mine[0] ?? 'all');
    }

    /** The audiences the acting user belongs to, from their roles. */
    get mine(): Audience[] {
        const ids = new Set(this.access.userRoles().map((r) => r.id));
        return AUDIENCES.filter((a) => ids.has(a.id)).map((a) => a.id);
    }

    list = computed(() => {
        const byAudience = this.help.forAudience(this.audience());
        const byFeature = this.feature() === 'all' ? byAudience : byAudience.filter((g) => g.feature === this.feature());
        return this.help.search(byFeature, this.search());
    });

    features = computed(() => [...new Set(this.help.forAudience(this.audience()).map((g) => g.feature))]);

    pick(a: Audience | 'all'): void {
        this.audience.set(a);
        this.feature.set('all');
    }

    count(a: Audience): number {
        return this.help.forAudience(a).length;
    }
}
