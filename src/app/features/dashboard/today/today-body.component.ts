import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { defer, Subscription } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { BodyMetric, ProgressInsight } from '../../../core/fitsync.models';
import { weightProjection } from '../../../shared/coach/insight/weight-projection.geometry';
import { oneDecimal, weighedLabel, weightChangeLabel } from './today-format';
import { TodayWeightChartComponent } from './today-weight-chart.component';
import { trendSentence } from './today-weight-trend';

interface BodyFigure {
  label: string;
  value: string;
}

type TrendState = 'loading' | 'ready' | 'none';

@Component({
  selector: 'app-today-body',
  imports: [RouterLink, TodayWeightChartComponent],
  templateUrl: './today-body.component.html',
  styleUrl: './today-body.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayBodyComponent {
  private readonly dataService = inject(FitSyncDataService);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;

  readonly metric = input.required<BodyMetric | null>();
  readonly now = input.required<Date>();

  readonly trendState = signal<TrendState>('none');
  private readonly insight = signal<ProgressInsight | null>(null);

  // The dashboard snapshot writes an absent reading as 0, so a zero weight means no weight.
  readonly weightKg = computed(() => {
    const weight = this.metric()?.weightKg;
    return weight != null && weight > 0 ? weight : null;
  });
  readonly hasMeasurement = computed(() => this.weightKg() !== null);
  readonly weightText = computed(() => {
    const weight = this.weightKg();
    return weight === null ? '' : `${oneDecimal(weight)} kg`;
  });
  readonly weighed = computed(() => {
    const when = weighedLabel(this.metric()?.measuredAt, this.now());
    return when ? `Weighed ${when}` : '';
  });
  readonly change = computed(() => weightChangeLabel(this.metric()?.weightChange30dKg));

  readonly figures = computed<BodyFigure[]>(() => {
    const metric = this.metric();
    const figures: BodyFigure[] = [];
    if (metric?.bodyFatRate != null && metric.bodyFatRate > 0) {
      figures.push({ label: 'Body fat', value: `${oneDecimal(metric.bodyFatRate)}%` });
    }
    if (metric?.waistCm != null && metric.waistCm > 0) {
      figures.push({ label: 'Waist', value: `${oneDecimal(metric.waistCm)} cm` });
    }
    if (metric?.bmi != null && metric.bmi > 0) {
      figures.push({ label: 'BMI', value: oneDecimal(metric.bmi) });
    }
    return figures;
  });

  /** The insight when it has enough weigh-ins to draw, so the chart and its sentence appear together. */
  readonly chartInsight = computed(() => {
    const insight = this.insight();
    return this.trendState() === 'ready' && insight !== null && weightProjection(insight) !== null ? insight : null;
  });
  readonly sentence = computed(() => {
    const insight = this.chartInsight();
    return insight === null ? '' : trendSentence(insight);
  });

  constructor() {
    // The trend is asked for again only when the measurement changes. Without a measurement there
    // is nothing to chart, so no request is made.
    const requestKey = computed(() => (this.hasMeasurement() ? `${this.metric()?.measuredAt ?? ''}|${this.weightKg()}` : null));
    effect(() => {
      const key = requestKey();
      untracked(() => (key === null ? this.stop() : this.load()));
    });
  }

  private stop(): void {
    this.request?.unsubscribe();
    this.request = null;
    this.insight.set(null);
    this.trendState.set('none');
  }

  // The chart is an addition to the figures, so a failed request leaves the figures as they are.
  private load(): void {
    this.request?.unsubscribe();
    this.insight.set(null);
    this.trendState.set('loading');
    // The call is deferred so that any failure, even one thrown before a request exists, is caught.
    this.request = defer(() => this.dataService.getProgressInsight())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (insight) => {
          this.insight.set(insight);
          this.trendState.set('ready');
        },
        error: () => this.trendState.set('none')
      });
  }
}
