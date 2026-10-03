import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { WorkoutSession, WorkoutSessionDetail } from '../../core/fitsync.models';
import { dateRangeLabel, shortDateLabel } from '../../shared/date-label';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { SessionDetailComponent } from '../workout/session-detail.component';

/** The two session calendars. They come from the old heatmap card unchanged, and browse by their
 *  own previous and next, so they are not limited to the range of the page. */
export type SessionCalendarMode = 'week' | 'month';

interface WeekSessionBlock {
  session: WorkoutSession;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  left: number;
  width: number;
  startLabel: string;
  timeLabel: string;
  title: string;
}

interface MonthSessionChip {
  session: WorkoutSession;
  title: string;
  timeLabel: string;
}

interface MonthCalendarDay {
  date: string;
  label: string;
  inMonth: boolean;
  isToday: boolean;
  chips: MonthSessionChip[];
  visibleChips: MonthSessionChip[];
  hiddenCount: number;
}

@Component({
  selector: 'app-session-calendar',
  imports: [StatePanelComponent, SessionDetailComponent],
  templateUrl: './session-calendar.component.html',
  styleUrl: './session-calendar.component.scss'
})
export class SessionCalendarComponent implements OnInit, OnChanges {
  private readonly dataService = inject(FitSyncDataService);

  private readonly timezone = inject(UserTimezoneService).zone;
  @Input() mode: SessionCalendarMode = 'week';

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedPreset = signal<SessionCalendarMode>('week');
  readonly selectedDate = signal(new Date());
  readonly selectedSessionId = signal<string | null>(null);
  readonly expandedMonthDate = signal<string | null>(null);
  readonly startDate = signal(this.formatIsoDate(this.startOfWeek(new Date())));
  readonly endDate = signal(this.formatIsoDate(this.addDays(this.startOfWeek(new Date()), 6)));

