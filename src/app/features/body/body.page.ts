import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';

import {
  AccountBodyMetric,
  AccountCenterData,
  AccountDataService,
  AccountProfile,
  CreateBodyMetricRequest,
  MetricSource
} from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { dateKeyInZone } from '../../core/zone-time';
import { PagerComponent } from '../../shared/pager.component';
import { FsChartComponent, FsChartSeries } from '../../shared/fs-chart.component';

type BodyChartMetric = 'weightKg' | 'bodyFatRate' | 'waistCm';
type HistoryMetricFilter = 'all' | BodyChartMetric;
type BodyMetricField = 'waistCm' | 'hipCm' | 'chestCm' | 'armCm' | 'thighCm' | 'calfCm' | 'bodyFatRate';

interface BodyChartOption {
  key: BodyChartMetric;
  label: string;
  unit: string;
  colorToken: string;
}

interface MeasurementCard {
  label: string;
  value: string;
  set: boolean;
  action: 'Add' | 'Edit';
  field: BodyMetricField | 'heightCm';
}

@Component({
  selector: 'app-body-page',
  imports: [FsChartComponent, PagerComponent, ReactiveFormsModule],
  templateUrl: './body.page.html'
})
export class BodyPage implements OnInit {
  private readonly accountDataService = inject(AccountDataService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);
  private readonly userTimezone = inject(UserTimezoneService);

  /** When rendered inside another page (e.g. the Progress hub) the page header is suppressed. */
  readonly embedded = input(false);
  /** Embedded and showing only the measurement form, open from the start; `closed` says when it is done. */
  readonly formOnly = input(false);
  readonly closed = output<void>();

  readonly data = signal<AccountCenterData | null>(null);
  readonly metrics = signal<AccountBodyMetric[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editingMetricId = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);

  readonly selectedChartMetric = signal<BodyChartMetric>('weightKg');
  readonly historyMetricFilter = signal<HistoryMetricFilter>('all');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [5, 10, 20] as const;

  readonly metricSourceOptions = [
    { value: 'MANUAL', label: 'Manual' },
    { value: 'DEVICE', label: 'Device' },
    { value: 'IMPORTED', label: 'Imported' }
  ];

  readonly chartOptions: BodyChartOption[] = [
    { key: 'weightKg', label: 'Weight', unit: 'kg', colorToken: '--accent' },
    { key: 'bodyFatRate', label: 'Body fat', unit: '%', colorToken: '--danger' },
    { key: 'waistCm', label: 'Waist', unit: 'cm', colorToken: '--blue-500' }
  ];

  readonly bodyForm = this.fb.group({
    heightCm: ['', [Validators.min(80), Validators.max(300)]],
    weightKg: ['', [Validators.min(1), Validators.max(500)]],
    bodyFatRate: ['', [Validators.min(0), Validators.max(100)]],
    waistCm: ['', [Validators.min(1), Validators.max(500)]],
    hipCm: ['', [Validators.min(1), Validators.max(500)]],
    chestCm: ['', [Validators.min(1), Validators.max(500)]],
    armCm: ['', [Validators.min(1), Validators.max(500)]],
    thighCm: ['', [Validators.min(1), Validators.max(500)]],
    calfCm: ['', [Validators.min(1), Validators.max(500)]],
    measuredAt: ['', [Validators.required]],
    source: ['MANUAL'],
    note: ['', [Validators.maxLength(200)]]
  });

  readonly sortedMetrics = computed(() => this.sortMetrics(this.metrics()));

  readonly chronologicalMetrics = computed(() => [...this.sortedMetrics()].reverse());

  readonly latestMetric = computed(() => this.sortedMetrics()[0] ?? null);

  readonly currentWeight = computed(() => this.latestMetric()?.weightKg ?? null);

  readonly weightDelta = computed(() => {
    const latest = this.latestMetricWithValue('weightKg');
    const oldest = this.chronologicalMetrics().find((metric) => metric.weightKg != null);
    if (!latest || !oldest || this.metricKey(latest) === this.metricKey(oldest) || latest.weightKg == null || oldest.weightKg == null) {
      return null;
    }
    return latest.weightKg - oldest.weightKg;
  });

  readonly bmiValue = computed(() => this.latestMetric()?.bmi ?? this.derivedBmi());

  readonly bmiStatus = computed(() => {
    const bmi = this.bmiValue();
    if (bmi == null) {
      return 'Not available';
    }
    if (bmi < 18.5) {
      return 'Underweight';
    }
    if (bmi < 25) {
      return 'Normal';
    }
    if (bmi < 30) {
      return 'Overweight';
    }
    return 'Obese';
  });

