import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { dedupeGoalsByLatestEvaluation, FitSyncDataService, HomeDashboardData } from '../../core/fitsync-data.service';
import { NutritionSummary } from '../../core/fitsync.models';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { CoachBriefComponent } from './brief/coach-brief.component';
import { GuideCardComponent } from './guide/guide-card.component';
import { EarnedComponent } from './earned/earned.component';
import { TodayCardComponent } from './today/today-card.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [CoachBriefComponent, EarnedComponent, GuideCardComponent, RouterLink, StatePanelComponent, TodayCardComponent],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly userTimezone = inject(UserTimezoneService);

  readonly data = signal<HomeDashboardData | null>(null);
  // Today's nutrition comes from the daily summary, asked for the day the profile's zone is in,
  // and not from the analytics dashboard snapshot, whose "today" is a server day boundary.
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

    this.dataService.getHomeDashboard().subscribe({
      next: (data) => {
        this.data.set({ ...data, goals: dedupeGoalsByLatestEvaluation(data.goals) });
        this.loading.set(false);
        // The profile's zone is known only now, and the day of the summary depends on it.
        this.loadNutrition();
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });
  }

  loadNutrition(): void {
    if (!this.data()) {
      return;
    }
    this.nutritionFailed.set(false);
    // A failure is shown as a failure, never as a day on which nothing was eaten.
    this.dataService.loadDailyNutritionSummary(this.userTimezone.dateKey()).subscribe({
      next: (summary) => this.nutritionSummary.set(summary),
      error: () => this.nutritionFailed.set(true)
    });
  }
}
