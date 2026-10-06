import { Component, ElementRef, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Goal } from '../../../core/fitsync.models';
import { GuideService, GuideStepId } from '../../../core/guide/guide.service';

interface GuideStepCopy {
  id: GuideStepId;
  name: string;
  what: string;
  button: string;
  path: string;
  fragment?: string;
  query?: Record<string, string>;
}

/** The four steps and where each one leads. */
export const GUIDE_STEPS: readonly GuideStepCopy[] = [
  { id: 'targets', name: 'Set your targets', what: 'A weight or weekly session target gives the coach something to measure.', button: 'Set targets', path: '/me', fragment: 'goal-lifecycle', query: { guide: 'me' } },
  { id: 'plan', name: 'Plan your week', what: 'Pick a template, ask the coach or build your own week.', button: 'Pick a plan', path: '/workout', query: { guide: 'workout' } },
  { id: 'meal', name: 'Log a meal', what: 'One meal is enough for the day to start adding up.', button: 'Log a meal', path: '/nutrition', query: { log: 'BREAKFAST', guide: 'nutrition' } },
  { id: 'session', name: 'Start a session', what: 'Train once and your first week begins to take shape.', button: "Start today's session", path: '/workout', query: { guide: 'workout-session' } }
];

/** The Getting started card of the Home page. It reads its state from the GuideService and leaves when hidden. */
@Component({
  selector: 'app-guide-card',
  imports: [RouterLink],
  templateUrl: './guide-card.component.html',
  styleUrl: './guide-card.component.scss'
})
export class GuideCardComponent {
  protected readonly guide = inject(GuideService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The account's active goals, which Home has already read. */
  readonly goals = input<readonly Goal[]>([]);

  protected readonly steps = computed(() =>
    GUIDE_STEPS.map((step, index) => ({
      ...step,
      number: index + 1,
      done: this.guide.steps()[step.id],
      current: this.guide.nextStep() === step.id
    }))
  );

  /** "Take the tour again": the paths and the card come back, and the card is brought into view. */
  protected tourAgain(): void {
    this.guide.restart();
    this.host.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  constructor() {
    effect(() => {
      const goals = this.goals();
      untracked(() => this.guide.load(goals));
    });
  }
}
