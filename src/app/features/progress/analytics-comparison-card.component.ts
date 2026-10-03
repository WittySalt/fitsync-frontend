import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsComparePeriod,
  AnalyticsMetricComparison,
  AnalyticsSummaryCompareResponse
} from '../../core/analytics.models';
import { dateRangeLabel } from '../../shared/date-label';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface PeriodOption {
  label: string;
  value: AnalyticsComparePeriod;
}

interface ComparisonRow {
  label: string;
  metric: AnalyticsMetricComparison;
  unit: string;
  /** A count of days has a difference that is not a percentage worth stating. */
  showChange: boolean;
}

interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

/** What each window is called. Both windows cover the same number of days, so the card says so. */
const WINDOW_NAMES: Record<AnalyticsComparePeriod, { current: string; previous: string }> = {
  WEEK: { current: 'This week so far', previous: 'Last week, same days' },
  MONTH: { current: 'This month so far', previous: 'Last month, same days' }
};

@Component({
  selector: 'app-analytics-comparison-card',
  imports: [StatePanelComponent],
  templateUrl: './analytics-comparison-card.component.html',
  styleUrl: './analytics-comparison-card.component.scss'
})
export class AnalyticsComparisonCardComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  /** The zone that decides which day is today, from the profile. */
  readonly timezone = input<string | null>(null);

  readonly periodOptions: PeriodOption[] = [
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' }
  ];

  readonly selectedPeriod = signal<AnalyticsComparePeriod>('WEEK');
  readonly data = signal<AnalyticsSummaryCompareResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly windowNames = computed(() => WINDOW_NAMES[this.data()?.period ?? this.selectedPeriod()]);

  readonly comparisonGroups = computed<ComparisonGroup[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    // Food is compared by what a logged day held, so a week with fewer logged days is not read as
    // eating less. An answer without those figures falls back to the totals.
    const nutrition = data.nutrition;
    const perDay = (metric: AnalyticsMetricComparison): { metric: AnalyticsMetricComparison; suffix: string } =>
      metric.averagePerLoggedDay ? { metric: metric.averagePerLoggedDay, suffix: ', a logged day' } : { metric, suffix: '' };
    const food = (label: string, metric: AnalyticsMetricComparison, unit: string): ComparisonRow => {
      const chosen = perDay(metric);
      return { label: `${label}${chosen.suffix}`, metric: chosen.metric, unit, showChange: true };
    };
    const nutritionRows = [
      food('Calories consumed', nutrition.totalCaloriesConsumed, 'kcal'),
      food('Protein', nutrition.totalProteinGrams, 'g'),
      food('Carbs', nutrition.totalCarbsGrams, 'g'),
      food('Fat', nutrition.totalFatGrams, 'g')
    ];
    if (nutrition.daysLogged) {
      nutritionRows.push({ label: 'Days logged', metric: nutrition.daysLogged, unit: 'days', showChange: false });
    }

    return [
      {
        title: 'Workout',
        rows: [
          { label: 'Completed workouts', metric: data.workout.completedWorkoutCount, unit: '', showChange: true },
          { label: 'Workout minutes', metric: data.workout.totalWorkoutMinutes, unit: 'min', showChange: true },
          { label: 'Calories burned', metric: data.workout.totalCaloriesBurned, unit: 'kcal', showChange: true },
          { label: 'Exercises completed', metric: data.workout.totalExerciseCount, unit: '', showChange: true }
        ]
      },
      { title: 'Nutrition', rows: nutritionRows }
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsApi.getSummaryCompare(this.selectedPeriod(), this.timezone()).subscribe({
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
    return window ? dateRangeLabel(window.from, window.to) || 'n/a' : 'n/a';
  }

  formatValue(value: number | null, unit: string): string {
    if (value == null) {
      return 'n/a';
    }
    const suffix = unit ? ` ${unit}` : '';
    return `${this.formatNumber(value)}${suffix}`;
  }

  /** The change in words, so it reads without colour: "Up 12%", "Down 8%", "No change". */
  deltaPctLabel(metric: AnalyticsMetricComparison): string {
    if (metric.deltaPct == null) {
      return 'n/a';
    }
    if (metric.deltaPct === 0) {
      return 'No change';
    }
    return `${metric.deltaPct > 0 ? 'Up' : 'Down'} ${this.formatNumber(Math.abs(metric.deltaPct))}%`;
  }

  /** Green for more and the neutral tone for less or none. A fall is not an error, so it is never red. */
  deltaClass(metric: AnalyticsMetricComparison): string {
    return metric.deltaPct != null && metric.deltaPct > 0 ? 'positive' : 'neutral';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', {
      maximumFractionDigits: 1
    }).format(value);
  }
}
