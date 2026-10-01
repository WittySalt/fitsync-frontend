import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { MonthFiguresComponent } from './month-figures.component';
import { buildFigures, headLine, headTitle } from './month-figures';
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
  imports: [MonthFiguresComponent, MonthNoticedComponent, MonthRadarComponent, MonthWeekBarsComponent],
  templateUrl: './month-panel.component.html',
  styleUrl: './month-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthPanelComponent {
  private readonly state = inject(MonthViewState);

  /** The sessions a week should reach, from the brief's weekly goal. */
  readonly weeklyTarget = input<number | null>(null);

  protected readonly status = computed(() => this.state.status());
  protected readonly insight = computed(() => this.state.insight());
  protected readonly title = computed(() => headTitle(this.state.month(), this.state.referenceDate()));
  protected readonly figures = computed(() => {
    const insight = this.insight();
    return insight
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

  /** A month without a session has figures of zero and nothing to draw or to say. */
  protected readonly hasTraining = computed(() => (this.insight()?.totals.sessions ?? 0) > 0);
  protected readonly observations = computed(() => {
    const insight = this.insight();
    return insight && this.hasTraining()
      ? buildMonthObservations({ insight, weeklyTarget: this.weeklyTarget(), weights: this.state.weights() })
      : [];
  });
}
