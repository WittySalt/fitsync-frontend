import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { measureWidth } from '../../../../shared/progress/measure-width';
import { TrainingLoad } from '../training.models';
import { loadChart } from './chart-geometry';

/** Weekly load stacked by kind with the fitness line and the dashed fatigue line (board 18a). */
@Component({
  selector: 'app-load-chart',
  template: `
    @if (chart(); as c) {
      <svg [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height" [style.width.px]="c.width" role="img" [attr.aria-label]="aria()">
        <text x="0" y="12" class="unit">effort × min</text>
        @for (line of c.grid; track $index) {
          <line class="grid" [attr.x1]="c.x0 - 4" [attr.x2]="c.width" [attr.y1]="line.y" [attr.y2]="line.y"></line>
          <text [attr.x]="c.x0 - 8" [attr.y]="line.y" text-anchor="end" dominant-baseline="central">{{ line.label }}</text>
        }
        @for (column of c.columns; track column.weekStart) {
          <g [class.current]="column.current">
            @for (bar of column.bars; track bar.kind) {
              <rect [class]="bar.kind.toLowerCase()" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" [attr.rx]="radius(bar.width)"></rect>
            }
          </g>
        }
        @for (label of c.labels; track $index) {
          <text [attr.x]="label.x" [attr.y]="label.y" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
        }
        <polyline class="fitness" [attr.points]="c.fitness"></polyline>
        <polyline class="fatigue" [attr.points]="c.fatigue"></polyline>
      </svg>
    }
  `,
  styleUrl: './load-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadChartComponent {
  readonly load = input.required<TrainingLoad>();
  readonly today = input.required<string>();
  readonly height = input(230);

  protected readonly width = measureWidth(640);
  protected readonly chart = computed(() => loadChart(this.load(), this.today(), this.width(), this.height()));
  protected radius(width: number): number {
    return Math.min(4, width / 2);
  }

  protected readonly aria = computed(() => {
    const weeks = this.load().weeks;
    const last = weeks[weeks.length - 1];
    return `Training load each week, effort times minutes, ${weeks.length} weeks${last ? `, last week ${Math.round(last.total)}` : ''}`;
  });
}
