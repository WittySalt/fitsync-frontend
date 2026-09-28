import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { WorkoutPlan, WorkoutSession } from '../../../core/fitsync.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { briefHeadline, quickQuestions } from './brief-copy';
import { formatDuration } from './brief-duration';
import { BRIEF_NOW, DayPeriod, clockLabel, dateLabel, dayPeriodFor, periodLabel } from './brief-time';
import { BriefDay, buildWeek, completedSessionCount, weekRange } from './brief-week';

/** WORKOUT_FREQUENCY goals track a weekly session count; other goal types don't apply here. */
const WORKOUT_FREQUENCY_GOAL_TYPE = 'WORKOUT_FREQUENCY';

@Component({
  selector: 'app-coach-brief',
  standalone: true,
  imports: [FormsModule, RouterLink, StatePanelComponent],
  templateUrl: './coach-brief.component.html',
  styleUrl: './coach-brief.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachBriefComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly coachStore = inject(CoachStore);
  private readonly router = inject(Router);
  private readonly now = inject(BRIEF_NOW);

  // Signal inputs, so the copy follows a value that arrives after the first render. The calorie
  // target does exactly that, because the page loads the nutrition summary on its own request.
  readonly firstName = input.required<string>();
  readonly timezone = input.required<string>();
  readonly caloriesTarget = input<number | null>(null);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly week = signal<BriefDay[]>([]);
  readonly weeklyTarget = signal<number | null>(null);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly completed = signal(0);

  readonly starting = signal(false);
  readonly startError = signal<string | null>(null);

  readonly period = computed<DayPeriod>(() => dayPeriodFor(this.now(), this.timezone()));
  readonly periodLabelText = computed(() => periodLabel(this.period()));
  readonly clockText = computed(() => clockLabel(this.now(), this.timezone()));
  readonly dateText = computed(() => dateLabel(this.now(), this.timezone()));

  readonly headline = computed(() =>
    briefHeadline({
      period: this.period(),
      firstName: this.firstName(),
      completed: this.completed(),
      target: this.weeklyTarget(),
      daysLeftInWeek: this.daysLeftInWeek()
    })
  );

  readonly quickQuestionList = computed(() => quickQuestions(this.period(), this.caloriesTarget()));

  readonly weekAriaLabel = computed(() => {
    const days = this.week();
    if (!days.length) {
      return 'This week.';
    }
    // Days that have not happened yet are left out, because calling them rest would be untrue.
    const parts = days.filter((day) => day.state !== 'upcoming').map((day) => this.dayAriaFragment(day));
    return `This week. ${parts.join(', ')}.`;
  });

  readonly targetMet = computed(() => {
    const target = this.weeklyTarget();
    return target != null && target > 0 && this.completed() >= target;
  });

  readonly showNextSession = computed(() => this.activePlan() !== null && this.period() !== 'NIGHT');

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
        this.week.set(buildWeek(sessions, now, this.timezone()));
        this.completed.set(completedSessionCount(sessions, now, this.timezone()));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
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
        return 'open';
      case 'rest':
        return 'rest';
      default:
        // An upcoming day has no caption. The stylesheet keeps the line's height.
        return '';
    }
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
    if (day.state === 'today-open') {
      return `today open`;
    }
    if (day.state === 'today-trained') {
      return `today ${day.kind} ${formatDuration(day.minutes)}`;
    }
    if (day.state === 'trained') {
      return `${day.weekday} ${day.kind} ${formatDuration(day.minutes)}`;
    }
    return `${day.weekday} rest`;
  }
}
