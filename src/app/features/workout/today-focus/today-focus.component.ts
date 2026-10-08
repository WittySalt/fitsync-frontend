import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachStore } from '../../../core/coach/coach.store';
import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { FocusModel } from './today-focus';

/**
 * Today's focus beside the Today card, or as a strip inside it under 1100 px. Its three zones (head,
 * body, foot) keep the head at 88 px and the foot at 64 px, so the foot's divider lines up with the
 * card's own. It only shows what the model holds; every figure opens Progress, Training, Muscles.
 */
@Component({
  selector: 'app-today-focus',
  imports: [MuscleFigureComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './today-focus.component.html',
  styleUrl: './today-focus.component.scss',
  host: { '[class.strip]': "variant() === 'strip'", '[class.side]': "variant() === 'side'" }
})
export class TodayFocusComponent {
  private readonly coach = inject(CoachStore);

  readonly model = input<FocusModel | null>(null);
  readonly loading = input(false);
  readonly variant = input<'side' | 'strip'>('side');
  /** The week the facts describe, which Ask sends with its question. */
  readonly range = input<{ from: string; to: string } | null>(null);

  protected readonly labelled = computed(() => {
    const model = this.model();
    return model ? `Today's focus. ${model.caption} ${model.coach}`.trim() : "Today's focus";
  });

  protected ask(): void {
    const range = this.range();
    if (range) {
      this.coach.askAboutCard({ kind: 'TRAINING', from: range.from, to: range.to });
    }
  }

  /** All the seconds of the bar. A part over a third of it is drawn as the main one. */
  protected total(model: FocusModel): number {
    return model.bar?.parts.reduce((sum, part) => sum + part.seconds, 0) ?? 0;
  }
}
