import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { AskChipComponent } from './ask-chip.component';

/**
 * A section of a Training page: the title with its line under it, Ask on the right, then a slot
 * for the coach's line and the body. Private copy of the shared `app-section-card` (contract 5),
 * same selector, kept until the shared one is merged.
 */
@Component({
  selector: 'app-section-card',
  imports: [AskChipComponent],
  template: `
    <section class="section" [class.bare]="bare()" [attr.aria-labelledby]="headingId()">
      <header class="head">
        <div class="titles">
          <h2 [id]="headingId()">{{ title() }}</h2>
          @if (sub()) {
            <span class="sub">{{ sub() }}</span>
          }
          @if (quiet()) {
            <span class="quiet">{{ quiet() }}</span>
          }
        </div>
        @if (card(); as subject) {
          <app-ask-chip [card]="subject" [subject]="title()" />
        }
      </header>
      <ng-content select="[coach]" />
      <ng-content />
    </section>
  `,
  styleUrl: './section-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionCardComponent {
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly quiet = input('');
  readonly card = input<CoachCardContext | null>(null);
  /** No border or padding: the section is a heading over cards of its own. */
  readonly bare = input(false);

  protected headingId(): string {
    return `section-${this.title().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
}
