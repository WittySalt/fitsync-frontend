import { Component, Injector, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { CoachStore } from '../../core/coach/coach.store';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { LastOfKind, SportActivityOption, TodayInsight, WorkoutPlan, WorkoutPlanDay, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { formatDuration, formatKm } from '../dashboard/brief/brief-duration';
import { isoWeekdayOfDateKey } from './plan-day-pick';
import { WorkoutLiveService } from './workout-live.service';

type TimerKind = 'STRENGTH' | 'CARDIO' | 'MOBILITY';

interface PlanChoice {
  planDayId: string | null;
  title: string;
  /** The weekday and the minutes, as one line. */
  detail: string;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** The plain timed workouts a person can start without a plan. Sport has its own picker. */
const TIMERS: Array<{ type: TimerKind; label: string }> = [
  { type: 'STRENGTH', label: 'Strength' },
  { type: 'CARDIO', label: 'Cardio' },
  { type: 'MOBILITY', label: 'Mobility' }
];

let nextId = 0;

/**
 * The body of the Today card on a habit day: the person usually trains one kind today, and the
 * plan does not schedule it. It offers that session first and, behind one quiet button, three other
 * ways to begin. Starts that are not a plan day go through the live service, which owns the
 * single-workout dialog, and the card tells its parent which session began.
 */
@Component({
  selector: 'app-habit-day-start',
  templateUrl: './habit-day-start.component.html',
  styleUrl: './habit-day-start.component.scss'
})
export class HabitDayStartComponent {
  private readonly live = inject(WorkoutLiveService);
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  // The coach is reached only when asked, so a card that never asks does not build it.
  private readonly injector = inject(Injector);

  readonly today = input.required<TodayInsight>();
  readonly activePlan = input<WorkoutPlan | null>(null);
  /** A plan start is under way, so the plan's Start buttons wait. */
  readonly planBusy = input(false);

  /** A session was started here; the page shows its exercise screen. */
  readonly started = output<WorkoutSessionDetail>();
  /** A plan day was chosen; the page starts it the way every plan start goes. */
  readonly startPlanDay = output<string | null>();

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly sportPickerOpen = signal(false);
  readonly sports = signal<SportActivityOption[]>([]);
  readonly sportsFailed = signal(false);
  readonly sportCode = signal('');

  readonly timers = TIMERS;
  readonly panelId = `habit-choices-${nextId++}`;
  readonly sportSelectId = `${this.panelId}-sport`;

  readonly last = computed<LastOfKind | null>(() => this.today().lastOfKind);
  readonly sessionId = computed(() => this.last()?.sessionId ?? null);

  /** "Same as last Thursday, 24 Sept", only when there is an earlier session to repeat. */
  readonly sourceLine = computed(() => {
    const last = this.last();
    if (!last?.sessionId) {
      return '';
    }
    const day = this.dayLabel(last.date);
    return day ? `Same as last ${day}` : '';
  });

  readonly facts = computed(() => {
    const last = this.last();
    const suffix = this.sourceLine() ? '' : ' last time';
    return [formatDuration(last?.minutes), formatKm(last?.distanceKm)]
      .filter(Boolean)
      .map((fact) => `${fact}${suffix}`);
  });

  readonly names = computed(() => this.last()?.exerciseNames ?? []);

  readonly kindWord = computed(() => {
    const today = this.today();
    return (today.kind === 'SPORT' ? today.label : today.kind).toLowerCase();
  });

  readonly question = computed(() => `Plan a ${this.kindWord()} session for today`);

  readonly planChoices = computed<PlanChoice[]>(() => {
    const plan = this.activePlan();
    if (!plan?.planId) {
      return [];
    }
    if (!plan.days?.length) {
      return [{ planDayId: null, title: plan.name, detail: formatDuration(plan.estimatedDurationMinutes) }];
    }
    return [...plan.days]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => ({
        planDayId: day.planDayId,
        title: this.dayTitle(day),
        detail: [WEEKDAYS[day.dayOfWeek - 1], formatDuration(day.estimatedDurationMinutes)].filter(Boolean).join(' · ')
      }));
  });

  startThis(): void {
    const sessionId = this.sessionId();
    if (sessionId) {
      this.run(this.live.repeatSession(sessionId), 'Unable to repeat that session. Please retry.');
      return;
    }
    const today = this.today();
    if (today.kind === 'SPORT') {
      // A sport session needs the sport, and the insight names it only by its label.
      this.open.set(true);
      this.openSportPicker(today.label);
      return;
    }
    const timer = TIMERS.find((entry) => entry.type === today.kind);
    this.startTimer(timer?.type ?? 'STRENGTH');
  }

  toggle(): void {
    this.open.update((open) => !open);
  }

  startTimer(type: TimerKind): void {
    const label = TIMERS.find((entry) => entry.type === type)?.label ?? 'Workout';
    this.run(this.live.startAdHoc({ name: label, workoutType: type }), 'Unable to start a workout. Please retry.');
  }

  openSportPicker(preselectLabel = ''): void {
    this.sportPickerOpen.set(true);
    this.loadSports(preselectLabel);
  }

  chooseSport(code: string): void {
    this.sportCode.set(code);
  }

  startSport(): void {
    const sport = this.sports().find((entry) => entry.code === this.sportCode());
    if (!sport) {
      return;
    }
    this.run(
      this.live.startAdHoc({ name: sport.label, workoutType: 'SPORTS', sportActivity: sport.code }),
      'Unable to start a workout. Please retry.'
    );
  }

  startPlan(choice: PlanChoice): void {
    if (!this.planBusy()) {
      this.startPlanDay.emit(choice.planDayId);
    }
  }

  askCoach(): void {
    const coach = this.injector.get(CoachStore);
    coach.open();
    coach.ask(this.question());
  }

  private run(start$: Observable<WorkoutSessionDetail>, failure: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    start$.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (session) => {
        this.toast.success('Workout started.');
        this.started.emit(session);
      },
      error: () => this.toast.error(failure)
    });
  }

  private loadSports(preselectLabel: string): void {
    const preselect = (sports: SportActivityOption[]) => {
      const wanted = preselectLabel.trim().toLowerCase();
      const match = wanted ? sports.find((sport) => sport.label.toLowerCase() === wanted) : undefined;
      if (match && !this.sportCode()) {
        this.sportCode.set(match.code);
      }
    };
    if (this.sports().length) {
      preselect(this.sports());
      return;
    }
    this.sportsFailed.set(false);
    this.dataService.getExerciseMetadata().subscribe((metadata) => {
      const sports = metadata?.sportActivities ?? [];
      this.sports.set(sports);
      this.sportsFailed.set(sports.length === 0);
      preselect(sports);
    });
  }

  private dayTitle(day: WorkoutPlanDay): string {
    return day.title || day.sportLabel || day.kind.charAt(0) + day.kind.slice(1).toLowerCase();
  }

  /** "Thursday, 24 Sept" for a YYYY-MM-DD key, read as plain date parts so no timezone shifts it. */
  private dayLabel(value: string): string {
    const dateKey = value.slice(0, 10);
    const weekday = isoWeekdayOfDateKey(dateKey);
    const [, month, day] = dateKey.split('-').map(Number);
    if (!weekday || !Number.isFinite(month) || !Number.isFinite(day) || !MONTHS[month - 1]) {
      return '';
    }
    return `${WEEKDAYS[weekday - 1]}, ${day} ${MONTHS[month - 1]}`;
  }
}
