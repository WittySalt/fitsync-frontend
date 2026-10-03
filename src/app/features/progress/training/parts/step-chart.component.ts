import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TrainingKind } from '../training.models';
import { stepChart } from './chart-geometry';

/**
 * Total time rising with each session: flat between sessions, a step up on each. The cards of one
 * page share a top so their heights compare. Private copy of the shared `app-step-chart`.
 */
@Component({
  selector: 'app-step-chart',
  template: `
    @let chart = geometry();
    <svg [attr.viewBox]="'0 0 ' + chart.width + ' ' + chart.height" role="img" [attr.aria-label]="'Total time ' + chart.endLabel + ', ' + chart.from.text + ' to ' + chart.to.text">
      @for (line of chart.grid; track $index) {
        <line class="grid" [attr.x1]="chart.x0" [attr.x2]="chart.x1" [attr.y1]="line.y" [attr.y2]="line.y"></line>
        <text [attr.x]="chart.x0 - 6" [attr.y]="line.y" text-anchor="end" dominant-baseline="central">{{ line.label }}</text>
      }
      <path class="step" [class]="'step ' + kind().toLowerCase()" [attr.d]="chart.d"></path>
      <circle class="dot" [class]="'dot ' + kind().toLowerCase()" [attr.cx]="chart.end.x" [attr.cy]="chart.end.y" r="3"></circle>
      <text class="ink" [attr.x]="chart.end.x + 6" [attr.y]="chart.end.y" dominant-baseline="central">{{ chart.endLabel }}</text>
      <text [attr.x]="chart.from.x" [attr.y]="chart.from.y" text-anchor="start">{{ chart.from.text }}</text>
      <text [attr.x]="chart.to.x" [attr.y]="chart.to.y" text-anchor="end">{{ chart.to.text }}</text>
    </svg>
  `,
  styleUrl: './step-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepChartComponent {
  readonly points = input<readonly { date: string; minutes: number }[]>([]);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** The shared top in minutes. */
  readonly top = input(300);
  readonly kind = input<TrainingKind>('STRENGTH');

  protected readonly geometry = computed(() => stepChart(this.points(), this.from(), this.to(), this.top()));
}
