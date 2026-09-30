import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CarriedOverDay, DayInsight, NextTraining, TodayInsight } from '../../../core/fitsync.models';
import { formatDuration, formatKm, formatPace } from './brief-duration';
import { DAY_KIND_GLYPHS, isTrainingDayKind } from './day-kind-icons';
import { GlyphShape } from './muscle-icons';

const FULL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** What the row shows and does, worked out once from today's kind and source. A row either starts
 *  a session, continues one already running, or only offers a link; never more than one button. */
export interface TodayRowView {
  eyebrow: string;
  title: string;
  meta: string;
  action: 'start' | 'continue' | 'none';
  link: 'trainElsewhere' | 'seeSession' | 'trainToday' | 'browsePlans' | 'none';
  planDayId: string | null;
  /** True only for the rows whose button starts a session; the night-hiding rule below reads
   *  this rather than repeating the row-kind checks. */
  hasStartButton: boolean;
}

/** Full weekday name for a YYYY-MM-DD key, read from the calendar date itself, independent of any
 *  particular timezone (the date has already been resolved server-side). */
function weekdayFullFromDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/** Joins the parts of a meta line with " · ", dropping any part that came back empty so the line
 *  never carries a dangling separator or the word "null". */
function joinMeta(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(' · ');
}

function carriedOverView(day: CarriedOverDay): TodayRowView {
  const weekday = FULL_WEEKDAYS[day.dayOfWeek - 1] ?? '';
  return {
    eyebrow: `Still open from ${weekday}`,
    title: day.title,
    meta: formatDuration(day.estimatedMinutes),
    action: 'start',
    link: 'trainElsewhere',
    planDayId: day.planDayId,
    hasStartButton: true
  };
}

function planMeta(today: TodayInsight): string {
  const duration = formatDuration(today.estimatedMinutes);
  if (today.kind === 'STRENGTH' || today.kind === 'MOBILITY') {
    const moves = today.moves != null ? `${today.moves} ${today.moves === 1 ? 'move' : 'moves'}` : '';
    return joinMeta([moves, duration]);
  }
  if (today.kind === 'CARDIO') {
    const distance = today.lastOfKind?.distanceKm;
    return distance != null ? joinMeta([`${formatKm(distance)} last time`, duration]) : duration;
  }
  if (today.kind === 'SPORT') {
    const lastMinutes = today.lastOfKind?.minutes;
    return lastMinutes != null ? `${formatDuration(lastMinutes)} last time` : duration;
  }
  return duration;
}

function planView(today: TodayInsight): TodayRowView {
  return {
    eyebrow: 'Today in your plan',
    title: today.title ?? today.label,
    meta: planMeta(today),
    action: 'start',
    link: 'trainElsewhere',
    planDayId: today.planDayId,
    hasStartButton: true
  };
}

function habitMeta(today: TodayInsight): string {
  const last = today.lastOfKind;
  if (!last) {
    return '';
  }
  const duration = formatDuration(last.minutes);
  const base = joinMeta([last.distanceKm != null ? formatKm(last.distanceKm) : '', duration]);
  return base ? `${base} last time` : '';
}

function habitView(today: TodayInsight): TodayRowView {
  return {
    eyebrow: 'Your usual',
    title: today.label,
    meta: habitMeta(today),
    action: 'start',
    link: 'trainElsewhere',
    planDayId: today.planDayId,
    hasStartButton: true
  };
}

function inProgressView(today: TodayInsight): TodayRowView {
  return {
    eyebrow: 'In progress',
    title: today.title ?? today.label,
    meta: '',
    action: 'continue',
    link: 'none',
    planDayId: null,
    hasStartButton: false
  };
}

/** Today's own distance, duration, and pace, read from its entry in the week's `days` (not from
 *  `lastOfKind`, which describes an earlier session of the same kind, not today's). Pace is not
 *  sent by the backend for a single day, so it is derived from the duration and distance here. */
function doneMeta(todayDay: DayInsight | null): string {
  if (!todayDay) {
    return '';
  }
  const duration = formatDuration(todayDay.minutes);
  if (todayDay.kind === 'CARDIO' && todayDay.minutes != null) {
    const distance = todayDay.sessions.reduce(
      (sum, session) => sum + (session.kind === 'CARDIO' && session.distanceKm != null ? session.distanceKm : 0),
      0
    );
    if (distance > 0) {
      const paceSecondsPerKm = (todayDay.minutes * 60) / distance;
      return joinMeta([formatKm(distance), duration, `${formatPace(paceSecondsPerKm)} per km`]);
    }
  }
  return duration;
}

