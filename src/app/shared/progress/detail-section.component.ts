import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { CoachStore } from '../../core/coach/coach.store';
import { ProgressCardContext } from './progress.models';

/**
 * One section of a Progress detail page: its name, one sentence that says what the picture shows,
 * the picture, and "Ask about this". A hairline marks its top; the first section of a page sets
 * `--section-rule` to transparent and `--section-pad-top` to 0. What the old subtitles and the
 * sentences under the charts used to say goes into `ask`, the text Ask puts in the composer.
 */
@Component({
  selector: 'app-detail-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [attr.id]="anchor() || null" [attr.aria-label]="name()">
      <header class="head">
        <div class="line">
          <h2 class="name">{{ name() }}</h2>
          <ng-content select="[sectionControl]" />
        </div>
        @if (sentence()) {
          <p class="sentence">{{ sentence() }}</p>
        }
      </header>
      <ng-content />
      @if (context()) {
        <button type="button" class="ask" [attr.aria-label]="'Ask the coach about ' + name()" (click)="askCoach($event)">Ask about this</button>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .section { display: flex; flex-direction: column; gap: 20px; min-width: 0; padding: var(--section-pad-top, 36px) 0 36px; border-top: 1px solid var(--section-rule, var(--border)); scroll-margin-top: 72px; }
    .head { display: flex; flex-direction: column; gap: 6px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 24px; flex-wrap: wrap; }
    .name { margin: 0; font: 600 var(--pg-name) var(--font-sans); color: var(--text-primary); }
    .sentence { margin: 0; font: 400 var(--pg-text) / 1.5 var(--font-sans); color: var(--text-secondary); }
    .ask { align-self: flex-start; padding: 0; border: 0; background: none; font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); cursor: pointer; }
    .ask:hover { text-decoration: underline; text-underline-offset: 4px; }
    .ask:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
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

  askCoach(event: Event): void {
    event.stopPropagation();
    const context = this.context();
    if (context) {
      this.coach.askAboutCard(context, this.ask() || undefined);
    }
  }
}
