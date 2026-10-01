import { AccessService } from 'app/core/access/access.service';
import { Component, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Category, CATEGORY_GROUPS, CategoryGroup, CategoryService } from 'app/core/categories/categories.service';
import { FundsService } from '../../treasury/funds/funds.service';
import { OrgFundsService } from '../../treasury/org-funds/org-funds.service';

/**
 * One section per feature. To add categories to a new feature: add its group in
 * `CATEGORY_GROUPS`, then add a section here with how to count its usage and how to
 * rename the category on its records.
 */
interface Section {
    group: CategoryGroup;
    /** Singular and plural noun for the records that use a category, e.g. "fund" and "funds". */
    noun: string;
    nounPlural: string;
    usage: (name: string) => number;
    rename: (from: string, to: string) => void;
}

@Component({
    selector: 'settings-categories',
    templateUrl: './categories.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [FormsModule, MatButtonModule],
})
export class CategoriesSettingsComponent {
    readonly sections: Section[];

    drafts: Record<string, { name: string; description: string }> = {};
    errors: Record<string, string | null> = {};
    editing: { groupId: string; id: string; name: string; description: string; from: string } | null = null;
    editError: string | null = null;
    deleting: { groupId: string; id: string } | null = null;

    constructor(
        public categories: CategoryService,
        public access: AccessService,
        org: OrgFundsService,
        funds: FundsService
    ) {
        const [orgGroup, requestGroup] = CATEGORY_GROUPS;
        this.sections = [
            {
                group: orgGroup,
                noun: 'fund',
                nounPlural: 'funds',
                usage: (name) => org.funds().filter((f) => f.category === name).length,
                rename: (from, to) => org.renameCategory(from, to),
            },
            {
                group: requestGroup,
                noun: 'request',
                nounPlural: 'requests',
                usage: (name) => funds.requests().filter((r) => r.category === name).length,
                rename: (from, to) => funds.renameRequestCategory(from, to),
            },
        ];
        for (const s of this.sections) {
            this.drafts[s.group.id] = { name: '', description: '' };
        }
    }

    add(section: Section): void {
        const d = this.drafts[section.group.id];
        const error = this.categories.add(section.group.id, d.name, d.description);
        this.errors[section.group.id] = error;
        if (!error) {
            this.drafts[section.group.id] = { name: '', description: '' };
        }
    }

    startEdit(section: Section, c: Category): void {
        this.deleting = null;
        this.editError = null;
        this.editing = { groupId: section.group.id, id: c.id, name: c.name, description: c.description, from: c.name };
    }

    saveEdit(section: Section): void {
        const e = this.editing;
        if (!e) {
            return;
        }
        const error = this.categories.update(e.groupId, e.id, e.name, e.description);
        this.editError = error;
        if (!error) {
            const to = e.name.trim();
            if (to !== e.from) {
                section.rename(e.from, to);
            }
            this.editing = null;
        }
    }

    cancelEdit(): void {
        this.editing = null;
        this.editError = null;
    }

    /** Deleting is blocked while records still use the category, so nothing is left without one. */
    remove(section: Section, c: Category): void {
        if (section.usage(c.name) > 0) {
            return;
        }
        this.categories.remove(section.group.id, c.id);
        this.deleting = null;
    }

    /** "1 fund", "3 funds". */
    usageText(section: Section, name: string): string {
        const n = section.usage(name);
        return `${n} ${n === 1 ? section.noun : section.nounPlural}`;
    }

    isEditing(groupId: string, id: string): boolean {
        return this.editing?.groupId === groupId && this.editing.id === id;
    }

    isDeleting(groupId: string, id: string): boolean {
        return this.deleting?.groupId === groupId && this.deleting.id === id;
    }
}