  readonly hasSessions = computed(() => this.sessions().length > 0);
  // Dates are written in the short style, as everywhere else on the page.
  readonly rangeText = computed(() => dateRangeLabel(this.startDate(), this.endDate()));
  readonly weekDates = computed(() => this.eachDate(this.startDate(), this.endDate()));
  readonly weekTimeWindow = computed(() => this.resolveWeekTimeWindow());
  readonly weekTimeSlots = computed(() => {
    const window = this.weekTimeWindow();
    const slots: number[] = [];
    for (let minutes = window.start; minutes <= window.end; minutes += 120) {
      slots.push(minutes);
    }
    return slots;
  });
  readonly weekBlocks = computed(() => this.resolveWeekBlocks());
  readonly allDaySessions = computed(() => this.resolveAllDaySessions());
  readonly monthDays = computed(() => this.buildMonthCalendarDays(this.selectedDate()));
  readonly expandedMonthDay = computed(() => {
    const expandedDate = this.expandedMonthDate();
    return expandedDate ? (this.monthDays().find((day) => day.date === expandedDate) ?? null) : null;
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const mode = changes['mode'];
    if (!mode) {
      return;
    }
    // The first value only sets the days, because ngOnInit loads them; a later one loads as well.
    if (mode.firstChange) {
      this.applyPreset(this.mode);
    } else {
      this.setPreset(this.mode);
    }
  }

  load(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getWorkoutSessionsInRange(this.startInstant(), this.endInstant()).subscribe({
      next: (sessions) => {
        // The activity calendar reflects what was actually done. Cancelled sessions
        // have no duration and never completed, so they are not activity — drop them
        // (otherwise they pile up in the untimed "All day" band as mystery cards).
        this.sessions.set(sessions.filter((session) => session.status !== 'CANCELLED'));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workout sessions. Please retry.');
        this.loading.set(false);
      }
    });
  }

  setPreset(preset: SessionCalendarMode): void {
    this.applyPreset(preset);
    this.load();
  }

  private applyPreset(preset: SessionCalendarMode): void {
    const today = new Date();
    this.selectedPreset.set(preset);
    this.selectedDate.set(today);
    this.expandedMonthDate.set(null);

    if (preset === 'week') {
      const start = this.startOfWeek(today);
      this.startDate.set(this.formatIsoDate(start));
      this.endDate.set(this.formatIsoDate(this.addDays(start, 6)));
    } else if (preset === 'month') {
      this.startDate.set(this.formatIsoDate(this.startOfMonth(today)));
      this.endDate.set(this.formatIsoDate(this.endOfMonth(today)));
    }
  }

  previousPeriod(): void {
    const preset = this.selectedPreset();
    const nextDate = preset === 'month' ? this.addMonths(this.selectedDate(), -1) : this.addDays(this.selectedDate(), -7);
    this.moveEventPeriod(nextDate);
  }

  nextPeriod(): void {
    const preset = this.selectedPreset();
    const nextDate = preset === 'month' ? this.addMonths(this.selectedDate(), 1) : this.addDays(this.selectedDate(), 7);
    this.moveEventPeriod(nextDate);
  }

  dayLabel(date: string): string {
    return shortDateLabel(date);
  }

  weekColumnLabel(date: string): string {
    const parsed = this.parseIsoDate(date);
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  formatMinuteLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  openSession(session: WorkoutSession): void {
    if (!session.sessionId) {
      return;
    }
    this.selectedSessionId.set(session.sessionId);
  }

  closeSessionDetail(): void {
    this.selectedSessionId.set(null);
  }

  handleSessionUpdated(session: WorkoutSessionDetail): void {
    this.sessions.update((sessions) => sessions.map((item) => (item.sessionId === session.sessionId ? session : item)));
  }

  handleSessionDeleted(): void {
    const selected = this.selectedSessionId();
    this.selectedSessionId.set(null);
    if (selected) {
      this.sessions.update((sessions) => sessions.filter((session) => session.sessionId !== selected));
    }
  }

  handleSessionRepeated(session: WorkoutSessionDetail): void {
    this.sessions.update((sessions) => [session, ...sessions.filter((item) => item.sessionId !== session.sessionId)]);
  }

  expandMonthDay(day: MonthCalendarDay): void {
    this.expandedMonthDate.set(day.date);
  }

  trackSession(session: WorkoutSession): string {
    return session.sessionId ?? `${session.name}-${session.startedAt}`;
  }

  allDaySessionsForDate(date: string): WorkoutSession[] {
    return this.allDaySessions().filter((session) => {
      const start = this.validDate(session.startedAt);
      return start ? this.localDateTimeParts(start).date === date : false;
    });
  }

  private moveEventPeriod(date: Date): void {
    this.selectedDate.set(date);
    this.expandedMonthDate.set(null);

    if (this.selectedPreset() === 'month') {
      this.startDate.set(this.formatIsoDate(this.startOfMonth(date)));
      this.endDate.set(this.formatIsoDate(this.endOfMonth(date)));
    } else {
      const start = this.startOfWeek(date);
      this.startDate.set(this.formatIsoDate(start));
      this.endDate.set(this.formatIsoDate(this.addDays(start, 6)));
    }

    this.loadSessions();
  }

  private resolveWeekTimeWindow(): { start: number; end: number } {
    const timedBlocks = this.sessionBlocksForWeek();
    if (!timedBlocks.length) {
      return { start: 360, end: 1320 };
    }

    const earliest = Math.min(...timedBlocks.map((block) => block.startMinutes));
    const latest = Math.max(...timedBlocks.map((block) => block.endMinutes));
    return {
      start: Math.min(360, Math.floor(earliest / 60) * 60),
      end: Math.max(1320, Math.ceil(latest / 60) * 60)
    };
  }

  private resolveWeekBlocks(): WeekSessionBlock[] {
    const window = this.weekTimeWindow();
    const totalMinutes = Math.max(1, window.end - window.start);
    const blocks = this.sessionBlocksForWeek().map((block) => ({
      ...block,
      top: ((block.startMinutes - window.start) / totalMinutes) * 100,
      height: Math.max(22, ((block.endMinutes - block.startMinutes) / totalMinutes) * 720),
      left: 0,
      width: 100
    }));

    return this.splitOverlappingBlocks(blocks);
  }

  private sessionBlocksForWeek(): WeekSessionBlock[] {
    const weekDates = this.weekDates();
    return this.sessions()
      .map((session) => this.toWeekBlock(session, weekDates))
      .filter((block): block is WeekSessionBlock => block !== null)
      .sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes);
  }

  private toWeekBlock(session: WorkoutSession, weekDates: string[]): WeekSessionBlock | null {
    const start = this.validDate(session.startedAt);
    if (!start) {
      return null;
    }

    const local = this.localDateTimeParts(start);
    const dayIndex = weekDates.indexOf(local.date);
    if (dayIndex < 0) {
      return null;
    }

    const startMinutes = local.hour * 60 + local.minute;
    const end = this.sessionEnd(session, start);
    if (end <= start) {
      return null;
    }
    const endLocal = this.localDateTimeParts(end);
    const endMinutes = Math.max(startMinutes + 15, endLocal.hour * 60 + endLocal.minute);
    return {
      session,
      dayIndex,
      startMinutes,
      endMinutes,
      top: 0,
      height: 0,
      left: 0,
      width: 100,
      startLabel: this.formatMinuteLabel(startMinutes),
      timeLabel: this.sessionTimeLabel(session),
      title: session.name || this.formatWorkoutType(session.workoutType)
    };
  }

  private resolveAllDaySessions(): WorkoutSession[] {
    const dates = new Set(this.weekDates());
    return this.sessions().filter((session) => {
      const start = this.validDate(session.startedAt);
      if (!start) {
        return false;
      }
      return !this.validDate(session.completedAt) && (session.durationMinutes ?? 0) <= 0 && dates.has(this.localDateTimeParts(start).date);
    });
  }

  private splitOverlappingBlocks(blocks: WeekSessionBlock[]): WeekSessionBlock[] {
    const result: WeekSessionBlock[] = [];
    for (const dayIndex of [0, 1, 2, 3, 4, 5, 6]) {
      const dayBlocks = blocks.filter((block) => block.dayIndex === dayIndex);
      const clusters: WeekSessionBlock[][] = [];

      for (const block of dayBlocks) {
        const current = clusters.at(-1);
        const currentEnd = current ? Math.max(...current.map((item) => item.endMinutes)) : -1;
        if (!current || block.startMinutes >= currentEnd) {
          clusters.push([block]);
        } else {
          current.push(block);
        }
      }

      for (const cluster of clusters) {
        const lanes: number[] = [];
        const clusterBlocks = cluster.map((block) => {
          const lane = lanes.findIndex((end) => end <= block.startMinutes);
          const laneIndex = lane >= 0 ? lane : lanes.length;
          lanes[laneIndex] = block.endMinutes;
          return { ...block, left: 0, width: 100, laneIndex };
        });
        const columns = Math.max(1, lanes.length);
        result.push(
          ...clusterBlocks.map(({ laneIndex, ...block }) => ({
            ...block,
            left: ((dayIndex + laneIndex / columns) / 7) * 100,
            width: (1 / columns / 7) * 100
          }))
        );
      }
    }

    return result;
  }

  private buildMonthCalendarDays(anchor: Date): MonthCalendarDay[] {
    const first = this.startOfMonth(anchor);
    const last = this.endOfMonth(anchor);
    const cursor = this.startOfWeek(first);
    const end = this.addDays(this.startOfWeek(last), 6);
    const days: MonthCalendarDay[] = [];

    while (cursor <= end) {
      const date = this.formatIsoDate(cursor);
      const chips = this.sessionsForDate(date).map((session) => ({
        session,
        title: session.name || this.formatWorkoutType(session.workoutType),
        timeLabel: this.sessionTimeLabel(session)
      }));
      days.push({
        date,
        label: String(cursor.getDate()),
        inMonth: cursor.getMonth() === first.getMonth(),
        isToday: date === this.isoToday(),
        chips,
        visibleChips: chips.slice(0, 2),
        hiddenCount: Math.max(0, chips.length - 2)
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private sessionsForDate(date: string): WorkoutSession[] {
    return this.sessions()
      .filter((session) => {
        const start = this.validDate(session.startedAt);
        return start ? this.localDateTimeParts(start).date === date : false;
      })
      .sort((a, b) => this.sessionStartMs(a) - this.sessionStartMs(b));
  }

  private startInstant(): string {
    return new Date(`${this.startDate()}T00:00:00`).toISOString();
  }

  private endInstant(): string {
    return new Date(`${this.endDate()}T23:59:59.999`).toISOString();
  }

  private sessionStartMs(session: WorkoutSession): number {
    return this.validDate(session.startedAt)?.getTime() ?? 0;
  }

  private sessionEnd(session: WorkoutSession, start: Date): Date {
    const completed = this.validDate(session.completedAt);
    if (completed && completed > start) {
      return completed;
    }
    const durationMinutes = session.durationMinutes ?? 0;
    return durationMinutes > 0 ? new Date(start.getTime() + durationMinutes * 60_000) : start;
  }

  private sessionTimeLabel(session: WorkoutSession): string {
    const start = this.validDate(session.startedAt);
    if (!start) {
      return 'Untimed';
    }
    const end = this.sessionEnd(session, start);
    return `${this.formatTime(start)}-${this.formatTime(end)}`;
  }

  private formatWorkoutType(value: string): string {
    return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private validDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-SG', {
      timeZone: this.timezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  private localDateTimeParts(date: Date): { date: string; hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-SG', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') {
          acc[part.type] = part.value;
        }
        return acc;
      }, {});

    const hour = Number(parts['hour'] ?? 0);
    return {
      date: `${parts['year']}-${parts['month']}-${parts['day']}`,
      hour: hour === 24 ? 0 : hour,
      minute: Number(parts['minute'] ?? 0)
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
    // Local calendar date in the profile timezone so the "today" cell matches the user's day.
    const parts = new Intl.DateTimeFormat('en-SG', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .formatToParts(new Date())
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') {
          acc[part.type] = part.value;
        }
        return acc;
      }, {});
    return `${parts['year']}-${parts['month']}-${parts['day']}`;
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
