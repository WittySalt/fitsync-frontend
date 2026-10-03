import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TrainingLoad } from '../training.models';
import { loadChart } from './chart-geometry';

/** Weekly load stacked by kind with the fitness line and the dashed fatigue line (board 18a). */
@Component({
  selector: 'app-load-chart',
  template: `
    @if (chart(); as c) {
      <svg [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height" role="img" [attr.aria-label]="aria()">
        <text x="0" y="10" class="unit">effort × min</text>
        @for (line of c.grid; track $index) {
          <line class="grid" [attr.x1]="c.x0 - 4" [attr.x2]="c.width" [attr.y1]="line.y" [attr.y2]="line.y"></line>
          <text [attr.x]="c.x0 - 8" [attr.y]="line.y" text-anchor="end" dominant-baseline="central">{{ line.label }}</text>
        }
        @for (column of c.columns; track column.weekStart) {
          <g [class.current]="column.current">
            @for (bar of column.bars; track bar.kind) {
              <rect [class]="bar.kind.toLowerCase()" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="3"></rect>
            }
          </g>
          @if (column.label; as label) {
            <text [attr.x]="label.x" [attr.y]="label.y" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
          }
        }
        <polyline class="fitness" [attr.points]="c.fitness"></polyline>
        <polyline class="fatigue" [attr.points]="c.fatigue"></polyline>
        @if (c.soFar; as soFar) {
          <text class="ink" [attr.x]="soFar.x" [attr.y]="soFar.y" [attr.text-anchor]="soFar.anchor">{{ soFar.text }}</text>
        }
      </svg>
    }
  `,
  styleUrl: './load-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadChartComponent {
  readonly load = input.required<TrainingLoad>();
  readonly today = input.required<string>();
  readonly compact = input(false);

  protected readonly chart = computed(() => loadChart(this.load(), this.today(), this.compact() ? 340 : 640, this.compact() ? 210 : 230, this.compact()));
  protected readonly aria = computed(() => {
    const weeks = this.load().weeks;
    const last = weeks[weeks.length - 1];
    return `Training load each week, effort times minutes, ${weeks.length} weeks${last ? `, last week ${Math.round(last.total)}` : ''}`;
  });
}
