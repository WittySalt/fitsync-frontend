import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, dedupeGoalsByLatestEvaluation, FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal, NutritionSummary, WorkoutSession } from '../../core/fitsync.models';
import { ActivityHeatmapComponent } from '../progress/activity-heatmap.component';
import { ProgressRingComponent } from '../../shared/progress-ring.component';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { caloriesLabel, sessionDurationLabel } from '../workout/workout-session.util';
import { CoachBriefComponent } from './brief/coach-brief.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [CoachBriefComponent, ActivityHeatmapComponent, ProgressRingComponent, RouterLink, StatePanelComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly data = signal<DashboardData | null>(null);
  // Today's nutrition comes from the timezone-aware daily summary, not the
  // analytics dashboard snapshot (whose "today" is a server/UTC-day boundary).
  readonly nutritionSummary = signal<NutritionSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly caloriePercent = computed(() => {
    const nutrition = this.nutritionSummary();
    return nutrition?.targetCalories ? (nutrition.totalCalories / nutrition.targetCalories) * 100 : 0;
  });

  readonly hasCalorieData = computed(() => {
    const nutrition = this.nutritionSummary();
    return Boolean(nutrition && (nutrition.totalCalories > 0 || nutrition.targetCalories != null));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getDashboard().subscribe({
      next: (data) => {
        this.data.set(this.withDisplayDates(data));
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });

    this.dataService.getDailyNutritionSummary().subscribe({
      next: (summary) => this.nutritionSummary.set(summary),
      error: () => undefined
    });
  }

  goalProgress(progressRatio: number): number {
    return Math.round(Math.min(Math.max(progressRatio, 0), 1) * 100);
  }

  hasCompletedWorkout(workout: WorkoutSession | null): boolean {
    return Boolean(workout?.status === 'COMPLETED' && (workout.exerciseCount > 0 || (workout.durationMinutes ?? 0) > 0));
  }

  workoutDurationLabel(workout: WorkoutSession): string {
    return sessionDurationLabel(workout);
  }

  workoutCaloriesLabel(workout: WorkoutSession): string {
    return workout.caloriesBurned == null ? 'Not recorded' : caloriesLabel(workout.caloriesBurned);
  }

  metricDateLabel(value: string | null | undefined): string {
    return this.humanDate(value);
  }

  goalLabel(goal: Goal): string {
    return goal.goalType
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  goalAmountLabel(goal: Goal): string {
    if (goal.targetValue <= 0) {
      return 'No target set';
    }

    const targetValue = this.formatGoalNumber(goal.targetValue);
    const unit = (goal.targetUnit || this.defaultGoalUnit(goal.goalType)).trim();
    return `${targetValue}${unit ? ` ${unit}` : ''}`;
  }

  goalDateLabel(goal: Goal): string {
    if (!goal.targetDate) {
      return 'No target date';
    }
    // "by 31 Aug 2026" reads as a live deadline. Once it has passed, say so.
    const prefix = goal.expired ? 'was due' : 'by';
    return `${prefix} ${this.formatTargetDate(goal.targetDate)}`;
  }

  private humanDate(value: string | null | undefined, timezone?: string | null): string {
    if (!value) {
      return '';
    }

    // Only an ISO date or instant is accepted. The previous NaN guard was not enough: a value that
    // had already been formatted, such as "5 Jul", parses successfully under V8's legacy parser and
    // silently lands in the year 2001. Anything that is not an instant is handed back untouched, so
    // a stray display string shows as itself rather than as a date 25 years out.
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.includes('T') ? 'Recently' : value;
    }

    const resolvedTimezone = timezone || this.data()?.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayKey = this.dateKey(new Date(), resolvedTimezone);
    const valueKey = this.dateKey(date, resolvedTimezone);
    const dayDifference = this.daysBetween(valueKey, todayKey);

    if (dayDifference === 0) {
      return 'Today';
    }
    if (dayDifference === 1) {
      return 'Yesterday';
    }
    if (dayDifference > 1 && dayDifference < 7) {
      return `${dayDifference} days ago`;
    }

    return new Intl.DateTimeFormat('en-SG', {
      day: 'numeric',
      month: 'short',
      timeZone: resolvedTimezone,
      ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {})
    }).format(date);
  }

  private dateKey(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }

  private daysBetween(fromKey: string, toKey: string): number {
    const from = Date.parse(`${fromKey}T00:00:00Z`);
    const to = Date.parse(`${toKey}T00:00:00Z`);
    return Math.round((to - from) / 86_400_000);
  }

  private formatGoalNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', { maximumFractionDigits: 1 }).format(value);
  }

  private formatTargetDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  private defaultGoalUnit(goalType: string): string {
    switch (goalType) {
      case 'CALORIES':
        return 'kcal';
      case 'PROTEIN':
      case 'CARBS':
      case 'FAT':
        return 'g';
      case 'WEIGHT':
        return 'kg';
      case 'WORKOUT_FREQUENCY':
        return 'workouts/week';
      default:
        return '';
    }
  }

  /**
   * Formatting happens at render time only.
   *
   * <p>This method used to overwrite `consumedAt` and `measuredAt` with their display labels, so a
   * field typed as a timestamp held a string like "5 Jul". The template then formatted it a second
   * time, and `new Date("5 Jul")` parses to the year 2001 under V8's legacy parser, so the card
   * read "5 Jul 2001" for a measurement taken in 2026. Leaving the model alone removes the whole
   * class of bug rather than patching one caller.
   */
  private withDisplayDates(data: DashboardData): DashboardData {
    return {
      ...data,
      goals: dedupeGoalsByLatestEvaluation(data.goals)
    };
  }

  mealDateLabel(value: string | null | undefined): string {
    return this.humanDate(value);
  }

  goalStatusLabel(goal: Goal): string {
    if (goal.expired) {
      return 'Overdue';
    }
    return goal.onTrack === false ? 'Needs attention' : 'On track';
  }

  /**
   * Built here rather than in the template so the separators cannot pick up stray whitespace when
   * a part is omitted. An overdue goal drops the completion percentage: claiming progress against
   * a deadline that has passed is the thing being fixed.
   */
  goalSummaryLabel(goal: Goal): string {
    const parts = [this.goalStatusLabel(goal)];
    if (!goal.expired) {
      parts.push(`${this.goalProgress(goal.progressRatio)}% complete`);
    }
    parts.push(this.goalDateLabel(goal));
    return parts.join(' · ');
  }
}
