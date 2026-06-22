import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse, AnalyticsActivityDay } from '../../core/analytics.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

type ActivityPresetKey = 'week' | 'month' | 'quarter' | 'year';

interface RangePreset {
  label: string;
  key: ActivityPresetKey;
}

interface CalendarDay extends AnalyticsActivityDay {
  inRange: boolean;
  inMonth?: boolean;
}

interface MonthHeatmap {
  label: string;
  weeks: CalendarDay[][];
}

interface YearHeatmap {
  weeks: CalendarDay[][];
  monthLabels: { label: string; column: number }[];
}

@Component({
  selector: 'app-activity-heatmap',
  imports: [StatePanelComponent],
  templateUrl: './activity-heatmap.component.html',
  styleUrl: './activity-heatmap.component.scss'
})
export class ActivityHeatmapComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly rangePresets: RangePreset[] = [
    { label: 'Week', key: 'week' },
    { label: 'Month', key: 'month' },
    { label: 'Quarter', key: 'quarter' },
    { label: 'Year', key: 'year' }
  ];
  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly legendLevels = [0, 1, 2, 3, 4];

  readonly data = signal<AnalyticsActivityCalendarResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedPreset = signal<ActivityPresetKey>('quarter');
  readonly startDate = signal(this.formatIsoDate(this.addMonths(this.startOfMonth(new Date()), -2)));
  readonly endDate = signal(this.formatIsoDate(this.endOfMonth(new Date())));

  readonly days = computed<AnalyticsActivityDay[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    const byDate = new Map(data.days.map((day) => [day.date, day]));
    return this.eachDate(data.from, data.to).map(
      (date) => byDate.get(date) ?? { date, workoutCount: 0, workoutMinutes: 0 }
    );
  });

  readonly hasDays = computed(() => this.days().length > 0);
  readonly dayByDate = computed(() => new Map(this.days().map((day) => [day.date, day])));
  readonly quarterMonths = computed(() => {
    const end = this.parseIsoDate(this.endDate());
    const startMonth = this.addMonths(this.startOfMonth(end), -2);
    return [0, 1, 2].map((offset) => this.buildMonthHeatmap(this.addMonths(startMonth, offset)));
  });
  readonly yearHeatmap = computed(() => this.buildYearHeatmap());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsApi.getActivityCalendar(this.startDate(), this.endDate()).subscribe({
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

  setPreset(preset: ActivityPresetKey): void {
    const today = new Date();
    this.selectedPreset.set(preset);

    if (preset === 'week') {
      const start = this.startOfWeek(today);
      this.startDate.set(this.formatIsoDate(start));
      this.endDate.set(this.formatIsoDate(this.addDays(start, 6)));
    } else if (preset === 'month') {
      this.startDate.set(this.formatIsoDate(this.startOfMonth(today)));
      this.endDate.set(this.formatIsoDate(this.endOfMonth(today)));
    } else if (preset === 'quarter') {
      this.startDate.set(this.formatIsoDate(this.addMonths(this.startOfMonth(today), -2)));
      this.endDate.set(this.formatIsoDate(this.endOfMonth(today)));
    } else {
      this.startDate.set(this.isoDaysAgo(364));
      this.endDate.set(this.isoToday());
    }

    this.load();
  }

  updateStartDate(event: Event): void {
    this.selectedPreset.set('month');
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  updateEndDate(event: Event): void {
    this.selectedPreset.set('month');
    this.endDate.set((event.target as HTMLInputElement).value);
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
    if (day.workoutCount <= 0 && day.workoutMinutes <= 0) {
      return `${day.date}: No workouts`;
    }

    const workoutLabel = day.workoutCount === 1 ? '1 workout' : `${day.workoutCount} workouts`;
    return `${day.date}: ${workoutLabel}, ${day.workoutMinutes} min`;
  }

  isLongRangeHeatmap(): boolean {
    return this.selectedPreset() === 'quarter' || this.selectedPreset() === 'year';
  }

  cellClass(day: CalendarDay): string {
    const muted = day.inRange && day.inMonth !== false ? '' : ' is-muted';
    return `heatmap-cell intensity-${this.intensity(day)}${muted}`;
  }

  private buildMonthHeatmap(month: Date): MonthHeatmap {
    const firstOfMonth = this.startOfMonth(month);
    const lastOfMonth = this.endOfMonth(month);
    const cursor = this.startOfWeek(firstOfMonth);
    const end = this.addDays(this.startOfWeek(lastOfMonth), 6);
    const weeks: CalendarDay[][] = [];
    let week: CalendarDay[] = [];

    while (cursor <= end) {
      week.push(this.calendarDay(this.formatIsoDate(cursor), cursor.getMonth() === firstOfMonth.getMonth()));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      label: firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      weeks
    };
  }

  private buildYearHeatmap(): YearHeatmap {
    const start = this.startOfWeek(this.parseIsoDate(this.startDate()));
    const end = this.addDays(this.startOfWeek(this.parseIsoDate(this.endDate())), 6);
    const weeks: CalendarDay[][] = [];
    const monthLabels: { label: string; column: number }[] = [];
    const cursor = new Date(start);
    let previousMonth = -1;

    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const week = Array.from({ length: 7 }, (_, dayIndex) =>
        this.calendarDay(this.formatIsoDate(this.addDays(weekStart, dayIndex)), true)
      );
      weeks.push(week);

      const labelDate = week.find((day) => day.inRange && this.parseIsoDate(day.date).getDate() <= 7);
      if (labelDate) {
        const parsed = this.parseIsoDate(labelDate.date);
        if (parsed.getMonth() !== previousMonth) {
          previousMonth = parsed.getMonth();
          monthLabels.push({
            label: parsed.toLocaleDateString('en-US', { month: 'short' }),
            column: weeks.length
          });
        }
      }

      cursor.setDate(cursor.getDate() + 7);
    }

    return { weeks, monthLabels };
  }

  private calendarDay(date: string, inMonth: boolean): CalendarDay {
    const day = this.dayByDate().get(date) ?? { date, workoutCount: 0, workoutMinutes: 0 };
    return {
      ...day,
      inRange: date >= this.startDate() && date <= this.endDate(),
      inMonth
    };
  }

  private eachDate(from: string, to: string): string[] {
    const dates: string[] = [];
    const cursor = this.parseIsoDate(from);
    const end = this.parseIsoDate(to);

    while (cursor <= end) {
      dates.push(this.formatIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private isoToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isoDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
