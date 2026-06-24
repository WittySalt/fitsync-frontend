import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { NutritionSummary } from '../../core/fitsync.models';
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
  // Today's nutrition comes from the timezone-aware daily summary, not the
  // analytics dashboard snapshot (whose "today" is a server/UTC-day boundary).
  readonly nutritionSummary = signal<NutritionSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly today = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  readonly caloriePercent = computed(() => {
    const nutrition = this.nutritionSummary();
    return nutrition?.targetCalories ? (nutrition.totalCalories / nutrition.targetCalories) * 100 : 0;
  });

  readonly proteinPercent = computed(() => {
    const nutrition = this.nutritionSummary();
    return nutrition?.targetProteinGrams ? (nutrition.totalProteinGrams / nutrition.targetProteinGrams) * 100 : 0;
  });

  readonly hasCalorieData = computed(() => {
    const nutrition = this.nutritionSummary();
    return Boolean(nutrition && (nutrition.totalCalories > 0 || nutrition.targetCalories != null));
  });

  readonly hasProteinData = computed(() => {
    const nutrition = this.nutritionSummary();
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
        this.data.set(data);
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
}
