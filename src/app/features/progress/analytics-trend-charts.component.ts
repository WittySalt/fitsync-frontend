import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsBucket,
  AnalyticsNutritionSeriesResponse,
  AnalyticsWorkoutSeriesResponse
} from '../../core/analytics.models';
import { dateRangeLabel, shortDateLabel } from '../../shared/date-label';
import { FsChartComponent, FsChartSeries } from '../../shared/fs-chart.component';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { DateRange } from './progress-range';

interface BucketOption {
  label: string;
  value: AnalyticsBucket;
}

interface AnalyticsTrendSeriesData {
  workout: AnalyticsWorkoutSeriesResponse;
  nutrition: AnalyticsNutritionSeriesResponse;
}

type WorkoutPoint = AnalyticsWorkoutSeriesResponse['points'][number];

@Component({
  selector: 'app-analytics-trend-charts',
  imports: [FsChartComponent, StatePanelComponent],
  templateUrl: './analytics-trend-charts.component.html',
  styleUrl: './analytics-trend-charts.component.scss'
})
export class AnalyticsTrendChartsComponent {
  private readonly analyticsApi = inject(AnalyticsApiService);

  /** The days to draw, from the page's range control. A new range loads the charts again. */
  readonly range = input.required<DateRange>();

  readonly bucketOptions: BucketOption[] = [
    { label: 'Day', value: 'DAY' },
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' }
  ];

  readonly data = signal<AnalyticsTrendSeriesData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedBucket = signal<AnalyticsBucket>('WEEK');

  readonly rangeText = computed(() => dateRangeLabel(this.range().from, this.range().to));

  readonly seriesDates = computed(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    return Array.from(
      new Set([...data.workout.points.map((point) => point.date), ...data.nutrition.points.map((point) => point.date)])
    ).sort((first, second) => first.localeCompare(second));
  });

  // A date key is read as a calendar day. The old label went through new Date(), which reads it as
  // UTC and showed the day before in a zone west of Greenwich.
  readonly chartLabels = computed(() => this.seriesDates().map((date) => shortDateLabel(date)));

  // Sessions, minutes and calories burned sit on very different scales, so each has its own small
  // chart. Sessions are a handful a week and were invisible on a shared axis.
  readonly sessionsSeries = computed<FsChartSeries[]>(() => [
    { label: 'Sessions', values: this.workoutValues((point) => point.completedWorkoutCount), colorToken: '--accent' }
  ]);

  readonly minutesSeries = computed<FsChartSeries[]>(() => [
    { label: 'Minutes', values: this.workoutValues((point) => point.totalWorkoutMinutes), colorToken: '--blue-500' }
  ]);

  readonly caloriesBurnedSeries = computed<FsChartSeries[]>(() => [
    { label: 'Calories burned', values: this.workoutValues((point) => point.totalCaloriesBurned), colorToken: '--text-secondary' }
  ]);

  readonly nutritionSeries = computed<FsChartSeries[]>(() => {
    // Calories are not drawn here: the energy card above the charts covers them.
    const points = this.data()?.nutrition.points ?? [];
    return [
      {
        label: 'Protein',
        values: this.valuesForDates(points, (point) => point.totalProteinGrams),
        colorToken: '--blue-500'
      },
      {
        label: 'Carbs',
        values: this.valuesForDates(points, (point) => point.totalCarbsGrams),
        colorToken: '--text-primary'
      },
      {
        label: 'Fat',
        values: this.valuesForDates(points, (point) => point.totalFatGrams),
        colorToken: '--danger'
      }
    ];
  });

  readonly hasSeriesData = computed(() => {
    const data = this.data();
    return Boolean(data && (data.workout.points.length || data.nutrition.points.length));
  });

  constructor() {
    effect(() => {
      this.range();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const { from, to } = this.range();

    forkJoin({
      workout: this.analyticsApi.getWorkoutSeries(from, to, this.selectedBucket()),
      nutrition: this.analyticsApi.getNutritionSeries(from, to, this.selectedBucket())
    }).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workout and nutrition trends. Please retry.');
        this.loading.set(false);
      }
    });
  }

  selectBucket(bucket: AnalyticsBucket): void {
    if (this.selectedBucket() === bucket) {
      return;
    }
    this.selectedBucket.set(bucket);
    this.load();
  }

  private workoutValues(select: (point: WorkoutPoint) => number | null): Array<number | null> {
    return this.valuesForDates(this.data()?.workout.points ?? [], select);
  }

  private valuesForDates<T extends { date: string }>(
    points: T[],
    selectValue: (point: T) => number | null
  ): Array<number | null> {
    const byDate = new Map(points.map((point) => [point.date, selectValue(point)]));
    return this.seriesDates().map((date) => byDate.get(date) ?? null);
  }
}
