import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CoachContextService } from '../../../core/coach/coach-context.service';
import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayInsight, DayKind, TodayInsight, WeeklyTrainingInsight, WorkoutPlan, WorkoutSession } from '../../../core/fitsync.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { briefHeadline, quickQuestions } from './brief-copy';
import { formatDuration } from './brief-duration';
import { wheelSectors } from './brief-muscles';
import { dailyObservations } from './brief-observations';
import { BRIEF_NOW, DayPeriod, clockLabel, dateLabel, dayPeriodFor, periodLabel } from './brief-time';
import { BriefDay, buildWeek, buildWeekFromInsight, completedSessionCount, weekRange } from './brief-week';
import { CoachNoticedComponent } from './coach-noticed.component';
import { DAY_KIND_GLYPHS, isTrainingDayKind } from './day-kind-icons';
import { GlyphShape } from './muscle-icons';
import { MuscleWheelComponent } from './muscle-wheel.component';
import { TodayRowComponent } from './today-row.component';

/** WORKOUT_FREQUENCY goals track a weekly session count; other goal types don't apply here. */
const WORKOUT_FREQUENCY_GOAL_TYPE = 'WORKOUT_FREQUENCY';

@Component({
  selector: 'app-coach-brief',
  standalone: true,
  imports: [CoachNoticedComponent, FormsModule, MuscleWheelComponent, RouterLink, StatePanelComponent, TodayRowComponent],
  templateUrl: './coach-brief.component.html',
  styleUrl: './coach-brief.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachBriefComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly coachStore = inject(CoachStore);
  private readonly coachContext = inject(CoachContextService);
  private readonly router = inject(Router);
  private readonly now = inject(BRIEF_NOW);

  // Signal inputs, so the copy follows a value that arrives after the first render. The calorie
  // target does exactly that, because the page loads the nutrition summary on its own request.
  readonly firstName = input.required<string>();
  readonly timezone = input.required<string>();
  readonly caloriesTarget = input<number | null>(null);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  // Raw sessions from the range request. The week strip itself is derived below, because it is
  // drawn one of two ways depending on whether the weekly insight has day-kinds data yet.
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly weeklyTarget = signal<number | null>(null);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly completed = signal(0);
  // The weekly insight feeds the wheel and the observations. It stays null when its request fails,
  // and the brief then shows the week's count on the panel and leaves the observations out.
  readonly insight = signal<WeeklyTrainingInsight | null>(null);

  // The week strip is built from the insight's day-kinds `days` once the backend sends them; until
  // then it falls back to the sessions-only week it always knew how to build, so an insight
  // response without these fields draws exactly as it did before this feature existed.
  readonly week = computed<BriefDay[]>(() => {
    const days = this.insight()?.days;
    if (days) {
      return buildWeekFromInsight(days, this.todayDateKey());
    }
    return buildWeek(this.sessions(), this.now(), this.timezone());
  });

  // Today's own reading from the weekly insight, when the backend has it. Null keeps every row
  // and headline input at its pre-existing fallback.
  readonly todayInsight = computed<TodayInsight | null>(() => this.insight()?.today ?? null);

  // Today's matching entry in `days`, used only to read what was actually done today (its own
  // distance and duration), which `todayInsight().lastOfKind` does not carry since that describes
  // an earlier session, not today's.
  readonly todayDayEntry = computed<DayInsight | null>(() => {
    const days = this.insight()?.days;
    const today = this.todayInsight();
    if (!days || !today) {
      return null;
    }
    return days.find((day) => day.date === today.date) ?? null;
  });

  readonly nextTrainingInsight = computed(() => this.insight()?.nextTraining ?? null);

  readonly sectors = computed(() => {
    const insight = this.insight();
    return insight ? wheelSectors(insight) : [];
  });

  readonly observations = computed(() => {
    const insight = this.insight();
    return insight ? dailyObservations(insight, this.now(), this.timezone()) : [];
  });

  readonly panelTitle = computed(() =>
    this.sectors().some((sector) => sector.inPlan) || (!this.sectors().length && this.activePlan() !== null)
      ? 'Your plan this week'
      : 'Your training this week'
  );

  readonly starting = signal(false);
  readonly startError = signal<string | null>(null);

  readonly period = computed<DayPeriod>(() => dayPeriodFor(this.now(), this.timezone()));
  readonly afterDark = computed(() => this.period() === 'EVENING' || this.period() === 'NIGHT');
  readonly periodLabelText = computed(() => periodLabel(this.period()));
  readonly clockText = computed(() => clockLabel(this.now(), this.timezone()));
  readonly dateText = computed(() => dateLabel(this.now(), this.timezone()));

  readonly headline = computed(() =>
    briefHeadline({
      period: this.period(),
      firstName: this.firstName(),
      completed: this.completed(),
      target: this.weeklyTarget(),
      daysLeftInWeek: this.daysLeftInWeek(),
      completedToday: this.completedToday(),
      restToday: this.todayInsight()?.kind === 'REST',
      trainedYesterday: this.trainedYesterday(),
      daysSinceLastSession: this.daysSinceLastSession()
    })
  );

  // Today counts as completed once its source is DONE; without the day-kinds fields, the week
  // strip's own today-trained entry (with real minutes) is the only signal available.
  readonly completedToday = computed(() => {
    const today = this.todayInsight();
    if (today) {
      return today.source === 'DONE';
    }
    const day = this.week().find((day) => day.state === 'today-trained');
    return day != null && (day.minutes ?? 0) > 0;
  });

  // Yesterday's own week-strip entry is the source of truth when yesterday falls inside the
  // current Monday-to-Sunday week; on a Monday, yesterday belongs to last week, so the weekly
  // insight's per-muscle-group flag is the only place left to look.
  readonly trainedYesterday = computed(() => {
    const days = this.week();
    const todayIndex = days.findIndex((day) => day.state === 'today-open' || day.state === 'today-trained');
    if (todayIndex > 0) {
      return days[todayIndex - 1].state === 'trained';
    }
    const insight = this.insight();
    return insight != null && insight.muscleGroups.some((group) => group.trainedYesterday);
  });

  // The most recent last-trained date across every muscle group, compared with today's calendar
  // date in the user's timezone. Null when the insight has not loaded or no group has ever trained.
  readonly daysSinceLastSession = computed<number | null>(() => {
    const insight = this.insight();
    if (!insight) {
      return null;
    }
    const dates = insight.muscleGroups
      .map((group) => group.lastTrainedOn)
      .filter((date): date is string => date != null);
    if (!dates.length) {
      return null;
    }
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    return this.daysBetweenKeys(latest, this.todayDateKey());
  });

  readonly quickQuestionList = computed(() => quickQuestions(this.period(), this.caloriesTarget()));

  readonly weekAriaLabel = computed(() => {
    const days = this.week();
    if (!days.length) {
      return 'This week.';
    }
    // A day that has not happened yet and carries no schedule is left out, because calling it
    // rest would be untrue; a planned later day is named, since the plan is real even though the
    // day is not.
    // A day that nothing is known about is left out, as it has no caption on the strip either.
    const parts = days
      .filter((day) => (day.state !== 'upcoming' || day.planned) && !(day.state === 'rest' && day.kind === 'OPEN'))
      .map((day) => this.dayAriaFragment(day));
    return `This week. ${parts.join(', ')}.`;
  });

  readonly targetMet = computed(() => {
    const target = this.weeklyTarget();
    return target != null && target > 0 && this.completed() >= target;
  });

  // The row for today replaces the plan-only next-session row once the insight carries `today`;
  // until then, the page looks and behaves exactly as it did before this feature existed.
  readonly showTodayRow = computed(() => this.todayInsight() !== null);
  readonly showNextSession = computed(() => this.todayInsight() === null && this.activePlan() !== null && this.period() !== 'NIGHT');
  // The row for today hides its own start-button rows on the same rule the row it replaces used
  // (night only, not the whole evening); a row with no start button ignores this entirely.
  readonly hideTodayRowStartButton = computed(() => this.period() === 'NIGHT');

  readonly nextSessionMeta = computed(() => {
    const plan = this.activePlan();
    if (!plan) {
      return '';
    }
    const duration = formatDuration(plan.estimatedDurationMinutes);
    return this.targetMet() ? `${duration} · a bonus, your goal is already met` : duration;
  });

  readonly askText = signal('');
  readonly askInputId = 'coach-brief-ask';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.startError.set(null);

    const now = this.now();
    const { from, to } = weekRange(now, this.timezone());

    this.dataService.getWorkoutSessionsInRange(from, to).subscribe({
      next: (sessions: WorkoutSession[]) => {
        this.sessions.set(sessions);
        this.completed.set(completedSessionCount(sessions, now, this.timezone()));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });

    this.dataService.getWeeklyTrainingInsight(this.timezone()).subscribe({
      next: (insight) => {
        this.insight.set(insight);
        this.coachContext.setTodayKind(insight.today?.kind ?? null);
      },
      error: () => this.insight.set(null)
    });

    this.dataService.getGoals().subscribe({
      next: (goals) => {
        const active = goals.find((goal) => goal.goalType === WORKOUT_FREQUENCY_GOAL_TYPE && goal.status === 'ACTIVE');
        this.weeklyTarget.set(active?.targetValue ?? null);
      },
      // Goals are a soft dependency: no target simply means the headline drops the goal copy.
      error: () => this.weeklyTarget.set(null)
    });

    this.dataService.getActivePlan().subscribe({
      next: (plan) => this.activePlan.set(plan),
      // No active plan means no next-session row; that is a valid, quiet state.
      error: () => this.activePlan.set(null)
    });
  }

  startSession(): void {
    const plan = this.activePlan();
    if (!plan?.planId || this.starting()) {
      return;
    }
    this.starting.set(true);
    this.startError.set(null);
    this.dataService.startWorkoutPlan(plan.planId).subscribe({
      next: () => {
        this.starting.set(false);
        void this.router.navigate(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
      },
      error: () => {
        this.starting.set(false);
        this.startError.set('Unable to start this session. Please retry.');
      }
    });
  }

  /** Starts a session from the row for today, which knows which plan day it is starting (its own
   *  day, or one carried over from earlier in the week) and passes that on; the legacy
   *  startSession() above is untouched, since it is only ever reached without that information. */
  startTodayRow(planDayId: string | null): void {
    const plan = this.activePlan();
    if (!plan?.planId || this.starting()) {
      return;
    }
    this.starting.set(true);
    this.startError.set(null);
    this.dataService.startWorkoutPlan(plan.planId, { planDayId, timezone: this.timezone() }).subscribe({
      next: () => {
        this.starting.set(false);
        void this.router.navigate(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
      },
      error: () => {
        this.starting.set(false);
        this.startError.set('Unable to start this session. Please retry.');
      }
    });
  }

  goToWorkout(): void {
    void this.router.navigate(['/workout']);
  }

  browsePlans(): void {
    void this.router.navigate(['/workout'], { queryParams: { tab: 'plans' } });
  }

  submitAsk(): void {
    const text = this.askText().trim();
    if (!text) {
      return;
    }
    this.coachStore.open();
    this.coachStore.ask(text);
    this.askText.set('');
  }

  askQuickQuestion(question: string): void {
    this.coachStore.open();
    this.coachStore.ask(question);
  }

  dayCaption(day: BriefDay): string {
    switch (day.state) {
      case 'trained':
      case 'today-trained':
        return day.minutes != null ? formatDuration(day.minutes) : '';
      case 'today-open':
        if (day.kind === null) {
          // No day-kind data available: the sessions-only week always called this "open".
          return 'open';
        }
        if (day.kind === 'OPEN') {
          return 'open';
        }
        // The other captions of the strip are lower case, and a rest day today matches them.
        return day.kind === 'REST' ? 'rest' : (day.label ?? '');
      case 'rest':
        // A day the coach knows to be a rest day still reads "rest"; a day with no data at all
        // (kind OPEN) is quieter and says nothing, rather than guessing at a rest that may not be.
        return day.kind === 'OPEN' ? '' : 'rest';
      case 'upcoming':
        return day.planned ? 'planned' : '';
      default:
        return '';
    }
  }

  /** True for a training kind, used by the template to decide whether the strip draws a glyph. */
  isTraining(kind: DayKind | null): boolean {
    return isTrainingDayKind(kind);
  }

  glyphFor(kind: DayKind | null): GlyphShape[] {
    return kind ? DAY_KIND_GLYPHS[kind] : [];
  }

  /** Today's calendar-day key in the user's timezone, in the same YYYY-MM-DD shape the weekly
   *  insight uses for lastTrainedOn, so the two can be compared as plain strings. */
  private todayDateKey(): string {
    const timezone = this.timezone();
    try {
      return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(
        this.now()
      );
    } catch {
      return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(this.now());
    }
  }

  /** Whole calendar days between two YYYY-MM-DD keys (to minus from), treated as UTC dates so the
   *  arithmetic never shifts across a timezone boundary. */
  private daysBetweenKeys(fromKey: string, toKey: string): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const from = new Date(`${fromKey}T00:00:00Z`).getTime();
    const to = new Date(`${toKey}T00:00:00Z`).getTime();
    return Math.round((to - from) / msPerDay);
  }

  private daysLeftInWeek(): number {
    const days = this.week();
    if (!days.length) {
      return 0;
    }
    const remaining = days.filter((day) => day.state === 'today-open' || day.state === 'today-trained' || day.state === 'upcoming');
    return remaining.length;
  }

  private dayAriaFragment(day: BriefDay): string {
    const kindWord = day.kind ? day.kind.toLowerCase() : '';
    if (day.state === 'today-open') {
      if (!day.kind || day.kind === 'OPEN') {
        return 'today open';
      }
      if (day.kind === 'REST') {
        return 'today rest';
      }
      return `today ${kindWord} planned`;
    }
    if (day.state === 'today-trained') {
      return `today ${kindWord} ${formatDuration(day.minutes)}`;
    }
    if (day.state === 'trained') {
      return `${day.weekday} ${kindWord} ${formatDuration(day.minutes)}`;
    }
    if (day.planned) {
      return `${day.weekday} ${kindWord} planned`;
    }
    return `${day.weekday} rest`;
  }
}
