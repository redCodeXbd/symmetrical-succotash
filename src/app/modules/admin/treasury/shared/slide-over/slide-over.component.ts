import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Right-hand drawer with a backdrop. Content goes in the default slot, actions in [footer]. */
@Component({
    selector: 'treasury-slide-over',
    templateUrl: './slide-over.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [MatIconModule],
})
export class SlideOverComponent implements AfterViewInit {
    @Input() heading = '';
    @Input() subheading = '';
    /** A wider drawer, for long forms. */
    @Input() wide = false;
    @Output() closed = new EventEmitter<void>();
    @ViewChild('panel') panel: ElementRef<HTMLElement>;

    ngAfterViewInit(): void {
        this.panel.nativeElement.focus();
    }
}
