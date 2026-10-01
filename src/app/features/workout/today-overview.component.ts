import { Component, computed, input, output } from '@angular/core';

import {
  DayInsight,
  DayKind,
  DaySessionInsight,
  NextTraining,
  TodayInsight,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSession,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { formatDuration, formatKm, formatPace } from '../dashboard/brief/brief-duration';
import { DAY_KIND_GLYPHS, isTrainingDayKind } from '../dashboard/brief/day-kind-icons';
import { GlyphShape } from '../dashboard/brief/muscle-icons';
import { HabitDayStartComponent } from './habit-day-start.component';
import { lastTitle } from './workout-week';
import { isoWeekdayOfDateKey, planDayOn } from './plan-day-pick';
import { PlanTemplatesComponent } from './plan-templates.component';
import { deriveDurationMinutes, isCompletedSession } from './workout-session.util';

/** Which plan day a Start press means. The day is null when the card cannot tell (the plain
 *  fallback), and the backend then picks the day for today itself. */
export interface TodayStartEvent {
  plan: WorkoutPlan;
  planDayId: string | null;
}

/** The session a Continue or See the session press points at, when the weekly insight names one. */
export interface TodayOpenSessionEvent {
  sessionId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
}

type TodayAction = 'start' | 'log' | 'browse' | 'open';

interface TodayButton {
  label: string;
  action: TodayAction;
  /** A line under the label, such as the title of the session a rest day offers. */
  note?: string;
}

interface TodayCard {
  kind: DayKind;
  eyebrow: string;
  title: string;
  chips: string[];
  rows: WorkoutPlanExercise[];
  moreCount: number;
  body: string | null;
  primary: TodayButton | null;
  secondary: TodayButton | null;
  link: TodayButton | null;
  planDayId: string | null;
  ariaLabel: string;
  showTemplates: boolean;
  /** A habit day without a plan day: the card shows the habit start in place of the plain actions. */
  habit: TodayInsight | null;
  /** A rest day: both choices are quiet, so nothing on the card asks the person to train. */
  quiet: boolean;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A mobility card shows a taste of the routine, not all of it. */
const MOBILITY_ROW_LIMIT = 3;

const START_LABEL = 'Start session';
const BROWSE_LINK: TodayButton = { label: 'Train something else', action: 'browse' };

@Component({
  selector: 'app-today-overview',
  imports: [PlanTemplatesComponent, HabitDayStartComponent],
  templateUrl: './today-overview.component.html',
  styleUrl: './today-overview.component.scss'
})
export class TodayOverviewComponent {
  readonly activePlan = input.required<WorkoutPlan | null>();
  readonly sessions = input.required<WorkoutSession[]>();
  /** The latest completed session, asked for on its own: the rows above are the first page of the
   *  history, whose newest entries may be cancelled or still running. */
  readonly lastCompleted = input<WorkoutSession | null>(null);
  readonly starting = input(false);
  /** Today's reading from the weekly insight; null while it loads, when it fails, or on an older
   *  backend, and the card then shows the plain plan. */
  readonly today = input<TodayInsight | null>(null);
  readonly nextTraining = input<NextTraining | null>(null);
  /** Today's entry in the insight's week, which knows the sessions behind a finished day. */
  readonly todayDay = input<DayInsight | null>(null);
  readonly timezone = input('');

  readonly startPlan = output<TodayStartEvent>();
  readonly startExercise = output<WorkoutPlanExercise>();
  readonly browsePlans = output<void>();
  readonly templateActivated = output<WorkoutPlan>();
  readonly logManually = output<DayKind>();
  readonly openSession = output<TodayOpenSessionEvent>();
  /** A habit day started a session of its own (repeated, or a plain timer). */
  readonly habitStarted = output<WorkoutSessionDetail>();

  readonly latestSession = computed<WorkoutSession | null>(() => {
    const given = this.lastCompleted();
    if (given) {
      return given;
    }
    const sorted = this.sessions()
      .filter(isCompletedSession)
      .sort((a, b) => this.timeOf(b) - this.timeOf(a));
    return sorted[0] ?? null;
  });

  readonly card = computed<TodayCard>(() => this.buildCard());

  readonly glyph = computed<GlyphShape[]>(() => DAY_KIND_GLYPHS[this.card().kind]);

  /** The footer's second line: when and how long, or nothing when the session has neither. */
  /** "Cardio · Treadmill": the kind, then the name, written the same way everywhere. */
  lastTitle(session: WorkoutSession): string {
    return lastTitle(session);
  }

  readonly lastSessionDetail = computed(() => {
    const session = this.latestSession();
    if (!session) {
      return '';
    }
    const when = this.formatSessionDay(session.completedAt || session.startedAt);
    const minutes = deriveDurationMinutes(session.startedAt, session.completedAt) ?? session.durationMinutes;
    const duration = minutes && minutes > 0 ? formatDuration(minutes) : '';
    return [when, duration].filter(Boolean).join(' · ');
  });

  run(action: TodayAction, event?: Event): void {
    // A link's href is only a fallback for a browser without scripts.
    event?.preventDefault();
    const card = this.card();
    switch (action) {
      case 'start': {
        const plan = this.activePlan();
        if (plan?.planId) {
          this.startPlan.emit({ plan, planDayId: card.planDayId });
        }
        break;
      }
      case 'log':
        this.logManually.emit(card.kind);
        break;
      case 'browse':
        this.browsePlans.emit();
        break;
      case 'open':
        this.openSession.emit(this.sessionToOpen());
        break;
    }
  }

  startHabitPlanDay(planDayId: string | null): void {
    const plan = this.activePlan();
    if (plan?.planId) {
      this.startPlan.emit({ plan, planDayId });
    }
  }

  isDisabled(button: TodayButton): boolean {
    return button.action === 'start' && (this.starting() || !this.activePlan()?.planId);
  }

  buttonLabel(button: TodayButton): string {
    return button.action === 'start' && this.starting() ? 'Starting…' : button.label;
  }

  startFromExercise(exercise: WorkoutPlanExercise): void {
    if (this.activePlan()?.planId) {
      this.startExercise.emit(exercise);
    }
  }

  exerciseKey(exercise: WorkoutPlanExercise): string {
    return exercise.planExerciseId ?? exercise.exerciseId ?? `${exercise.sequence}-${exercise.exerciseNameSnapshot}`;
  }

  exerciseTarget(exercise: WorkoutPlanExercise): string {
    const parts: string[] = [];
    const { targetSets: sets, targetReps: reps, targetDurationSeconds: seconds, targetDistanceKm: distance } = exercise;
    const duration = seconds ? this.durationLabel(seconds) : '';
    const km = distance ? formatKm(distance) : '';
    if (reps) {
      parts.push(`${sets ?? '-'} × ${reps}`);
      if (duration) {
        parts.push(duration);
      }
      if (km) {
        parts.push(km);
      }
    } else {
      // A run or a ride leads with how far, then for how long.
      if (km) {
        parts.push(km);
      }
      if (duration) {
        parts.push(sets ? `${sets} × ${duration}` : duration);
      } else if (sets && !km) {
        parts.push(`${sets} sets`);
      }
    }
    if (exercise.targetWeightKg) {
      parts.push(`${exercise.targetWeightKg} kg`);
    }
    if (exercise.restSeconds) {
      parts.push(`${exercise.restSeconds} s rest`);
    }
    return parts.length ? parts.join(' · ') : 'Guided movement';
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private buildCard(): TodayCard {
    const today = this.today();
    const plan = this.activePlan();
    if (!today) {
      return plan ? this.planFallbackCard(plan) : this.noPlanCard();
    }
    if (today.source === 'IN_PROGRESS') {
      return this.inProgressCard(today);
    }
    if (today.source === 'DONE') {
      return this.doneCard(today);
    }
    if ((today.kind === 'REST' || today.kind === 'OPEN') && today.carriedOver.length > 0) {
      return this.carriedOverCard(today);
    }
    if (today.kind === 'REST') {
      return this.restCard();
    }
    if (today.kind === 'OPEN') {
      return plan ? this.planFallbackCard(plan) : this.noPlanCard();
    }
    return today.source === 'HABIT' ? this.habitCard(today) : this.plannedCard(today);
  }

  /** The card for a plan when the insight cannot say what today is for. */
  private planFallbackCard(plan: WorkoutPlan): TodayCard {
    const rows = this.sortExercises(plan.exercises);
    return this.makeCard({
      kind: this.kindOfWorkoutType(plan.workoutType),
      eyebrow: 'Today',
      title: plan.name,
      chips: [this.movesChip(rows.length), formatDuration(plan.estimatedDurationMinutes), this.formatLabel(plan.difficulty)],
      rows,
      primary: { label: START_LABEL, action: 'start' },
      ariaLabel: `Today's workout, ${plan.name}`
    });
  }

  private noPlanCard(): TodayCard {
    return this.makeCard({
      kind: 'OPEN',
      eyebrow: 'No plan yet',
      title: 'Pick a plan for today',
      body: 'A plan says what each day of the week is for.',
      primary: { label: 'Browse plans', action: 'browse' },
      ariaLabel: "Today's workout, no plan yet",
      showTemplates: true
    });
  }

  private plannedCard(today: TodayInsight): TodayCard {
    const kind = today.kind;
    const plan = this.activePlan();
    const allRows = kind === 'SPORT' ? [] : this.dayExercises(today.planDayId);
    const rows = kind === 'MOBILITY' ? allRows.slice(0, MOBILITY_ROW_LIMIT) : allRows;
    const last = today.lastOfKind;
    const moves = this.movesChip(today.moves ?? (allRows.length || null));
    const duration = formatDuration(today.estimatedMinutes);

    let chips: string[];
    switch (kind) {
      case 'CARDIO':
        chips = [duration, this.suffixed(formatKm(last?.distanceKm), 'last time'), this.suffixed(formatPace(last?.paceSecondsPerKm), 'per km')];
        break;
      case 'MOBILITY':
        chips = [moves, duration];
        break;
      case 'SPORT':
        chips = [this.suffixed(formatDuration(last?.minutes), 'last time') || duration];
        break;
      default:
        chips = [moves, duration, plan ? this.formatLabel(plan.difficulty) : ''];
    }

    const name = this.kindName(today);
    return this.makeCard({
      kind,
      eyebrow: `Today · ${name}`,
      title: kind === 'SPORT' ? today.label : today.title || today.label,
      chips,
      rows,
      moreCount: allRows.length - rows.length,
      primary: { label: START_LABEL, action: 'start' },
      secondary: kind === 'SPORT' ? { label: 'Log it afterwards', action: 'log' } : null,
      link: kind === 'SPORT' ? null : BROWSE_LINK,
      planDayId: today.planDayId,
      ariaLabel: `Today's workout, ${name}`
    });
  }

  /** A day the plan does not schedule but the user usually trains. Without a plan day the card
   *  hands over to the habit start, which recommends the usual session and offers others. */
  private habitCard(today: TodayInsight): TodayCard {
    const last = today.lastOfKind;
    if (!today.planDayId) {
      return this.makeCard({
        kind: today.kind,
        eyebrow: `Your usual · ${today.label}`,
        title: today.label,
        habit: today,
        ariaLabel: `Today's workout, your usual ${this.kindName(today)}`
      });
    }
    return this.makeCard({
      kind: today.kind,
      eyebrow: `Your usual · ${today.label}`,
      title: today.label,
      chips: [this.suffixed(formatKm(last?.distanceKm), 'last time'), this.suffixed(formatDuration(last?.minutes), 'last time')],
      primary: { label: START_LABEL, action: 'start' },
      link: BROWSE_LINK,
      planDayId: today.planDayId,
      ariaLabel: `Today's workout, your usual ${this.kindName(today)}`
    });
  }

  private inProgressCard(today: TodayInsight): TodayCard {
    return this.makeCard({
      kind: today.kind,
      eyebrow: 'In progress',
      title: today.title || today.label,
      primary: { label: 'Continue', action: 'open' },
      ariaLabel: "Today's workout, in progress"
    });
  }

  /** The insight's day entry has the finished session's minutes and distance. It carries no pace,
   *  so the pace is worked out from the two. */
  private doneCard(today: TodayInsight): TodayCard {
    const session = this.pickSession('COMPLETED');
    const minutes = this.todayDay()?.minutes ?? session?.minutes ?? null;
    const distance = today.kind === 'CARDIO' ? (session?.distanceKm ?? null) : null;
    const pace = distance && minutes ? (minutes * 60) / distance : null;
    return this.makeCard({
      kind: today.kind,
      eyebrow: 'Done today',
      title: today.title || today.label,
      chips: [formatDuration(minutes), formatKm(distance), this.suffixed(formatPace(pace), 'per km')],
      link: { label: 'See the session', action: 'open' },
      ariaLabel: "Today's workout, done"
    });
  }

  private restCard(): TodayCard {
    const next = this.nextTraining();
    const weekday = next ? this.weekdayOfDate(next.date) : '';
    const nextName = next?.kind === 'SPORT' ? next.label : (next?.title || next?.label);
    const chips = next && weekday ? [`Next: ${weekday}`, nextName ?? '', formatDuration(next.estimatedMinutes)] : [];
    // The next training does not say which plan day it is, so the day is found by its weekday.
    const day = next ? planDayOn(this.activePlan()?.days, isoWeekdayOfDateKey(next.date)) : null;
    if (next && weekday && day) {
      return this.makeCard({
        kind: 'REST',
        eyebrow: 'Today · Rest',
        title: 'Rest day',
        chips,
        primary: { label: `Do ${weekday}'s session today`, action: 'start' },
        link: BROWSE_LINK,
        quiet: true,
        planDayId: day.planDayId,
        ariaLabel: "Today's workout, rest day"
      });
    }
    return this.makeCard({
      kind: 'REST',
      eyebrow: 'Today · Rest',
      title: 'Rest day',
      chips,
      link: { label: 'Train today', action: 'browse' },
      ariaLabel: "Today's workout, rest day"
    });
  }

  private carriedOverCard(today: TodayInsight): TodayCard {
    const first = today.carriedOver[0];
    return this.makeCard({
      kind: first.kind,
      eyebrow: `Still open from ${WEEKDAYS[first.dayOfWeek - 1] ?? 'earlier this week'}`,
      title: first.title,
      chips: [formatDuration(first.estimatedMinutes)],
      rows: this.dayExercises(first.planDayId),
      primary: { label: START_LABEL, action: 'start' },
      link: BROWSE_LINK,
      planDayId: first.planDayId,
      ariaLabel: `Today's workout, still open from ${WEEKDAYS[first.dayOfWeek - 1] ?? 'earlier this week'}`
    });
  }

  /** Fills every part a form leaves out and drops empty chips, so no template branch has to
   *  guard against a missing piece. */
  private makeCard(parts: Partial<TodayCard> & Pick<TodayCard, 'kind' | 'eyebrow' | 'title' | 'ariaLabel'>): TodayCard {
    return {
      rows: [],
      moreCount: 0,
      body: null,
      primary: null,
      secondary: null,
      link: null,
      planDayId: null,
      showTemplates: false,
      habit: null,
      quiet: false,
      ...parts,
      chips: (parts.chips ?? []).filter((chip) => chip.trim() !== '')
    };
  }

  private dayExercises(planDayId: string | null): WorkoutPlanExercise[] {
    if (!planDayId) {
      return [];
    }
    const day = this.activePlan()?.days?.find((entry) => entry.planDayId === planDayId);
    return day ? this.sortExercises(day.exercises) : [];
  }

  private sortExercises(exercises: WorkoutPlanExercise[] | undefined): WorkoutPlanExercise[] {
    return [...(exercises ?? [])].sort((a, b) => a.sequence - b.sequence);
  }

  private kindOfWorkoutType(workoutType: string): DayKind {
    switch (workoutType) {
      case 'CARDIO':
      case 'HIIT':
        return 'CARDIO';
      case 'MOBILITY':
      case 'YOGA':
      case 'PILATES':
        return 'MOBILITY';
      case 'SPORTS':
        return 'SPORT';
      default:
        return 'STRENGTH';
    }
  }

  private kindName(today: TodayInsight): string {
    return isTrainingDayKind(today.kind) ? this.formatLabel(today.kind) : today.label;
  }

  /** Whole minutes read better than a long count of seconds, so a run of 2100 s shows as 35 min. */
  private durationLabel(seconds: number): string {
    return seconds >= 120 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
  }

  private movesChip(count: number | null): string {
    if (!count || count < 1) {
      return '';
    }
    return `${count} ${count === 1 ? 'move' : 'moves'}`;
  }

  /** Joins a value and its unit word, or gives nothing when the value is missing. */
  private suffixed(value: string, suffix: string): string {
    return value ? `${value} ${suffix}` : '';
  }

  private pickSession(status: 'IN_PROGRESS' | 'COMPLETED'): DaySessionInsight | null {
    const matching = (this.todayDay()?.sessions ?? []).filter((session) => session.status === status);
    if (matching.length === 0) {
      return null;
    }
    return matching.reduce((best, session) => ((session.minutes ?? 0) > (best.minutes ?? 0) ? session : best));
  }

  private sessionToOpen(): TodayOpenSessionEvent {
    const status = this.today()?.source === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED';
    return { sessionId: this.pickSession(status)?.sessionId ?? null, status };
  }

  /** Names the weekday of a YYYY-MM-DD key. The key is a calendar day already in the user's
   *  timezone, so it is read as plain date parts and never shifted through an instant. */
  private weekdayOfDate(dateKey: string): string {
    const weekday = isoWeekdayOfDateKey(dateKey);
    return weekday ? (WEEKDAYS[weekday - 1] ?? '') : '';
  }

  private formatSessionDay(value: string | null | undefined): string {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: this.timezone() || undefined });
    } catch {
      // An unknown zone name should not cost the whole footer; the browser's own zone is close.
      formatter = new Intl.DateTimeFormat('en-GB', options);
    }
    const parts = formatter.formatToParts(date);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
    return [part('weekday'), part('day'), part('month')].filter(Boolean).join(' ');
  }

  private timeOf(session: WorkoutSession): number {
    const value = session.completedAt || session.startedAt;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }
}
