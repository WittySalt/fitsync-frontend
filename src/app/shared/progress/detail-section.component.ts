import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { CoachStore } from '../../core/coach/coach.store';
import { ProgressCardContext } from './progress.models';
import { TourPage } from '../../core/guide/guide.service';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';

/**
 * One section of a Progress detail page: its name and one sentence that says what the picture shows
 * on the left, the Ask pill at the right of the same row, then the picture. A hairline marks its
 * top; the detail layout sets `--section-rule` to transparent on the first section of a page and
 * trims its `--section-pad-top`. Longer explanations go into `ask`, the text Ask puts in the composer.
 */
@Component({
  selector: 'app-detail-section',
  imports: [SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [attr.id]="anchor() || null" [attr.aria-label]="name()">
      <header class="head">
        <div class="titles">
          <h2 class="name">{{ name() }}</h2>
          @if (sentence()) {
            <p class="sentence">{{ sentence() }}</p>
          }
        </div>
        <div class="tools">
          <ng-content select="[sectionControl]" />
          @if (context()) {
            <button type="button" class="ask" [appSpotlight]="tour()" spotlightStep="ask" [attr.aria-label]="'Ask the coach about ' + name()" (click)="askCoach($event)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"></path></svg>
              Ask
            </button>
          }
        </div>
      </header>
      <ng-content />
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .section { display: flex; flex-direction: column; gap: 20px; min-width: 0; padding: var(--section-pad-top, 36px) 0 36px; border-top: 1px solid var(--section-rule, var(--border)); scroll-margin-top: 72px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .titles { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .tools { flex: none; display: flex; align-items: center; gap: 16px; min-height: 30px; }
    .name { margin: 0; font: 600 var(--pg-name) / 30px var(--font-sans); color: var(--text-primary); }
    .sentence { margin: 0; font: 400 var(--pg-text) / 1.5 var(--font-sans); color: var(--text-secondary); }
    .ask { height: 30px; padding: 0 11px; border-radius: 10px; border: 1px solid var(--accent-subtle); background: var(--surface); display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: var(--text-xs); font-weight: 700; color: var(--accent-text); cursor: pointer; }
    .ask svg { color: var(--accent); }
    .ask:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
    @media (max-width: 640px) { .head { flex-wrap: wrap; } .tools { margin-left: auto; } }
    @media (min-width: 1024px) { .section { scroll-margin-top: 24px; } }
  `
})
export class DetailSectionComponent {
  private readonly coach = inject(CoachStore);

  readonly name = input.required<string>();
  /** The one sentence under the name: what the picture shows, from the figures. */
  readonly sentence = input('');
  /** The id other parts of the page, and the contents rail, scroll to. */
  readonly anchor = input('');
  /** The card context Ask sends; without it there is no Ask. */
  readonly context = input<ProgressCardContext | null>(null);
  /** The words Ask puts in the composer; nothing is sent until the person sends it. */
  readonly ask = input('');
  /** The page's surface in the first-run guide, set on the one section whose Ask the path points at. */
  readonly tour = input<TourPage | null>(null);

  askCoach(event: Event): void {
    event.stopPropagation();
    const context = this.context();
    if (context) {
      this.coach.askAboutCard(context, this.ask() || undefined);
    }
  }
}
