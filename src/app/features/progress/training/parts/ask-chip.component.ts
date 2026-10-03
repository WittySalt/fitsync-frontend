import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { CoachStore } from '../../../../core/coach/coach.store';
import { CoachCardContext } from '../../../../core/coach/coach.models';

/**
 * "Ask" on a section, the app's Ask pill: opens the coach dock with the section as the subject of the next question
 * (contract 4.1). A suggested question fills the composer; nothing is sent until the user does.
 */
@Component({
  selector: 'app-ask-chip',
  template: `
    <button type="button" class="ask" [attr.aria-label]="aria()" (click)="ask($event)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"></path></svg>
      {{ question() || 'Ask' }}
    </button>
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
