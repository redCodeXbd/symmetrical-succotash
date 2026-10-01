import { BrandMarkComponent } from 'app/shared/brand-mark/brand-mark.component';
import { Component, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'landing-home',
    templateUrl: './home.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [BrandMarkComponent, MatButtonModule, RouterLink, MatIconModule],
})
export class LandingHomeComponent {
    /**
     * Constructor
     */
    constructor() {}
}
