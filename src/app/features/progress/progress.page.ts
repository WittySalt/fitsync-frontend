import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  FitSyncDataService,
  ProgressBodyMetric,
  ProgressData,
  ProgressMetricKey
} from '../../core/fitsync-data.service';
import { AnalyticsBucket } from '../../core/analytics.models';
import { Goal } from '../../core/fitsync.models';
import { FsChartComponent, FsChartSeries } from '../../shared/fs-chart.component';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface MetricOption {
  key: ProgressMetricKey;
  label: string;
  unit: string;
  colorToken: string;
}

interface RangePreset {
  label: string;
  days: number;
}

interface BucketOption {
  label: string;
  value: AnalyticsBucket;
}

@Component({
  selector: 'app-progress-page',
  imports: [FsChartComponent, RouterLink, StatePanelComponent],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss'
})
export class ProgressPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly metricOptions: MetricOption[] = [
    { key: 'weightKg', label: 'Weight', unit: 'kg', colorToken: '--accent' },
    { key: 'bmi', label: 'BMI', unit: '', colorToken: '--blue-500' },
    { key: 'bodyFatRate', label: 'Body fat', unit: '%', colorToken: '--danger' },
    { key: 'waistCm', label: 'Waist', unit: 'cm', colorToken: '--text-primary' }
  ];

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

  readonly data = signal<ProgressData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedMetric = signal<ProgressMetricKey>('weightKg');
  readonly selectedBucket = signal<AnalyticsBucket>('DAY');
  readonly startDate = signal(this.isoDaysAgo(90));
  readonly endDate = signal(this.isoToday());

  readonly selectedMetricOption = computed(() => this.metricOptions.find((option) => option.key === this.selectedMetric())!);

  readonly trendRows = computed(() =>
    (this.data()?.trendPoints ?? [])
      .filter((point) => point.measuredAt && this.metricValue(point, this.selectedMetric()) != null)
      .sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)))
  );

  readonly chartLabels = computed(() => this.trendRows().map((point) => this.shortDate(point.measuredAt)));

  readonly chartSeries = computed<FsChartSeries[]>(() => [
    {
      label: this.selectedMetricOption().label,
      values: this.trendRows().map((point) => this.metricValue(point, this.selectedMetric()) ?? 0),
      colorToken: this.selectedMetricOption().colorToken
    }
  ]);

  readonly chartTitle = computed(() => `${this.selectedMetricOption().label} trend`);

  readonly hasProgressData = computed(() => Boolean(this.data()?.bodyMetrics.length || this.data()?.trendPoints.length));

  readonly latestMetric = computed(() => this.data()?.latestBodyMetric ?? null);

  readonly weightChange = computed(() => {
    const rows = this.trendRows();
    if (rows.length < 2) {
      return null;
    }

    const first = this.metricValue(rows[0], this.selectedMetric());
    const last = this.metricValue(rows[rows.length - 1], this.selectedMetric());
    return first == null || last == null ? null : last - first;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService
      .getProgressData(
        {
          startDate: this.startDate(),
          endDate: this.endDate()
        },
        this.selectedBucket()
      )
      .subscribe({
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

  selectMetric(metric: ProgressMetricKey): void {
    this.selectedMetric.set(metric);
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

  formattedMetric(metric: ProgressBodyMetric | null, key: ProgressMetricKey): string {
    if (!metric) {
      return 'Not recorded';
    }

    const value = this.metricValue(metric, key);
    if (value == null) {
      return 'Not recorded';
    }

    const option = this.metricOptions.find((item) => item.key === key)!;
    const unit = option.unit ? ` ${option.unit}` : '';
    return `${this.formatNumber(value)}${unit}`;
  }

  formattedChange(): string {
    const value = this.weightChange();
    if (value == null) {
      return 'Need 2 entries';
    }

    const option = this.selectedMetricOption();
    const sign = value > 0 ? '+' : '';
    const unit = option.unit ? ` ${option.unit}` : '';
    return `${sign}${this.formatNumber(value)}${unit}`;
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

  metricValue(metric: ProgressBodyMetric, key: ProgressMetricKey): number | null {
    return metric[key];
  }

  shortDate(value: string | null): string {
    if (!value) {
      return 'Unknown';
    }

    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', {
      maximumFractionDigits: 1
    }).format(value);
  }

  private isoToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isoDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }
}