  readonly bmiRingDashArray = computed(() => {
    const bmi = this.bmiValue();
    // The ring is full at a BMI of 40; the circle uses pathLength 100, so the dash pair is a percent.
    const value = bmi == null ? 0 : Math.min(Math.max(bmi / 40, 0), 1) * 100;
    return `${value} ${100 - value}`;
  });

  readonly bodyFatLabel = computed(() => {
    const value = this.latestMetric()?.bodyFatRate;
    return value == null ? 'Not set' : this.displayMetric(value, '%');
  });

  readonly sparklinePoints = computed(() => this.sparklineFor(this.chronologicalMetrics().filter((metric) => metric.weightKg != null).slice(-12)));

  readonly measurementCards = computed<MeasurementCard[]>(() => {
    const profile = this.data()?.user.profile;
    const metric = this.latestMetric();
    return [
      this.card('Height', this.displayHeight(profile?.heightCm), profile?.heightCm != null, 'heightCm'),
      this.card('Waist', this.displayMetric(metric?.waistCm, 'cm'), metric?.waistCm != null, 'waistCm'),
      this.card('Hip', this.displayMetric(metric?.hipCm, 'cm'), metric?.hipCm != null, 'hipCm'),
      this.card('Chest', this.displayMetric(metric?.chestCm, 'cm'), metric?.chestCm != null, 'chestCm'),
      this.card('Arm', this.displayMetric(metric?.armCm, 'cm'), metric?.armCm != null, 'armCm'),
      this.card('Thigh', this.displayMetric(metric?.thighCm, 'cm'), metric?.thighCm != null, 'thighCm'),
      this.card('Calf', this.displayMetric(metric?.calfCm, 'cm'), metric?.calfCm != null, 'calfCm'),
      this.card('Body fat', this.displayMetric(metric?.bodyFatRate, '%'), metric?.bodyFatRate != null, 'bodyFatRate')
    ];
  });

  readonly selectedChartOption = computed(() => this.chartOptions.find((option) => option.key === this.selectedChartMetric())!);

  readonly chartRows = computed(() =>
    this.chronologicalMetrics().filter((metric) => this.metricValue(metric, this.selectedChartMetric()) != null)
  );

  readonly chartLabels = computed(() => this.chartRows().map((metric) => this.shortDate(metric.measuredAt)));

  readonly chartSeries = computed<FsChartSeries[]>(() => [
    {
      label: this.selectedChartOption().label,
      values: this.chartRows().map((metric) => this.metricValue(metric, this.selectedChartMetric())),
      colorToken: this.selectedChartOption().colorToken
    }
  ]);

