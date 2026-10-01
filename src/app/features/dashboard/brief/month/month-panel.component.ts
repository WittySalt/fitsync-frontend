import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked, viewChild } from '@angular/core';

import { MonthDayComponent } from './month-day.component';
import { MonthFiguresComponent } from './month-figures.component';
import { buildFigures, emptyMonthLine, headLine, headTitle } from './month-figures';
import { MonthMuscleComponent } from './month-muscle.component';
import { muscleChartTitle } from './month-muscle';
import { MonthNoticedComponent } from './month-noticed.component';
import { buildMonthObservations } from './month-observations';
import { MonthRadarComponent } from './month-radar.component';
import { MonthViewState } from './month-view.state';
import { MonthWeekBarsComponent } from './month-week-bars.component';

/** The body of the dark panel in the month view: the month, six figures, the two charts and what
 *  the coach noticed. While the month loads it shows blocks in the shape of these parts, and when
 *  the month cannot be loaded it keeps the title only, since the calendar offers the retry. */
@Component({
  selector: 'app-month-panel',
  standalone: true,
  imports: [MonthDayComponent, MonthFiguresComponent, MonthMuscleComponent, MonthNoticedComponent, MonthRadarComponent, MonthWeekBarsComponent],
  templateUrl: './month-panel.component.html',
  styleUrl: './month-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthPanelComponent {
  protected readonly state = inject(MonthViewState);
  private readonly radar = viewChild(MonthRadarComponent);

  /** The sessions a week should reach, from the brief's weekly goal. */
  readonly weeklyTarget = input<number | null>(null);

  protected readonly selectedDate = computed(() => this.state.selectedDate());
  protected readonly selectedMuscle = computed(() => this.state.selectedMuscle());
  protected readonly status = computed(() => this.state.status());
  protected readonly insight = computed(() => this.state.insight());
  protected readonly title = computed(() => headTitle(this.state.month(), this.state.referenceDate()));
  protected readonly figures = computed(() => {
    const insight = this.insight();
    return insight && this.hasTraining()
      ? buildFigures({
          insight,
          weeklyTarget: this.weeklyTarget(),
          badgeDates: this.state.badgeDates(),
          badgeState: this.state.badgeStatus()
        })
      : [];
  });

  protected readonly since = computed(() => {
    const insight = this.insight();
    const hasArrows = this.figures().some((figure) => figure.compare !== null);
    return insight ? headLine(insight.month, insight.firstSessionDate, hasArrows) : null;
  });

  /** The title of the radar: the picked group and its sessions while one is picked. */
  protected readonly muscleTitle = computed(() => {
    const picked = this.selectedMuscle();
    const muscle = picked ? this.insight()?.muscles.find((entry) => entry.group === picked) : null;
    return muscle ? muscleChartTitle(muscle) : 'By muscle group';
  });

  /** A month without a session has figures of zero and nothing to draw or to say. */
  protected readonly hasTraining = computed(() => (this.insight()?.totals.sessions ?? 0) > 0);
  /** The one calm line of a month without a session, in place of the figures and the charts. */
  protected readonly emptyLine = computed(() => {
    const insight = this.insight();
    return insight && !this.hasTraining() ? emptyMonthLine(insight.month, this.state.referenceDate()) : null;
  });
  protected readonly observations = computed(() => {
    const insight = this.insight();
    return insight && this.hasTraining()
      ? buildMonthObservations({ insight, weeklyTarget: this.weeklyTarget(), weights: this.state.weights() })
      : [];
  });

  constructor() {
    // The button that lets go of a muscle group goes away with the lower part, so the focus
    // returns to the label that was picked.
    effect(() => {
      const target = this.state.focusTarget();
      if (target?.kind === 'muscle') {
        untracked(() => {
          this.radar()?.focusGroup(target.key);
          this.state.focusTarget.set(null);
        });
      }
    });
  }
}
