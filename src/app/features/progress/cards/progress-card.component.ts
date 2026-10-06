import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachStore } from '../../../core/coach/coach.store';
import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { ProgressCardContext } from '../../../shared/progress/progress.models';

/**
 * The one arrangement the Goal, Training and Food cards share at every width: the head row (eyebrow,
 * Ask, Open ›), the coach line, the headline, the picture row and the summary lines. "Open ›" is a
 * stretched link, so the whole card opens its page and the Ask pill, above it, does not.
 */
@Component({
  selector: 'app-progress-card',
  imports: [RouterLink, SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [attr.aria-label]="name()">
      <header class="head">
        <span class="eyebrow">{{ name() }}</span>
        <div class="actions">
          <button type="button" class="ask" [appSpotlight]="tour() ? 'progress' : null" spotlightStep="ask" (click)="ask($event)" [attr.aria-label]="'Ask the coach about ' + name().toLowerCase()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"></path></svg>
            Ask
          </button>
          <a class="open" [routerLink]="link()" [appSpotlight]="tour() ? 'progress' : null" spotlightStep="open" [attr.aria-label]="'Open ' + name()">Open ›</a>
        </div>
      </header>
      @if (coachLine()) {
        <div class="coach">
          <span class="mark" aria-hidden="true">C</span>
          <p>{{ coachLine() }}</p>
        </div>
      }
      <div class="headline"><ng-content select="[card-headline]" /></div>
      <div class="pic"><ng-content select="[card-picture]" /></div>
      <div class="lines"><ng-content select="[card-lines]" /></div>
    </article>
  `,
  styleUrl: './progress-card.component.scss'
})
export class ProgressCardComponent {
  private readonly coach = inject(CoachStore);

  readonly name = input.required<string>();
  readonly link = input.required<string>();
  /** The card carries the Ask and Open steps of the Progress path. */
  readonly tour = input(false);
  /** The text the composer opens with when Ask is pressed. */
  readonly askPrefill = input<string | undefined>(undefined);
  readonly context = input.required<ProgressCardContext>();
  readonly coachLine = input('');

  protected ask(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.coach.askAboutCard(this.context(), this.askPrefill());
  }
}
