import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse, AnalyticsActivityDay } from '../../core/analytics.models';
import { dateKeyInZone } from '../../core/zone-time';
import { dateRangeLabel, shortDateLabel } from '../../shared/date-label';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { DateRange } from './progress-range';

interface HeatmapCell {
  date: string;
  /** False for the padding before the first and after the last day of the month. */
  inMonth: boolean;
  inRange: boolean;
  today: boolean;
  level: number;
  tooltip: string;
}

interface MonthHeatmap {
  label: string;
  weeks: HeatmapCell[][];
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Days of a month key shifted as plain calendar arithmetic, so no zone can move a day. */
function utcDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const keyOf = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Workout activity as one small calendar for each month the range touches, shaded by how much was
 * trained. The range comes from the page, and the activity service answers for the whole range at
 * once, so the days here are the same days the trend charts above draw.
 */
@Component({
  selector: 'app-activity-heatmap',
  imports: [StatePanelComponent],
  templateUrl: './activity-heatmap.component.html',
  styleUrl: './activity-heatmap.component.scss'
})
export class ActivityHeatmapComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly range = input.required<DateRange>();
  /** The zone that decides which day is today. */
  readonly timezone = input('Asia/Singapore');

  readonly weekdays = WEEKDAYS;
  readonly legendLevels = [0, 1, 2, 3, 4];

  readonly data = signal<AnalyticsActivityCalendarResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rangeText = computed(() => dateRangeLabel(this.range().from, this.range().to));
  private readonly byDate = computed(() => new Map((this.data()?.days ?? []).map((day) => [day.date, day])));
  readonly months = computed<MonthHeatmap[]>(() => this.buildMonths());

  constructor() {
    effect(() => {
      this.range();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const { from, to } = this.range();

    this.analyticsApi.getActivityCalendar(from, to).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workout activity. Please retry.');
        this.loading.set(false);
      }
    });
  }

  intensity(day: AnalyticsActivityDay): number {
    if (day.workoutCount <= 0 && day.workoutMinutes <= 0) {
      return 0;
    }
    if (day.workoutCount >= 4 || day.workoutMinutes >= 90) {
      return 4;
    }
    if (day.workoutCount >= 3 || day.workoutMinutes >= 60) {
      return 3;
    }
    if (day.workoutCount >= 2 || day.workoutMinutes >= 30) {
      return 2;
    }
    return 1;
  }

  tooltip(day: AnalyticsActivityDay): string {
    const date = shortDateLabel(day.date);
    if (day.workoutCount <= 0 && day.workoutMinutes <= 0) {
      return `${date}: No workouts`;
    }
    const workoutLabel = day.workoutCount === 1 ? '1 workout' : `${day.workoutCount} workouts`;
    return `${date}: ${workoutLabel}, ${day.workoutMinutes} min`;
  }

  private buildMonths(): MonthHeatmap[] {
    const { from, to } = this.range();
    const today = dateKeyInZone(new Date(), this.timezone());
    const months: MonthHeatmap[] = [];
    const last = utcDate(to);
    const cursor = utcDate(from);
    cursor.setUTCDate(1);
    while (cursor <= last) {
      months.push(this.buildMonth(cursor.getUTCFullYear(), cursor.getUTCMonth(), from, to, today));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
  }

  private buildMonth(year: number, month: number, from: string, to: string, today: string): MonthHeatmap {
    const first = new Date(Date.UTC(year, month, 1));
    // Monday first: getUTCDay() is 0 for Sunday.
    const cursor = new Date(Date.UTC(year, month, 1 - ((first.getUTCDay() + 6) % 7)));
    const weeks: HeatmapCell[][] = [];
    for (let week = 0; week < 6; week += 1) {
      const row: HeatmapCell[] = [];
      for (let day = 0; day < 7; day += 1) {
        row.push(this.cell(keyOf(cursor), cursor.getUTCMonth() === month, from, to, today));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      // A month that fits in five rows leaves the sixth out.
      if (week === 5 && row.every((cell) => !cell.inMonth)) {
        break;
      }
      weeks.push(row);
    }
    return { label: `${MONTH_NAMES[month]} ${year}`, weeks };
  }

  private cell(date: string, inMonth: boolean, from: string, to: string, today: string): HeatmapCell {
    const day = this.byDate().get(date) ?? { date, workoutCount: 0, workoutMinutes: 0 };
    return {
      date,
      inMonth,
      inRange: date >= from && date <= to,
      today: date === today,
      level: inMonth ? this.intensity(day) : 0,
      tooltip: this.tooltip(day)
    };
  }
}
