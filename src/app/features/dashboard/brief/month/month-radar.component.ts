import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { BarsGeometry, RadarGeometry, buildMuscleChart, describeMuscles } from './month-radar';

/** The month's sessions by muscle group: a radar from three groups on, bars below that. */
@Component({
  selector: 'app-month-radar',
  standalone: true,
  templateUrl: './month-radar.component.html',
  styleUrl: './month-radar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthRadarComponent {
  readonly muscles = input.required<readonly MonthMuscleInsight[]>();

  private readonly chart = computed(() => buildMuscleChart(this.muscles()));
  protected readonly radar = computed<RadarGeometry | null>(() => {
    const chart = this.chart();
    return chart?.mode === 'radar' ? chart : null;
  });
  protected readonly bars = computed<BarsGeometry | null>(() => {
    const chart = this.chart();
    return chart?.mode === 'bars' ? chart : null;
  });
  protected readonly description = computed(() => describeMuscles(this.muscles()));
}
