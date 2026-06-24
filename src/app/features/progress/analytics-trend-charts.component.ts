import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsBucket,
  AnalyticsNutritionSeriesResponse,
  AnalyticsWorkoutSeriesResponse
} from '../../core/analytics.models';
import { FsChartComponent, FsChartSeries } from '../../shared/fs-chart.component';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface RangePreset {
  label: string;
  days: number;
}

interface BucketOption {
  label: string;
  value: AnalyticsBucket;
}

interface AnalyticsTrendSeriesData {
  workout: AnalyticsWorkoutSeriesResponse;
  nutrition: AnalyticsNutritionSeriesResponse;
}

@Component({
  selector: 'app-analytics-trend-charts',
  imports: [FsChartComponent, StatePanelComponent],
  templateUrl: './analytics-trend-charts.component.html',
  styleUrl: './analytics-trend-charts.component.scss'
})
export class AnalyticsTrendChartsComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly rangePresets: RangePreset[] = [
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '1Y', days: 365 }
  ];

  readonly bucketOptions: BucketOption[] = [
    { label: 'Day', value: 'DAY' },
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' }
  ];

  readonly data = signal<AnalyticsTrendSeriesData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedBucket = signal<AnalyticsBucket>('WEEK');
  readonly startDate = signal(this.isoDaysAgo(90));
  readonly endDate = signal(this.isoToday());

  readonly seriesDates = computed(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    return Array.from(
      new Set([...data.workout.points.map((point) => point.date), ...data.nutrition.points.map((point) => point.date)])
    ).sort((first, second) => first.localeCompare(second));
  });

  readonly chartLabels = computed(() => this.seriesDates().map((date) => this.shortDate(date)));

  readonly workoutSeries = computed<FsChartSeries[]>(() => {
    const points = this.data()?.workout.points ?? [];
    return [
      {
        label: 'Workouts',
        values: this.valuesForDates(points, (point) => point.completedWorkoutCount),
        colorToken: '--accent'
      },
      {
        label: 'Minutes',
        values: this.valuesForDates(points, (point) => point.totalWorkoutMinutes),
        colorToken: '--blue-500'
      },
      {
        label: 'Calories burned',
        values: this.valuesForDates(points, (point) => point.totalCaloriesBurned),
        colorToken: '--danger'
      }
    ];
  });

  readonly nutritionSeries = computed<FsChartSeries[]>(() => {
    const points = this.data()?.nutrition.points ?? [];
    return [
      {
        label: 'Calories',
        values: this.valuesForDates(points, (point) => point.totalCaloriesConsumed),
        colorToken: '--accent'
      },
      {
        label: 'Calorie target',
        values: this.valuesForDates(points, (point) => point.calorieTarget),
        colorToken: '--text-secondary'
      },
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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      workout: this.analyticsApi.getWorkoutSeries(this.startDate(), this.endDate(), this.selectedBucket()),
      nutrition: this.analyticsApi.getNutritionSeries(this.startDate(), this.endDate(), this.selectedBucket())
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

  setPreset(days: number): void {
    this.startDate.set(this.isoDaysAgo(days));
    this.endDate.set(this.isoToday());
    this.load();
  }

  updateStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  updateEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
  }

  shortDate(value: string): string {
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private valuesForDates<T extends { date: string }>(
    points: T[],
    selectValue: (point: T) => number | null
  ): Array<number | null> {
    const byDate = new Map(points.map((point) => [point.date, selectValue(point)]));
    return this.seriesDates().map((date) => byDate.get(date) ?? null);
  }

  private isoToday(): string {
    return this.localIso(new Date());
  }

  private isoDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.localIso(date);
  }

  // Local calendar date (not UTC) so the series window matches the user's day.
  private localIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
