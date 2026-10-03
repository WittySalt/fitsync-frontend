import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse, AnalyticsActivityDay } from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSession, WorkoutSessionDetail } from '../../core/fitsync.models';
import { dateKeyInZone, dayBoundsInZone, profileTimezone } from '../../core/zone-time';
import { dateRangeLabel, shortDateLabel } from '../../shared/date-label';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { SessionDetailComponent } from '../workout/session-detail.component';
import { DateRange } from './progress-range';

type DayState = 'idle' | 'loading' | 'ready' | 'failed';

interface DaySession {
  session: WorkoutSession;
  title: string;
  timeLabel: string;
}

interface HeatmapCell {
  date: string;
  /** False for the padding before the first and after the last day of the month. */
  inMonth: boolean;
  inRange: boolean;
  today: boolean;
  level: number;
  hasActivity: boolean;
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
  imports: [StatePanelComponent, SessionDetailComponent],
  templateUrl: './activity-heatmap.component.html',
  styleUrl: './activity-heatmap.component.scss'
})
export class ActivityHeatmapComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly dataService = inject(FitSyncDataService);

  readonly range = input.required<DateRange>();
  /** The zone that decides which day is today. */
  readonly timezone = input('Asia/Singapore');

  readonly weekdays = WEEKDAYS;
  readonly legendLevels = [0, 1, 2, 3, 4];

  readonly data = signal<AnalyticsActivityCalendarResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // The sessions of one day, opened by clicking a day that has some.
  readonly selectedDate = signal<string | null>(null);
  readonly dayState = signal<DayState>('idle');
  readonly daySessions = signal<DaySession[]>([]);
  readonly selectedSessionId = signal<string | null>(null);
  readonly dayTitle = computed(() => shortDateLabel(this.selectedDate()));
  /** True when no day of the range has any training. */
  readonly empty = computed(() => (this.data()?.days ?? []).every((day) => day.workoutCount <= 0 && day.workoutMinutes <= 0));

  readonly rangeText = computed(() => dateRangeLabel(this.range().from, this.range().to));
  private readonly byDate = computed(() => new Map((this.data()?.days ?? []).map((day) => [day.date, day])));
  readonly months = computed<MonthHeatmap[]>(() => this.buildMonths());

  constructor() {
    effect(() => {
      this.range();
      untracked(() => {
        this.closeDay();
        this.load();
      });
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
      hasActivity: inMonth && (day.workoutCount > 0 || day.workoutMinutes > 0),
      tooltip: this.tooltip(day)
    };
  }

  /** Opens the sessions of a day that has some, so a day can still be looked into from here. */
  openDay(date: string): void {
    this.selectedDate.set(date);
    this.selectedSessionId.set(null);
    this.dayState.set('loading');
    const { from, to } = dayBoundsInZone(date, this.zone());
    this.dataService.getWorkoutSessionsInRange(from.toISOString(), to.toISOString()).subscribe({
      next: (sessions) => {
        // Cancelled sessions never happened, so they are not activity.
        this.daySessions.set(sessions.filter((session) => session.status !== 'CANCELLED').map((session) => this.toDaySession(session)));
        this.dayState.set('ready');
      },
      error: () => this.dayState.set('failed')
    });
  }

  closeDay(): void {
    this.selectedDate.set(null);
    this.selectedSessionId.set(null);
    this.dayState.set('idle');
  }

  openSession(session: WorkoutSession): void {
    if (session.sessionId) {
      this.selectedSessionId.set(session.sessionId);
    }
  }

  closeSessionDetail(): void {
    this.selectedSessionId.set(null);
  }

  handleSessionUpdated(updated: WorkoutSessionDetail): void {
    this.daySessions.update((list) => list.map((entry) => (entry.session.sessionId === updated.sessionId ? this.toDaySession(updated) : entry)));
  }

  handleSessionDeleted(): void {
    const selected = this.selectedSessionId();
    this.selectedSessionId.set(null);
    this.daySessions.update((list) => list.filter((entry) => entry.session.sessionId !== selected));
    // The day may now be empty, so the calendar is read again.
    this.refreshCalendar();
  }

  handleSessionRepeated(created: WorkoutSessionDetail): void {
    this.daySessions.update((list) => [this.toDaySession(created), ...list.filter((entry) => entry.session.sessionId !== created.sessionId)]);
    this.refreshCalendar();
  }

  private zone(): string {
    return profileTimezone(this.timezone());
  }

  private refreshCalendar(): void {
    const { from, to } = this.range();
    this.analyticsApi.getActivityCalendar(from, to).subscribe({ next: (data) => this.data.set(data) });
  }

  private toDaySession(session: WorkoutSession): DaySession {
    return {
      session,
      title: session.name || session.workoutType.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
      timeLabel: this.timeLabel(session)
    };
  }

  /** "07:30-08:15" in the profile zone, or "Untimed" for a session with no start. */
  private timeLabel(session: WorkoutSession): string {
    const start = new Date(session.startedAt);
    if (Number.isNaN(start.getTime())) {
      return 'Untimed';
    }
    const format = (date: Date): string =>
      new Intl.DateTimeFormat('en-GB', { timeZone: this.zone(), hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    const completed = new Date(session.completedAt);
    const end = !Number.isNaN(completed.getTime()) && completed > start
      ? completed
      : new Date(start.getTime() + (session.durationMinutes ?? 0) * 60_000);
    return end > start ? `${format(start)}-${format(end)}` : format(start);
  }
}
