import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, dedupeGoalsByLatestEvaluation, FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal, WorkoutSession } from '../../core/fitsync.models';
import { ProgressRingComponent } from '../../shared/progress-ring.component';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [ProgressRingComponent, RouterLink, StatePanelComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly today = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  readonly caloriePercent = computed(() => {
    const nutrition = this.data()?.nutrition;
    return nutrition?.targetCalories ? (nutrition.totalCalories / nutrition.targetCalories) * 100 : 0;
  });

  readonly proteinPercent = computed(() => {
    const nutrition = this.data()?.nutrition;
    return nutrition?.targetProteinGrams ? (nutrition.totalProteinGrams / nutrition.targetProteinGrams) * 100 : 0;
  });

  readonly hasCalorieData = computed(() => {
    const nutrition = this.data()?.nutrition;
    return Boolean(nutrition && (nutrition.totalCalories > 0 || nutrition.targetCalories != null));
  });

  readonly hasProteinData = computed(() => {
    const nutrition = this.data()?.nutrition;
    return Boolean(nutrition && (nutrition.totalProteinGrams > 0 || nutrition.targetProteinGrams != null));
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
  }

  goalProgress(progressRatio: number): number {
    return Math.round(Math.min(Math.max(progressRatio, 0), 1) * 100);
  }

  hasCompletedWorkout(workout: WorkoutSession | null): boolean {
    return Boolean(workout && (workout.exerciseCount > 0 || workout.durationMinutes > 0));
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
    if (goal.currentValue == null && goal.targetValue <= 0) {
      return 'No target set';
    }

    const currentValue = this.formatGoalNumber(goal.currentValue ?? 0);
    const targetValue = goal.targetValue > 0 ? this.formatGoalNumber(goal.targetValue) : 'No target';
    const unit = (goal.targetUnit || this.defaultGoalUnit(goal.goalType)).trim();
    return `${currentValue} / ${targetValue}${unit ? ` ${unit}` : ''}`;
  }

  private humanDate(value: string | null | undefined, timezone?: string | null): string {
    if (!value) {
      return '';
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

  private withDisplayDates(data: DashboardData): DashboardData {
    const timezone = data.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      ...data,
      latestMeal: data.latestMeal
        ? {
            ...data.latestMeal,
            consumedAt: this.humanDate(data.latestMeal.consumedAt, timezone)
          }
        : null,
      latestBodyMetric: data.latestBodyMetric
        ? {
            ...data.latestBodyMetric,
            measuredAt: this.humanDate(data.latestBodyMetric.measuredAt, timezone)
          }
        : null,
      goals: dedupeGoalsByLatestEvaluation(data.goals)
    };
  }
}
