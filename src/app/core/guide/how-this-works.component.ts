import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';

import { GUIDE_PATHS, SURFACE_LABELS } from './guide-paths';
import { TourPage } from './guide.service';
import { SpotlightPathService } from './spotlight-path.service';

/**
 * "How this works": a quiet link in the head row of a page, in the style of "Earlier weeks ›". It opens a small
 * sheet with three one-line bullets written from the steps of the surface's path, a filled "Show me" that plays
 * that path now and a quiet Close. The sheet never opens on its own; it is the way back for a person who closed
 * the tour or wants a reminder.
 */
@Component({
  selector: 'app-how-this-works',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismiss()' },
  template: `
    <button #trigger type="button" class="link" aria-haspopup="dialog" [attr.aria-expanded]="open()" (click)="open.set(true)">How this works</button>
    @if (open()) {
      <button type="button" class="scrim" tabindex="-1" aria-hidden="true" (click)="dismiss()"></button>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="how-this-works-title">
        <span class="eyebrow">{{ label() }}</span>
        <h2 id="how-this-works-title">How this works</h2>
        <ul>
          @for (bullet of bullets(); track $index) {
            <li>{{ bullet }}</li>
          }
        </ul>
        <div class="actions">
          <button #show type="button" class="primary" (click)="showMe()">Show me</button>
          <button type="button" class="quiet" (click)="dismiss()">Close</button>
        </div>
      </div>
    }
  `,
  styleUrl: './how-this-works.component.scss'
})
export class HowThisWorksComponent {
  private readonly path = inject(SpotlightPathService);

  /** The surface this link belongs to. */
  readonly surface = input.required<TourPage>();

  protected readonly open = signal(false);
  protected readonly label = computed(() => SURFACE_LABELS[this.surface()]);
  /** One bullet for each step of the path, in the words of the step. */
  protected readonly bullets = computed(() => GUIDE_PATHS[this.surface()].map((step) => step.copy('').text));

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected dismiss(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  /** Closes the sheet, then plays the path once the page behind it is clear. */
  protected showMe(): void {
    this.open.set(false);
    const surface = this.surface();
    setTimeout(() => this.path.replay(surface), 0);
  }
}
