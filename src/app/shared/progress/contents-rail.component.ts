import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, effect, inject, input, signal } from '@angular/core';

import { JumpItem } from './progress.models';
import { TourPage } from '../../core/guide/guide.service';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';

/** The line, in pixels from the top of the window, a section's top must have passed to be the current one. */
export const CURRENT_LINE = 96;

/**
 * The section the reader is in: the last one whose top has passed the line, or the first one while
 * none has; at the foot of the page, the last one. `tops` are the sections' distances from the top of
 * the window, in page order.
 */
export function currentSection(tops: readonly { id: string; top: number }[], line = CURRENT_LINE, atEnd = false): string | null {
  if (!tops.length) {
    return null;
  }
  if (atEnd) {
    // A last section too short to reach the line is still the one being read at the foot of the page.
    return tops[tops.length - 1].id;
  }
  let current = tops[0].id;
  for (const entry of tops) {
    if (entry.top <= line) {
      current = entry.id;
    }
  }
  return current;
}

/**
 * The contents of a long page. From 1024 px it is a rail at the left of the sections, in place from
 * the start; on phones it is a row that sticks under the top. The current section follows the
 * scroll through an IntersectionObserver, and nothing is written to the address bar.
 */
@Component({
  selector: 'app-contents-rail',
  imports: [SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <nav class="rail" [attr.aria-label]="label()" [appSpotlight]="tour()" spotlightStep="nav">
        @for (item of items(); track item.id) {
          <a class="item" [class.on]="item.id === current()" [attr.href]="'#' + item.id" [attr.aria-current]="item.id === current() ? 'true' : null" (click)="go($event, item.id)">{{ item.label }}</a>
        }
      </nav>
    }
  `,
  styles: `
    :host { display: block; position: sticky; top: 0; z-index: var(--z-sticky); align-self: start; min-width: 0; }
    .rail { display: flex; gap: 20px; padding: 10px 0; overflow-x: auto; scrollbar-width: none; background: var(--bg); border-bottom: 1px solid var(--border); }
    .item { padding: 4px 0; border-bottom: 2px solid transparent; font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); text-decoration: none; white-space: nowrap; }
    .item:hover { color: var(--text-primary); }
    .item.on { font-weight: 600; color: var(--text-primary); border-bottom-color: var(--text-primary); }
    .item:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; border-radius: 4px; }
    @media (min-width: 1024px) {
      :host { top: 24px; }
      .rail { flex-direction: column; gap: 10px; padding: 0; overflow: visible; background: none; border: 0; }
      .item { padding: 4px 0 4px 12px; border-bottom: 0; border-left: 2px solid transparent; }
      .item.on { border-left-color: var(--text-primary); }
    }
  `
})
export class ContentsRailComponent {
  private readonly injector = inject(Injector);
  private observer: IntersectionObserver | null = null;
  private ids: readonly string[] = [];
  private frame = 0;
  private readonly onScroll = (): void => {
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.read(this.ids);
      });
    }
  };

  readonly items = input.required<readonly JumpItem[]>();
  readonly label = input('Sections of this page');
  /** The page's surface in the first-run guide, when its path points at this rail. */
  readonly tour = input<TourPage | null>(null);
  readonly current = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ids = this.items().map((item) => item.id);
      afterNextRender(() => this.watch(ids), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      window.removeEventListener('scroll', this.onScroll);
      cancelAnimationFrame(this.frame);
    });
  }

  go(event: Event, id: string): void {
    event.preventDefault();
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    this.current.set(id);
  }

  private read(ids: readonly string[]): void {
    const found = ids
      .map((id) => ({ id, element: document.getElementById(id) }))
      .filter((entry): entry is { id: string; element: HTMLElement } => entry.element !== null)
      .map((entry) => ({ id: entry.id, rect: entry.element.getBoundingClientRect() }));
    const tops = found.map((entry) => ({ id: entry.id, top: entry.rect.top }));
    // The foot of the page: the last section ends inside the window and the page has scrolled.
    const atEnd = window.scrollY > 0 && found.length > 0 && found[found.length - 1].rect.bottom <= window.innerHeight + 2;
    this.current.set(currentSection(tops, CURRENT_LINE, atEnd));
  }

  private watch(ids: readonly string[]): void {
    this.observer?.disconnect();
    this.observer = null;
    this.ids = ids;
    this.read(ids);
    // Only the foot of the page needs the scroll itself; every other change comes from the observer.
    window.removeEventListener('scroll', this.onScroll);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    // A band one pixel tall at the current line: the section that crosses it is the current one.
    const below = Math.max(window.innerHeight - CURRENT_LINE - 1, 0);
    this.observer = new IntersectionObserver(() => this.read(ids), { rootMargin: `-${CURRENT_LINE}px 0px -${below}px 0px`, threshold: [0, 1] });
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        this.observer.observe(element);
      }
    }
  }
}
