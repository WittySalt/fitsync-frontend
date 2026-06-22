import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal } from '../../core/fitsync.models';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ActivityHeatmapComponent } from './activity-heatmap.component';
import { AnalyticsComparisonCardComponent } from './analytics-comparison-card.component';
import { AnalyticsTrendChartsComponent } from './analytics-trend-charts.component';

@Component({
  selector: 'app-progress-page',
  imports: [
    ActivityHeatmapComponent,
    AnalyticsComparisonCardComponent,
    AnalyticsTrendChartsComponent,
    StatePanelComponent
  ],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss'
})
export class ProgressPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly hasGoals = computed(() => this.goals().length > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getProgressGoals().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });
  }

  goalProgress(goal: Goal): number {
    return Math.round(Math.min(Math.max(goal.progressRatio, 0), 1) * 100);
  }

  goalLabel(goal: Goal): string {
    return goal.goalType
      .toLowerCase()
      .split('_')
      .map((part: string) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  goalStatus(goal: Goal): string {
    const status = goal.onTrack === false ? 'Needs attention' : 'On track';
    return goal.daysRemaining == null ? status : `${status} - ${goal.daysRemaining} days left`;
  }

  formatGoalValue(goal: Goal): string {
    const suffix = goal.targetUnit ? ` ${goal.targetUnit}` : '';
    return `${this.formatNumber(goal.targetValue)}${suffix}`;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', {
      maximumFractionDigits: 1
    }).format(value);
  }
}