  readonly filteredMetrics = computed(() => {
    const metricFilter = this.historyMetricFilter();
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.sortedMetrics().filter((metric) => {
      if (metricFilter !== 'all' && this.metricValue(metric, metricFilter) == null) {
        return false;
      }
      const day = this.isoDay(metric.measuredAt);
      if (from && (!day || day < from)) {
        return false;
      }
      if (to && (!day || day > to)) {
        return false;
      }
      return true;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredMetrics().length / this.pageSize())));

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages() - 1));

  readonly pagedMetrics = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredMetrics().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      account: this.accountDataService.getAccountCenter(),
      metrics: this.accountDataService.listBodyMetrics({ limit: 200 })
    }).subscribe({
      next: ({ account, metrics }) => {
        this.data.set(account);
        this.metrics.set(this.sortMetrics(metrics));
        this.loading.set(false);
        this.patchNewMeasurement();
        if (this.formOnly()) {
          this.formOpen.set(true);
        }
      },
      error: (error: Error) => {
        this.error.set(error.message || 'Unable to load body metrics.');
        this.loading.set(false);
      }
    });
  }

  openNewMeasurement(): void {
    this.editingMetricId.set(null);
    this.patchNewMeasurement();
    this.formOpen.set(true);
  }

  editLatestMeasurement(): void {
    const metric = this.latestMetric();
    if (!metric?.metricId) {
      this.openNewMeasurement();
      return;
    }
    this.editMetric(metric);
  }

  editCard(field: MeasurementCard['field']): void {
    if (field === 'heightCm') {
      this.openNewMeasurement();
      return;
    }
    this.editLatestMeasurement();
  }

  editMetric(metric: AccountBodyMetric): void {
    this.editingMetricId.set(metric.metricId);
    this.bodyForm.patchValue({
      heightCm: toFormNumber(this.data()?.user.profile.heightCm),
      weightKg: toFormNumber(metric.weightKg),
      bodyFatRate: toFormNumber(metric.bodyFatRate),
      waistCm: toFormNumber(metric.waistCm),
      hipCm: toFormNumber(metric.hipCm),
      chestCm: toFormNumber(metric.chestCm),
      armCm: toFormNumber(metric.armCm),
      thighCm: toFormNumber(metric.thighCm),
      calfCm: toFormNumber(metric.calfCm),
      measuredAt: toDateTimeInput(metric.measuredAt),
      source: metric.source ?? 'MANUAL',
      note: metric.note ?? ''
    });
    this.formOpen.set(true);
  }

  cancelEdit(): void {
    this.formOpen.set(false);
    this.editingMetricId.set(null);
    this.patchNewMeasurement();
    if (this.formOnly()) {
      this.closed.emit();
    }
  }

  saveBody(): void {
    const data = this.data();
    if (!data || this.bodyForm.invalid) {
      this.bodyForm.markAllAsTouched();
      return;
    }

    const profile: AccountProfile = {
      ...data.user.profile,
      heightCm: toNullableNumber(this.bodyForm.controls.heightCm.value)
    };
    const metricRequest = this.bodyMetricRequest();
    const editingId = this.editingMetricId();
    const metric$ = metricRequest
      ? editingId
        ? this.accountDataService.replaceBodyMetric(editingId, metricRequest)
        : this.accountDataService.createBodyMetric(metricRequest)
      : of(null);

    this.saving.set(true);
    forkJoin({
      profile: this.accountDataService.updateProfile(profile),
      metric: metric$
    }).subscribe({
      next: ({ profile: updatedProfile, metric }) => {
        this.data.set({
          ...data,
          user: {
            ...data.user,
            profile: updatedProfile,
            latestBodyMetrics: this.latestMetricAfterSave(data.user.latestBodyMetrics, metric)
          }
        });
        if (metric) {
          this.metrics.set(this.metricsAfterSave(metric));
        }
        const message = metric ? 'Measurement saved.' : 'Body profile updated.';
        this.saveMessage.set(message);
        this.error.set(null);
        this.toast.success(message);
        this.saving.set(false);
        this.cancelEdit();
      },
      error: (error: Error) => {
        const message = error.message || 'Unable to save body measurement.';
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      }
    });
  }

  selectChartMetric(metric: BodyChartMetric): void {
    this.selectedChartMetric.set(metric);
  }

  updateMetricFilter(value: string): void {
    this.historyMetricFilter.set((value as HistoryMetricFilter) || 'all');
    this.page.set(0);
  }

  updateDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.page.set(0);
  }

  updateDateTo(value: string): void {
    this.dateTo.set(value);
    this.page.set(0);
  }

  setPageSize(size: number): void {
    if (!this.pageSizeOptions.includes(size as (typeof this.pageSizeOptions)[number])) {
      return;
    }
    this.pageSize.set(size);
    this.page.set(0);
  }

  goToPage(page: number): void {
    this.page.set(Math.min(this.totalPages() - 1, Math.max(0, page)));
  }

  displayMetric(value: number | null | undefined, unit: string): string {
    return value == null ? '' : `${this.formatNumber(value)} ${unit}`;
  }

  displayHeight(value: number | null | undefined): string {
    return value == null ? '' : `${this.formatNumber(value)} cm`;
  }

  displayWeight(metric: AccountBodyMetric | null | undefined): string {
    return metric?.weightKg == null ? 'Not recorded' : `${this.formatNumber(metric.weightKg)} kg`;
  }

  displayDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }
    return new Intl.DateTimeFormat('en-SG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  shortDate(value: string | null | undefined): string {
    if (!value) {
      return 'Unknown';
    }
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  deltaLabel(value: number | null): string {
    if (value == null) {
      return 'Need 2 entries';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatNumber(value)} kg`;
  }

  historyWeightDelta(metric: AccountBodyMetric): number | null {
    if (metric.weightKg == null) {
      return null;
    }
    const rows = this.sortedMetrics();
    const index = rows.findIndex((entry) => this.metricKey(entry) === this.metricKey(metric));
    const older = rows.slice(index + 1).find((entry) => entry.weightKg != null);
    return older?.weightKg == null ? null : metric.weightKg - older.weightKg;
  }

  metricValue(metric: AccountBodyMetric, key: BodyChartMetric): number | null {
    return metric[key];
  }

  private bodyMetricRequest(): CreateBodyMetricRequest | null {
    const value = this.bodyForm.getRawValue();
    const measurementValues = [
      value.weightKg,
      value.bodyFatRate,
      value.waistCm,
      value.hipCm,
      value.chestCm,
      value.armCm,
      value.thighCm,
      value.calfCm
    ];
    if (!measurementValues.some((entry) => entry !== '')) {
      return null;
    }

    return {
      weightKg: toNullableNumber(value.weightKg),
      bodyFatRate: toNullableNumber(value.bodyFatRate),
      waistCm: toNullableNumber(value.waistCm),
      hipCm: toNullableNumber(value.hipCm),
      chestCm: toNullableNumber(value.chestCm),
      armCm: toNullableNumber(value.armCm),
      thighCm: toNullableNumber(value.thighCm),
      calfCm: toNullableNumber(value.calfCm),
      measuredAt: new Date(value.measuredAt).toISOString(),
      source: value.source as MetricSource,
      note: nullableText(value.note)
    };
  }

  private patchNewMeasurement(): void {
    this.bodyForm.patchValue({
      heightCm: toFormNumber(this.data()?.user.profile.heightCm),
      weightKg: '',
      bodyFatRate: '',
      waistCm: '',
      hipCm: '',
      chestCm: '',
      armCm: '',
      thighCm: '',
      calfCm: '',
      measuredAt: toDateTimeInput(null),
      source: 'MANUAL',
      note: ''
    });
  }

  private latestMetricWithValue(key: BodyChartMetric): AccountBodyMetric | null {
    return this.sortedMetrics().find((metric) => metric[key] != null) ?? null;
  }

  private latestMetricAfterSave(current: AccountBodyMetric | null, saved: AccountBodyMetric | null): AccountBodyMetric | null {
    if (!saved) {
      return current;
    }
    if (!current?.measuredAt || !saved.measuredAt) {
      return saved;
    }
    return Date.parse(saved.measuredAt) >= Date.parse(current.measuredAt) ? saved : current;
  }

  private metricsAfterSave(metric: AccountBodyMetric): AccountBodyMetric[] {
    const withoutCurrent = this.metrics().filter((entry) => this.metricKey(entry) !== this.metricKey(metric));
    return this.sortMetrics([metric, ...withoutCurrent]);
  }

  private sortMetrics(metrics: AccountBodyMetric[]): AccountBodyMetric[] {
    const unique = new Map<string, AccountBodyMetric>();
    metrics.forEach((metric, index) => unique.set(this.metricKey(metric) || `metric-${index}`, metric));
    return [...unique.values()].sort((left, right) => Date.parse(right.measuredAt ?? '') - Date.parse(left.measuredAt ?? ''));
  }

  private metricKey(metric: AccountBodyMetric): string {
    return metric.metricId ?? metric.measuredAt ?? '';
  }

  private derivedBmi(): number | null {
    const heightCm = this.data()?.user.profile.heightCm;
    const weightKg = this.latestMetric()?.weightKg;
    if (!heightCm || !weightKg) {
      return null;
    }
    const heightM = heightCm / 100;
    return round(weightKg / (heightM * heightM), 1);
  }

  private card(label: string, value: string, set: boolean, field: MeasurementCard['field']): MeasurementCard {
    return {
      label,
      value,
      set,
      action: set ? 'Edit' : 'Add',
      field
    };
  }

  private sparklineFor(metrics: AccountBodyMetric[]): string {
    if (metrics.length < 2) {
      return '';
    }
    const values = metrics.map((metric) => metric.weightKg ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((value, index) => {
        // Fits the template's 180 x 58 viewBox, keeping the line between y 8 and y 52.
        const x = (index / Math.max(values.length - 1, 1)) * 180;
        const y = 52 - ((value - min) / range) * 44;
        return `${round(x, 1)},${round(y, 1)}`;
      })
      .join(' ');
  }

  // The calendar day in the profile zone, the same days the person picks in the date filters.
  private isoDay(value: string | null | undefined): string {
    const instant = value ? new Date(value) : null;
    return instant && !Number.isNaN(instant.getTime()) ? dateKeyInZone(instant, this.userTimezone.zone()) : '';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', { maximumFractionDigits: 1 }).format(value);
  }
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

function toFormNumber(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function toDateTimeInput(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  // A datetime-local input wants local wall time, so shift by the offset before taking the ISO text.
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