function doneView(today: TodayInsight, todayDay: DayInsight | null): TodayRowView {
  return {
    eyebrow: 'Done today',
    title: today.title ?? today.label,
    meta: doneMeta(todayDay),
    action: 'none',
    link: 'seeSession',
    planDayId: null,
    hasStartButton: false
  };
}

function restTitle(next: NextTraining | null): string {
  if (!next) {
    return 'Nothing planned';
  }
  return `Next is ${weekdayFullFromDate(next.date)}, ${next.label.toLowerCase()}`;
}

function restView(next: NextTraining | null): TodayRowView {
  return {
    eyebrow: 'Rest today',
    title: restTitle(next),
    meta: next ? joinMeta([next.title, formatDuration(next.estimatedMinutes)]) : '',
    action: 'none',
    link: 'trainToday',
    planDayId: null,
    hasStartButton: false
  };
}

function openView(): TodayRowView {
  return {
    eyebrow: 'No plan yet',
    title: 'Pick a plan',
    meta: 'It says what each day is for.',
    action: 'none',
    link: 'browsePlans',
    planDayId: null,
    hasStartButton: false
  };
}

/** Picks the row's shape from today's kind and source, in the priority order the spec fixes: a
 *  carried-over day the user still has not started outranks the plain rest or open reading of
 *  today, then a session already done or in progress, then what the plan or habit schedules. */
export function computeTodayRowView(today: TodayInsight, todayDay: DayInsight | null, nextTraining: NextTraining | null): TodayRowView {
  if ((today.kind === 'REST' || today.kind === 'OPEN') && today.carriedOver.length > 0) {
    return carriedOverView(today.carriedOver[0]);
  }
  if (today.source === 'DONE') {
    return doneView(today, todayDay);
  }
  if (today.source === 'IN_PROGRESS') {
    return inProgressView(today);
  }
  if (isTrainingDayKind(today.kind) && today.source === 'PLAN') {
    return planView(today);
  }
  if (isTrainingDayKind(today.kind) && today.source === 'HABIT') {
    return habitView(today);
  }
  if (today.kind === 'REST') {
    return restView(nextTraining);
  }
  return openView();
}

/**
 * The row that tells the user what today is, once the weekly insight carries the day-kinds
 * fields. It replaces the plan-only "Next in your plan" row in coach-brief.component.html, which
 * stays as the fallback for as long as the insight has no `today`.
 */
@Component({
  selector: 'app-today-row',
  standalone: true,
  templateUrl: './today-row.component.html',
  styleUrl: './today-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayRowComponent {
  readonly today = input.required<TodayInsight>();
  /** Today's own entry from the week's `days`, when the insight has it; only its minutes and
   *  sessions are read, and only for the "done today" row. */
  readonly todayDay = input<DayInsight | null>(null);
  readonly nextTraining = input<NextTraining | null>(null);
  /** True in the evening and at night. A row whose button would start a fresh session hides then,
   *  same as the row it replaces; a row that only reports what already happened does not. */
  readonly afterDark = input(false);
  readonly starting = input(false);
  readonly startError = input<string | null>(null);

  readonly startSession = output<string | null>();
  readonly goToWorkout = output<void>();
  readonly browsePlans = output<void>();

  readonly view = computed(() => computeTodayRowView(this.today(), this.todayDay(), this.nextTraining()));

  readonly hidden = computed(() => this.afterDark() && this.view().hasStartButton);

  readonly glyph = computed<GlyphShape[]>(() => DAY_KIND_GLYPHS[this.today().kind]);

  onStart(): void {
    if (this.starting()) {
      return;
    }
    this.startSession.emit(this.view().planDayId);
  }

  onContinue(): void {
    this.goToWorkout.emit();
  }

  onLinkClick(event?: Event): void {
    // The link's href is a plain fallback for a user without JavaScript; the SPA always handles
    // the click itself and works out the exact destination (a plans-tab query param or not).
    event?.preventDefault();
    const link = this.view().link;
    if (link === 'browsePlans') {
      this.browsePlans.emit();
    } else if (link !== 'none') {
      this.goToWorkout.emit();
    }
  }
}
