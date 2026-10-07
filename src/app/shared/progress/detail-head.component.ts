import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { HeroStat } from './progress.models';
import { TourPage } from '../../core/guide/guide.service';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';

/** True when the entry before this one in the history is a page of this app (Angular numbers its navigations from 1). */
export function cameFromThisApp(state: unknown): boolean {
  const id = (state as { navigationId?: unknown } | null)?.navigationId;
  return typeof id === 'number' && id > 1;
}

/**
 * The head of a Progress detail page: a way back, the eyebrow with the period at the right, the
 * verdict in the page's one large serif line, one sentence, and the four figures of the page as a
 * row. Back goes one step in the history when that step is inside the app, and to the fallback
 * page when the page was opened from a link.
 */
@Component({
  selector: 'app-detail-head',
  imports: [SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="back" [appSpotlight]="surface()" spotlightStep="back" (click)="back()">
      <span aria-hidden="true">‹</span> {{ backLabel() }}
    </button>
    <div class="line">
      <span class="eyebrow">{{ eyebrow() }}</span>
      <div class="tools">
        <ng-content select="[headPeriod]" />
      </div>
    </div>
    <div class="answer">
      <h1 class="verdict" [class.ink]="tone() === 'ink'">{{ verdict() }}</h1>
      @if (sentence()) {
        <p class="sentence">{{ sentence() }}</p>
      }
    </div>
    @if (stats().length) {
      <dl class="figures">
        @for (stat of stats(); track stat.label) {
          <div class="figure">
            <dt>{{ stat.label }}</dt>
            <dd class="value">{{ stat.value }}@if (stat.unit) {<span class="unit"> {{ stat.unit }}</span>}</dd>
            @if (stat.context) {
              <dd class="context">{{ stat.context }}</dd>
            }
          </div>
        }
      </dl>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .back { align-self: flex-start; padding: 0; border: 0; background: none; font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); cursor: pointer; }
    .back:hover { text-decoration: underline; text-underline-offset: 4px; }
    .back:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .tools { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .eyebrow { font: 700 var(--pg-eyebrow) var(--font-sans); letter-spacing: var(--pg-eyebrow-tracking); text-transform: uppercase; color: var(--text-secondary); }
    .answer { display: flex; flex-direction: column; gap: 10px; }
    .verdict { margin: 0; font: 600 var(--pg-verdict) / 1.1 var(--font-display); letter-spacing: -0.01em; color: var(--accent-text); }
    .verdict.ink { color: var(--text-primary); }
    .sentence { margin: 0; max-width: var(--pg-answer-measure); font: 400 var(--pg-answer) / 1.45 var(--font-sans); color: var(--text-primary); }
    .figures { margin: 6px 0 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 24px; }
    .figure { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    dt, .context { font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    dd { margin: 0; }
    .value { font: 600 var(--pg-chip-figure) / 1.2 var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .unit { font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); }
    @media (max-width: 640px) { .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `
})
export class DetailHeadComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  /** Read once, when the page opens, so a period switch that replaces the entry cannot change it. */
  private readonly inApp = cameFromThisApp(typeof history === 'undefined' ? null : history.state);

  readonly eyebrow = input.required<string>();
  readonly verdict = input.required<string>();
  /** Green for a good answer, ink for the rest. */
  readonly tone = input<'good' | 'ink'>('good');
  readonly sentence = input('');
  readonly stats = input<readonly HeroStat[]>([]);
  readonly fallback = input('/progress');
  readonly backLabel = input('Progress');
  /** The page's surface in the first-run guide; it gives the page a "How this works" link and its Back an anchor. */
  readonly surface = input<TourPage | null>(null);

  back(): void {
    if (this.inApp) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.fallback());
    }
  }
}
