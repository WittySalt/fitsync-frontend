import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, dedupeGoalsByLatestEvaluation, FitSyncDataService } from '../../core/fitsync-data.service';
import { NutritionSummary, WorkoutSession } from '../../core/fitsync.models';
import { ActivityHeatmapComponent } from '../progress/activity-heatmap.component';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { caloriesLabel, sessionDurationLabel } from '../workout/workout-session.util';
import { CoachBriefComponent } from './brief/coach-brief.component';
import { TodayCardComponent } from './today/today-card.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [CoachBriefComponent, ActivityHeatmapComponent, RouterLink, StatePanelComponent, TodayCardComponent],
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
  readonly nutritionFailed = signal(false);

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

    this.loadNutrition();
  }

  loadNutrition(): void {
    this.nutritionFailed.set(false);
    this.dataService.getDailyNutritionSummary().subscribe({
      next: (summary) => this.nutritionSummary.set(summary),
      error: () => this.nutritionFailed.set(true)
    });
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
}
