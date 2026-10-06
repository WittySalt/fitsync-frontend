import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { GoalProgress } from '../progress-api.models';
import { goalCoachLine } from './card-lines';
import { goalCardView } from './goal-card-view';
import { FOUR_WEEKS, Span } from './goal-road';
import { KeepChartComponent } from './keep-chart.component';
import { ProgressCardComponent } from './progress-card.component';
import { RoadChartComponent } from './road-chart.component';
import { StripChartComponent } from './strip-chart.component';
import { SummaryListComponent } from './summary-list.component';

/**
 * The Goal card (board 21f): the distance to the target as the headline and the road as the picture,
 * or the KEEP lane, or the dot strip of the habit that leads, or an empty road. The page loads the
 * response, so the verdict above and this card always read the same figures.
 */
@Component({
  selector: 'app-goal-card',
  imports: [KeepChartComponent, ProgressCardComponent, RoadChartComponent, RouterLink, StatePanelComponent, StripChartComponent, SummaryListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goal-card.component.html',
  styleUrl: './goal-card.component.scss'
})
export class GoalCardComponent {
  readonly goal = input<GoalProgress | null>(null);
  /** The card carries the Ask and Open steps of the Progress path. */
  readonly tour = input(false);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly today = input.required<string>();
  /** The days the Ask link sends. */
  readonly askPeriod = input.required<{ from: string; to: string }>();
  /** The period the goal was read for, which the summary lines name. */
  readonly span = input<Span>(FOUR_WEEKS);
  readonly retry = output<void>();

  protected readonly context = computed<ProgressCardContext>(() => ({ kind: 'GOAL', ...this.askPeriod() }));
  protected readonly coachLine = computed(() => {
    const goal = this.goal();
    return goal ? goalCoachLine(goal, this.today()) : '';
  });
  protected readonly view = computed(() => {
    const goal = this.goal();
    return goal ? goalCardView(goal, this.today(), this.span()) : null;
  });
}
