import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsWorkoutSummaryResponse } from '../../core/analytics.models';
import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal } from '../../core/fitsync.models';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { sessionDurationLabel } from '../workout/workout-session.util';
import { GoalLifecycleComponent } from './goal-lifecycle.component';

interface ActivityItem {
  icon: string;
  title: string;
  detail: string;
  when: string;
}

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, StatePanelComponent, GoalLifecycleComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
})
export class ProfilePage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly data = signal<DashboardData | null>(null);
  readonly workoutSummary = signal<AnalyticsWorkoutSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly initials = computed(() => {
    const name = this.data()?.profile.displayName?.trim();
    if (!name) {
      return 'FS';
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  });

  readonly age = computed(() => {
    const birthDate = this.data()?.profile.birthDate;
    if (!birthDate) {
      return null;
    }
    const born = new Date(birthDate);
    if (Number.isNaN(born.getTime())) {
      return null;
    }
    return Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 3600 * 1000));
  });

  readonly activeGoal = computed(() => {
    const goals = this.data()?.goals ?? [];
    return goals.find((goal) => goal.status === 'ACTIVE') ?? goals[0] ?? null;
  });

  readonly recentActivity = computed<ActivityItem[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const items: ActivityItem[] = [];
    if (this.isCompletedWorkout(data.latestWorkout)) {
      items.push({
        icon: 'dumbbell',
        title: data.latestWorkout.name,
        detail: `${this.label(data.latestWorkout.workoutType)} · ${sessionDurationLabel(data.latestWorkout)}`,
        when: data.latestWorkout.completedAt
      });
    }
    if (data.latestMeal) {
      items.push({
        icon: 'utensils',
        title: data.latestMeal.name,
        detail: `${this.label(data.latestMeal.mealType)} · ${data.latestMeal.totalCalories} kcal`,
        when: data.latestMeal.consumedAt
      });
    }
    if (data.latestBodyMetric) {
      items.push({
        icon: 'scale',
        title: `Weigh-in · ${data.latestBodyMetric.weightKg} kg`,
        detail: `BMI ${data.latestBodyMetric.bmi}`,
        when: data.latestBodyMetric.measuredAt ?? ''
      });
    }
    return items;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const range = this.trainingHistoryRange();

    forkJoin({
      dashboard: this.dataService.getDashboard(),
      workoutSummary: this.analyticsApi.getWorkoutSummary(range.from, range.to)
    }).subscribe({
      next: ({ dashboard, workoutSummary }) => {
        this.workoutSummary.set(workoutSummary);
        this.data.set(dashboard);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });
  }

  label(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  goalProgress(): number {
    const goal = this.activeGoal();
    return goal ? Math.round(Math.min(1, Math.max(0, goal.progressRatio)) * 100) : 0;
  }

  isCompletedWorkout(workout: DashboardData['latestWorkout']): workout is NonNullable<DashboardData['latestWorkout']> {
    return workout?.status === 'COMPLETED';
  }

  goalTargetLabel(goal: Goal): string {
    if (goal.targetValue <= 0) {
      return 'No target set';
    }
    const value = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 1 }).format(goal.targetValue);
    const unit = goal.targetUnit.trim();
    return `${value}${unit ? ` ${unit}` : ''}`;
  }

  goalTargetDateLabel(goal: Goal): string {
    return goal.targetDate ? `by ${this.formatDate(goal.targetDate, true)}` : 'No target date';
  }

  totalTrainingHours(summary: AnalyticsWorkoutSummaryResponse): string {
    return this.formatNumber(summary.totalWorkoutMinutes / 60, 1);
  }

  hasTrainingHistory(summary: AnalyticsWorkoutSummaryResponse | null): summary is AnalyticsWorkoutSummaryResponse {
    return Boolean(summary && (summary.totalWorkoutCount > 0 || summary.totalWorkoutMinutes > 0));
  }

  streakLabel(days: number): string {
    return `${this.formatNumber(days)} day${days === 1 ? '' : 's'}`;
  }

  formatDate(value: string | null | undefined, includeYear = false): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {})
    }).format(date);
  }

  private trainingHistoryRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 365);
    return {
      from: this.toDateParam(from),
      to: this.toDateParam(to)
    };
  }

  private toDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatNumber(value: number, maximumFractionDigits = 0): string {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return new Intl.NumberFormat('en-SG', { maximumFractionDigits }).format(value);
  }
}
