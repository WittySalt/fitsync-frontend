import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
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
  }
}
