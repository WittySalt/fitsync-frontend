import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachStore } from '../../../core/coach/coach.store';
import { ProgressCardContext } from '../../../shared/progress/progress.models';

/**
 * The frame the Goal, Training and Food cards share (spec 1.4): the eyebrow and "Open ›", the left
 * column of headline, three lines and the Ask link, and the picture. "Open ›" is a stretched link, so
 * the whole card opens its page and the Ask button, a sibling above it, does not.
 */
@Component({
  selector: 'app-progress-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [attr.aria-label]="name()">
      <header class="head">
        <span class="eyebrow">{{ name() }}</span>
        <a class="open" [routerLink]="link()" [attr.aria-label]="'Open ' + name()">Open ›</a>
      </header>
      <div class="body">
        <div class="headline"><ng-content select="[card-headline]" /></div>
        <div class="lines"><ng-content select="[card-lines]" /></div>
        <div class="ask-row">
          <button type="button" class="ask" (click)="ask($event)">{{ askLabel() }}</button>
        </div>
        <div class="pic"><ng-content select="[card-picture]" /></div>
      </div>
    </article>
  `,
  styleUrl: './progress-card.component.scss'
})
export class ProgressCardComponent {
  private readonly coach = inject(CoachStore);

  readonly name = input.required<string>();
  readonly link = input.required<string>();
  readonly askLabel = input.required<string>();
  readonly context = input.required<ProgressCardContext>();

  protected ask(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.coach.askAboutCard(this.context());
  }
}
