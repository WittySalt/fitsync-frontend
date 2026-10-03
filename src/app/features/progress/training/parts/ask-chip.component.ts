import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { CoachStore } from '../../../../core/coach/coach.store';
import { CoachCardContext } from '../../../../core/coach/coach.models';

/**
 * "Ask about this" on a section, a 13 px text link: opens the coach dock with the section as the subject of the next question
 * (contract 4.1). A suggested question fills the composer; nothing is sent until the user does.
 */
@Component({
  selector: 'app-ask-chip',
  template: `
    <button type="button" class="ask" [attr.aria-label]="aria()" (click)="ask($event)">{{ question() || 'Ask about this' }}</button>
  `,
  styleUrl: './ask-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AskChipComponent {
  private readonly coach = inject(CoachStore);

  readonly card = input.required<CoachCardContext>();
  /** A suggested question; with none the chip reads "Ask" and leaves the composer empty. */
  readonly question = input<string>('');
  /** What the section is, for a screen reader: "Ask the coach about Strength". */
  readonly subject = input<string>('');

  protected aria(): string {
    if (this.question()) {
      return `Ask the coach: ${this.question()}`;
    }
    return this.subject() ? `Ask the coach about ${this.subject()}` : 'Ask the coach';
  }

  protected ask(event: Event): void {
    // The chip sits inside cards that open a page; asking must not open it too.
    event.stopPropagation();
    event.preventDefault();
    this.coach.askAboutCard(this.card(), this.question() || undefined);
  }
}
