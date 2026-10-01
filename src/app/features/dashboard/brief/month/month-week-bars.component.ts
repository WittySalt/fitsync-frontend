import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MonthWeekInsight } from '../../../../core/fitsync.models';
import { WeekKind, buildWeekBars, describeWeekBars } from './month-week-bars';

const KIND_NAMES: Record<WeekKind, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  sport: 'Sport',
  other: 'Other'
};

/** One stacked bar for each week of the month, stacked by kind of training. */
@Component({
  selector: 'app-month-week-bars',
  standalone: true,
  templateUrl: './month-week-bars.component.html',
  styleUrl: './month-week-bars.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthWeekBarsComponent {
  readonly weeks = input.required<readonly MonthWeekInsight[]>();
  readonly monthStart = input.required<string>();
  readonly month = input.required<string>();

  protected readonly chart = computed(() => buildWeekBars(this.weeks(), this.monthStart()));
  protected readonly description = computed(() => describeWeekBars(this.weeks(), this.monthStart(), this.month()));
  protected readonly kindName = (kind: WeekKind): string => KIND_NAMES[kind];
}
