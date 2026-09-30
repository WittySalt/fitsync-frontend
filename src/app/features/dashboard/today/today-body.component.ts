import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BodyMetric } from '../../../core/fitsync.models';
import { oneDecimal, weighedLabel, weightChangeLabel } from './today-format';

interface BodyFigure {
  label: string;
  value: string;
}

@Component({
  selector: 'app-today-body',
  imports: [RouterLink],
  templateUrl: './today-body.component.html',
  styleUrl: './today-body.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayBodyComponent {
  readonly metric = input.required<BodyMetric | null>();
  readonly now = input.required<Date>();

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
    if (metric?.bmi != null && metric.bmi > 0) {
      figures.push({ label: 'BMI', value: oneDecimal(metric.bmi) });
    }
    return figures;
  });
}
