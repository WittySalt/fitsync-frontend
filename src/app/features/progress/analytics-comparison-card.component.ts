import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsComparePeriod,
  AnalyticsMetricComparison,
  AnalyticsSummaryCompareResponse
} from '../../core/analytics.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface PeriodOption {
  label: string;
  value: AnalyticsComparePeriod;
}

interface ComparisonRow {
  label: string;
  metric: AnalyticsMetricComparison;
  unit: string;
}

interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

@Component({
  selector: 'app-analytics-comparison-card',
  imports: [StatePanelComponent],
  templateUrl: './analytics-comparison-card.component.html',
  styleUrl: './analytics-comparison-card.component.scss'
})
export class AnalyticsComparisonCardComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly periodOptions: PeriodOption[] = [
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' }
  ];

  readonly selectedPeriod = signal<AnalyticsComparePeriod>('WEEK');
  readonly data = signal<AnalyticsSummaryCompareResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly comparisonGroups = computed<ComparisonGroup[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    return [
      {
        title: 'Workout',
        rows: [
          { label: 'Completed workouts', metric: data.workout.completedWorkoutCount, unit: '' },
          { label: 'Workout minutes', metric: data.workout.totalWorkoutMinutes, unit: 'min' },
          { label: 'Calories burned', metric: data.workout.totalCaloriesBurned, unit: 'kcal' },
          { label: 'Exercises completed', metric: data.workout.totalExerciseCount, unit: '' }
        ]
      },
      {
        title: 'Nutrition',
        rows: [
          { label: 'Calories consumed', metric: data.nutrition.totalCaloriesConsumed, unit: 'kcal' },
          { label: 'Protein', metric: data.nutrition.totalProteinGrams, unit: 'g' },
          { label: 'Carbs', metric: data.nutrition.totalCarbsGrams, unit: 'g' },
          { label: 'Fat', metric: data.nutrition.totalFatGrams, unit: 'g' }
        ]
      }
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsApi.getSummaryCompare(this.selectedPeriod()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to compare this period with the previous one. Please retry.');
        this.loading.set(false);
      }
    });
  }

  selectPeriod(period: AnalyticsComparePeriod): void {
    if (this.selectedPeriod() === period) {
      return;
    }
    this.selectedPeriod.set(period);
    this.load();
  }

  windowLabel(window: { from: string; to: string } | null | undefined): string {
    if (!window) {
      return 'n/a';
    }
    return `${window.from} to ${window.to}`;
  }

  formatValue(value: number | null, unit: string): string {
    if (value == null) {
      return 'n/a';
    }
    const suffix = unit ? ` ${unit}` : '';
    return `${this.formatNumber(value)}${suffix}`;
  }

  deltaPctLabel(metric: AnalyticsMetricComparison): string {
    if (metric.deltaPct == null) {
      return 'n/a';
    }

    if (metric.deltaPct === 0) {
      return '0%';
    }

    const arrow = metric.deltaPct > 0 ? '↑' : '↓';
    const sign = metric.deltaPct > 0 ? '+' : '';
    return `${arrow} ${sign}${this.formatNumber(metric.deltaPct)}%`;
  }

  deltaClass(metric: AnalyticsMetricComparison): string {
    if (metric.deltaPct == null || metric.deltaPct === 0) {
      return 'neutral';
    }
    return metric.deltaPct > 0 ? 'positive' : 'negative';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', {
      maximumFractionDigits: 1
    }).format(value);
  }
}
