import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { BarsGeometry, RadarGeometry, buildMuscleChart, describeMuscles } from '../../../dashboard/brief/month/month-radar';

/**
 * The Home month view's radar, drawn from the same geometry, on a light card: the Home component
 * paints its labels white for its dark panel, so the drawing is reused and the colours are not.
 */
@Component({
  selector: 'app-training-radar',
  template: `
    @if (radar(); as chart) {
      <svg [attr.viewBox]="'0 0 ' + chart.width + ' ' + chart.height" role="img" [attr.aria-label]="description()">
        @for (ring of chart.rings; track $index) {
          <polygon class="ring" [attr.points]="ring"></polygon>
        }
        @for (axis of chart.axes; track $index) {
          <line class="ring" [attr.x1]="axis.x1" [attr.y1]="axis.y1" [attr.x2]="axis.x2" [attr.y2]="axis.y2"></line>
        }
        <polygon class="shape" [attr.points]="chart.shape"></polygon>
        @for (dot of chart.dots; track $index) {
          <circle class="dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.5"></circle>
        }
        @for (label of chart.labels; track label.group) {
          <text [attr.text-anchor]="label.anchor"><tspan class="name" [attr.x]="label.x" [attr.y]="label.y">{{ label.label }}</tspan><tspan class="count" [attr.x]="label.x" [attr.y]="label.countY">{{ label.count }}</tspan></text>
        }
      </svg>
    } @else if (bars(); as chart) {
      <svg [attr.viewBox]="'0 0 ' + chart.width + ' ' + chart.height" role="img" [attr.aria-label]="description()">
        @for (row of chart.rows; track row.group) {
          <text x="0" [attr.y]="row.labelY" class="name">{{ row.label }}</text>
          <rect class="bar" [attr.x]="chart.barX" [attr.y]="row.y" [attr.width]="row.barWidth" [attr.height]="chart.barHeight" rx="4"></rect>
          <text class="count" [attr.x]="chart.barX + row.barWidth + 8" [attr.y]="row.labelY">{{ row.count }}</text>
        }
      </svg>
    }
    @if (caption()) {
      <span class="caption">{{ caption() }}</span>
    }
  `,
  styleUrl: './training-radar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainingRadarComponent {
  readonly muscles = input<readonly MonthMuscleInsight[]>([]);
  readonly caption = input('Sessions touching each area');

  private readonly chart = computed(() => buildMuscleChart(this.muscles()));
  protected readonly radar = computed<RadarGeometry | null>(() => (this.chart()?.mode === 'radar' ? (this.chart() as RadarGeometry) : null));
  protected readonly bars = computed<BarsGeometry | null>(() => (this.chart()?.mode === 'bars' ? (this.chart() as BarsGeometry) : null));
  protected readonly description = computed(() => describeMuscles(this.muscles()));
}
