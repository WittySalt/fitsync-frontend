import {
  ApplicationRef,
  ComponentRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  OnDestroy,
  OnInit,
  createComponent,
  effect,
  inject,
  input,
  untracked
} from '@angular/core';

import { GuideService, TourPage } from './guide.service';
import { SpotlightComponent } from './spotlight.component';

/** The words of each page's spotlight. */
export const SPOTLIGHT_COPY: Record<TourPage, { title: string; text: string }> = {
  workout: { title: 'Today starts here', text: 'This card shows what your plan has for today. Start from here and the session keeps its own count.' },
  nutrition: { title: 'Add a meal', text: 'Add puts a food, a recipe or a saved meal on this meal. One entry is enough for the day to start adding up.' },
  progress: { title: 'Pick a period', text: 'Switch the period to read the same answer over a week, a month or longer.' },
  me: { title: 'What your coach reads', text: 'Everything here is what the coach knows about you. Tap anything to change it.' }
};

/**
 * Marks the key control of a page for its first-visit spotlight. Put it on the anchor element with the page it
 * belongs to, or null to leave that anchor alone. The spotlight opens once the guide says it is due and is
 * recorded as seen when it closes, so it never appears twice.
 */
@Directive({ selector: '[appSpotlight]' })
export class SpotlightDirective implements OnInit, OnDestroy {
  readonly appSpotlight = input<TourPage | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly guide = inject(GuideService);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  private overlay: ComponentRef<SpotlightComponent> | null = null;
  private shownFor: TourPage | null = null;
  private readonly reposition = (): void => this.place();

  constructor() {
    effect(() => {
      const page = this.appSpotlight();
      if (page && this.guide.spotlightDue(page) && !this.overlay) {
        untracked(() => this.open(page));
      }
    });
  }

  ngOnInit(): void {
    if (this.appSpotlight()) {
      this.guide.start();
    }
  }

  ngOnDestroy(): void {
    this.close();
  }

  private open(page: TourPage): void {
    const anchor = this.host.nativeElement;
    anchor.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    const copy = SPOTLIGHT_COPY[page];
    const overlay = createComponent(SpotlightComponent, { environmentInjector: this.injector });
    overlay.setInput('title', copy.title);
    overlay.setInput('text', copy.text);
    overlay.setInput('rect', this.measure());
    overlay.instance.gotIt.subscribe(() => this.close());
    overlay.instance.skip.subscribe(() => {
      this.guide.skipTour();
      this.close();
    });
    this.appRef.attachView(overlay.hostView);
    document.body.appendChild(overlay.location.nativeElement);
    this.overlay = overlay;
    this.shownFor = page;
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
  }

  private measure(): { top: number; left: number; width: number; height: number } {
    const r = this.host.nativeElement.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  private place(): void {
    this.overlay?.setInput('rect', this.measure());
    this.overlay?.setInput('viewport', { width: window.innerWidth, height: window.innerHeight });
  }

  /** Closing, or leaving the page with the spotlight open, records the page as seen. */
  private close(): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    this.overlay = null;
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.appRef.detachView(overlay.hostView);
    overlay.destroy();
    if (this.shownFor) {
      this.guide.markSeen(this.shownFor);
    }
  }
}
