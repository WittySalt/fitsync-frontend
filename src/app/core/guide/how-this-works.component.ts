import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { GUIDE_PATHS, SURFACE_LABELS, surfaceForUrl } from './guide-paths';
import { GuideService, TourPage } from './guide.service';
import { SpotlightPathService } from './spotlight-path.service';

/**
 * The "?" of the guide, the one entry to every path: a round button in the style of the theme toggle. It knows which
 * surface is on screen (the open coach dock first, then the surface the page published, then the route), and opens a
 * small sheet with three one-line bullets written from the steps of that surface's path, a filled "Show me" that plays
 * the path now and a quiet Close. The sheet never opens on its own. When the surface has no path the button is not drawn.
 *
 * The top bar carries it without an input. A full-screen view that hides the top bar (the session player, the live
 * tracker, cook mode) carries its own copy at the end of its top strip and names its surface.
 */
@Component({
  selector: 'app-how-this-works',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismiss()' },
  template: `
    @if (resolved(); as page) {
      <button
        #trigger
        type="button"
        class="round"
        aria-haspopup="dialog"
        aria-label="How this works"
        title="How this works"
        [attr.aria-expanded]="open()"
        (click)="open.set(true)"
      >
        <span aria-hidden="true">?</span>
      </button>
      @if (open()) {
        <button type="button" class="scrim" tabindex="-1" aria-hidden="true" (click)="dismiss()"></button>
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="how-this-works-title">
          <span class="eyebrow">{{ labels[page] }}</span>
          <h2 id="how-this-works-title">How this works</h2>
          <ul>
            @for (bullet of bullets(page); track $index) {
              <li>{{ bullet }}</li>
            }
          </ul>
          <div class="actions">
            <button type="button" class="primary" (click)="showMe(page)">Show me</button>
            <button type="button" class="quiet" (click)="dismiss()">Close</button>
          </div>
        </div>
      }
    }
  `,
  styleUrl: './how-this-works.component.scss'
})
export class HowThisWorksComponent {
  private readonly path = inject(SpotlightPathService);
  private readonly guide = inject(GuideService);
  private readonly router = inject(Router);

  /** The surface a full-screen view names for itself; the top bar leaves it empty and follows the page. */
  readonly surface = input<TourPage | null>(null);

  protected readonly labels = SURFACE_LABELS;
  protected readonly open = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** The surface whose path the button opens, or null when there is none. */
  protected readonly resolved = computed<TourPage | null>(
    () => this.surface() ?? (this.guide.fullScreen() ? null : (this.guide.overlay() ?? this.guide.surface() ?? surfaceForUrl(this.url())))
  );

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  /** One bullet for each step of the path, in the words of the step. */
  protected bullets(page: TourPage): string[] {
    return GUIDE_PATHS[page].map((step) => step.copy('').text);
  }

  protected dismiss(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  /** Closes the sheet, then plays the path once the page behind it is clear. */
  protected showMe(page: TourPage): void {
    this.open.set(false);
    setTimeout(() => this.path.replay(page), 0);
  }
}
