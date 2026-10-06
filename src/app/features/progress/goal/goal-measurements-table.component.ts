import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AccountBodyMetric, AccountDataService } from '../../../core/account-data.service';
import { formatNumber } from '../../../shared/progress/progress-format';

interface MeasurementRow {
  key: string;
  date: string;
  waist: string;
  bodyFat: string;
  bmi: string;
  weight: string;
}

const DASH = '–';
const DAY = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

function cell(value: number | null | undefined, unit = ''): string {
  return value == null ? DASH : `${formatNumber(value, 1)}${unit}`;
}

/** Newest first, one row for each record; a measurement the person left empty shows a dash. */
export function measurementRows(metrics: readonly AccountBodyMetric[]): MeasurementRow[] {
  return [...metrics]
    .filter((metric) => !!metric.measuredAt)
    .sort((a, b) => Date.parse(b.measuredAt!) - Date.parse(a.measuredAt!))
    .map((metric, index) => ({
      key: metric.metricId ?? `${metric.measuredAt}-${index}`,
      date: DAY.format(new Date(metric.measuredAt!)),
      waist: cell(metric.waistCm, ' cm'),
      bodyFat: cell(metric.bodyFatRate, '%'),
      bmi: cell(metric.bmi),
      weight: cell(metric.weightKg, ' kg')
    }));
}

/**
 * Every measurement on the Goal page as a plain table (board 20c): date, waist, body fat, BMI and
 * weight in tabular figures, no icons, a quiet header and 44 px rows.
 */
@Component({
  selector: 'app-goal-measurements-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failed()) {
      <p class="note">The measurements could not load. Try again in a moment.</p>
    } @else if (loading()) {
      <p class="note" aria-busy="true">Loading the measurements.</p>
    } @else if (rows().length === 0) {
      <p class="note">No measurements yet.</p>
    } @else {
      <div class="scroll">
        <table>
          <caption class="sr-only">All body measurements, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" class="num">Waist</th>
              <th scope="col" class="num">Body fat</th>
              <th scope="col" class="num">BMI</th>
              <th scope="col" class="num">Weight</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.key) {
              <tr>
                <th scope="row">{{ row.date }}</th>
                <td class="num">{{ row.waist }}</td>
                <td class="num">{{ row.bodyFat }}</td>
                <td class="num">{{ row.bmi }}</td>
                <td class="num">{{ row.weight }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { height: 44px; padding: 0 12px 0 0; border-bottom: 1px solid var(--border); text-align: left; font: 400 var(--pg-text) var(--font-sans); color: var(--text-primary); white-space: nowrap; }
    thead th { height: 32px; font: 500 var(--pg-eyebrow) var(--font-sans); letter-spacing: var(--pg-eyebrow-tracking); text-transform: uppercase; color: var(--text-secondary); }
    tbody th { font-weight: 500; }
    .num { text-align: right; }
    th.num, td.num { padding-right: 0; padding-left: 12px; }
    .note { margin: 0; font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `
})
export class GoalMeasurementsTableComponent {
  private readonly account = inject(AccountDataService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly metrics = signal<AccountBodyMetric[]>([]);
  protected readonly rows = computed(() => measurementRows(this.metrics()));

  constructor() {
    this.account
      .listBodyMetrics({ limit: 200 })
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        next: (metrics) => {
          this.metrics.set(metrics);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }
}
