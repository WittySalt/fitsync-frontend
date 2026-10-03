import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { measureWidth } from '../../../../shared/progress/measure-width';
import { E1rmPoint } from '../training.models';
import { seriesChart } from './chart-geometry';

/**
 * One lift's or one exercise's series: kg grid, the green line over a soft area, a filled dark dot
 * on each record and an open dot on every other session, the first and last values written beside
 * their points, and the best before the period as a dashed line with its haloed key in the corner.
 */
@Component({
  selector: 'app-series-chart',
  templateUrl: './series-chart.component.html',
  styleUrl: './series-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeriesChartComponent {
  readonly points = input<readonly E1rmPoint[]>([]);
  readonly bestBefore = input<number | null>(null);
  readonly unit = input('kg');
  readonly height = input(136);
  readonly label = input('');

  protected readonly width = measureWidth(320);
  protected readonly chart = computed(() => seriesChart(this.points(), { width: this.width(), height: this.height(), bestBefore: this.bestBefore(), unit: this.unit() }));
}
