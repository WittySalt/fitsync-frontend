import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { smallTrend } from './chart-geometry';

/**
 * A small trend line with its start value on the left and its end value on the right, and an
 * optional target as a dashed line. Private copy of the shared `app-small-trend` (contract 5).
 */
@Component({
  selector: 'app-small-trend',
  template: `
    @if (geometry(); as chart) {
      <svg [attr.viewBox]="'0 0 ' + chart.width + ' ' + chart.height" role="img" [attr.aria-label]="label() || ('From ' + start() + ' to ' + end())">
        @if (chart.target !== null) {
          <line class="target" [attr.x1]="chart.start.x + 6" [attr.x2]="chart.end.x - 6" [attr.y1]="chart.target" [attr.y2]="chart.target"></line>
        }
        <polyline class="line" [attr.points]="chart.line"></polyline>
        <circle class="first" [attr.cx]="chart.first.x" [attr.cy]="chart.first.y" r="2.5"></circle>
        <circle class="last" [attr.cx]="chart.last.x" [attr.cy]="chart.last.y" r="3"></circle>
        <text [attr.x]="chart.start.x" [attr.y]="chart.start.y" text-anchor="end" dominant-baseline="central">{{ chart.start.text }}</text>
        <text class="ink" [attr.x]="chart.end.x" [attr.y]="chart.end.y" text-anchor="start" dominant-baseline="central">{{ chart.end.text }}</text>
      </svg>
      @if (from() || to()) {
        <div class="dates" aria-hidden="true"><span>{{ from() }}</span><span>{{ to() }}</span></div>
      }
    }
  `,
  styleUrl: './small-trend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmallTrendComponent {
  readonly values = input<readonly number[]>([]);
  readonly start = input('');
  readonly end = input('');
  readonly width = input(260);
  readonly height = input(44);
  readonly target = input<number | null>(null);
  readonly from = input('');
  readonly to = input('');
  readonly label = input('');

  protected readonly geometry = computed(() => smallTrend(this.values(), this.width(), this.height(), this.start(), this.end(), this.target()));
}
