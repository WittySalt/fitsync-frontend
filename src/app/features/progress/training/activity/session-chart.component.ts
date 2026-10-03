import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { measureWidth } from '../../../../shared/progress/measure-width';
import { ActivitySession } from '../training.models';
import { sessionChart } from './activity-geometry';

/** Each session: minutes as bars, effort as the line in its own band above, every value written. */
@Component({
  selector: 'app-session-chart',
  template: `
    @if (chart(); as c) {
      <svg [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height" [style.width.px]="c.width" role="img" [attr.aria-label]="'Minutes and effort of the last ' + c.columns.length + ' sessions'">
        <text x="0" y="12" class="unit">effort</text>
        @for (line of c.grid; track $index) {
          <line class="grid" [attr.x1]="c.x0 - 4" [attr.x2]="c.width" [attr.y1]="line.y" [attr.y2]="line.y"></line>
          <text [attr.x]="c.x0 - 8" [attr.y]="line.y" text-anchor="end" dominant-baseline="central">{{ line.label }}</text>
        }
        @for (column of c.columns; track $index) {
          <rect class="bar" [attr.x]="column.bar.x" [attr.y]="column.bar.y" [attr.width]="column.bar.width" [attr.height]="column.bar.height" rx="4"></rect>
          <text class="ink" [attr.x]="column.minutes.x" [attr.y]="column.minutes.y" text-anchor="middle">{{ column.minutes.text }}</text>
        }
        @for (date of c.dates; track $index) {
          <text [attr.x]="date.x" [attr.y]="date.y" [attr.text-anchor]="date.anchor">{{ date.text }}</text>
        }
        <polyline class="effort" [attr.points]="c.effortLine"></polyline>
        @for (column of c.columns; track $index) {
          @if (column.effort; as point) {
            <circle class="point" [class.estimated]="point.estimated" [attr.cx]="point.x" [attr.cy]="point.y" r="3"></circle>
            <text class="value halo" [attr.x]="point.x" [attr.y]="point.y - 9" text-anchor="middle">{{ point.text }}</text>
          }
        }
      </svg>
      <div class="key" aria-hidden="true">
        <span><i class="sw"></i>Minutes</span>
        <span><i class="ln"></i>Effort, 1 to 10</span>
      </div>
    }
  `,
  styleUrl: './session-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionChartComponent {
  readonly sessions = input<readonly ActivitySession[]>([]);

  protected readonly width = measureWidth(520);
  protected readonly chart = computed(() => sessionChart(this.sessions(), this.width()));
}
