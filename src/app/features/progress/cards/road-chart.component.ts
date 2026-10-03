import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber } from '../../../shared/progress/progress-format';
import { GoalRoad } from '../progress-api.models';
import { ROAD_HEIGHT, roadGeometry } from './goal-road';
import { hostWidth } from './host-width';

/**
 * The weight road (board 21f): a track from the start to the target with a tick for every whole
 * kilo, the date each was crossed or is expected, today as a dot and the target as a bullseye.
 * The SVG is built at the host's pixel width, so its 12 px text is never scaled.
 */
@Component({
  selector: 'app-road-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height" [attr.viewBox]="'0 0 ' + width() + ' ' + height" role="img" [attr.aria-label]="label()">
      @if (geometry(); as g) {
        <rect class="track" [attr.x]="g.x0" [attr.y]="y(125)" [attr.width]="g.x1 - g.x0" height="10" rx="5"></rect>
        <rect class="done" [attr.x]="g.x0" [attr.y]="y(125)" [attr.width]="g.todayX - g.x0" height="10" rx="5"></rect>
        @if (g.dashed) {
          <line [class]="'dash ' + g.dashed" [attr.x1]="g.todayX" [attr.x2]="g.x1" [attr.y1]="y(130)" [attr.y2]="y(130)"></line>
        }
        @for (mark of g.marks; track mark.kg) {
          <line class="tick" [attr.x1]="mark.x" [attr.x2]="mark.x" [attr.y1]="y(110)" [attr.y2]="y(120)"></line>
          @if (mark.label) {
            <text class="t12" text-anchor="middle" [attr.x]="mark.x" [attr.y]="y(104)">{{ mark.label }}</text>
          }
          @if (mark.date) {
            <text class="t12" text-anchor="middle" [attr.x]="mark.x" [attr.y]="y(158)">{{ mark.date }}</text>
          }
        }
        <circle class="ring" [attr.cx]="g.x1" [attr.cy]="y(130)" r="12" [attr.stroke-width]="g.reached ? 3 : 2"></circle>
        <circle class="core" [attr.cx]="g.x1" [attr.cy]="y(130)" [attr.r]="g.reached ? 6 : 4"></circle>
        <text class="target" text-anchor="middle" [attr.x]="g.x1" [attr.y]="y(g.raiseTarget ? 92 : 106)">{{ target() }}</text>
        @if (!g.reached) {
          <circle class="today" [attr.cx]="g.todayX" [attr.cy]="y(130)" r="6"></circle>
          <text class="now" [attr.text-anchor]="g.today.anchor" [attr.x]="g.todayX" [attr.y]="y(158)">Today</text>
        }
        <text class="t12" text-anchor="end" [attr.x]="width()" [attr.y]="y(184)">{{ g.percent }}</text>
      } @else {
        <rect class="track" x="12" [attr.y]="y(125)" [attr.width]="width() - 40" height="10" rx="5"></rect>
        <circle class="ring quiet" [attr.cx]="width() - 28" [attr.cy]="y(130)" r="12" stroke-width="2"></circle>
      }
    </svg>
  `,
  styles: `
    :host { display: block; width: 100%; }
    svg { display: block; overflow: visible; }
    .track { fill: var(--border); }
    .done { fill: var(--accent); }
    .tick { stroke: var(--border-strong); stroke-width: 1; }
    .dash { stroke-width: 2; stroke-dasharray: 6 6; stroke-linecap: round; }
    .dash.green { stroke: var(--accent); }
    .dash.slate { stroke: var(--text-muted); }
    .ring { fill: none; stroke: var(--accent); }
    .ring.quiet { stroke: var(--border-strong); }
    .core { fill: var(--accent); }
    .today { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
    text { font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
    .t12 { font-size: var(--pg-chart); fill: var(--text-secondary); }
    .now { font-size: var(--pg-control); font-weight: 600; fill: var(--text-primary); }
    .target { font-family: var(--font-display); font-size: var(--pg-figure-tail); font-weight: 600; fill: var(--text-primary); }
  `
})
export class RoadChartComponent {
  readonly road = input<GoalRoad | null>(null);
  readonly label = input('');

  protected readonly width = hostWidth(560);
  protected readonly height = ROAD_HEIGHT;
  protected readonly geometry = computed(() => {
    const road = this.road();
    return road ? roadGeometry(road, this.width()) : null;
  });
  protected readonly target = computed(() => {
    const road = this.road();
    return road ? `${formatNumber(road.targetKg, road.targetKg % 1 ? 1 : 0)} kg` : '';
  });

  /** The drawing starts near the top of its own box, so the caption follows it closely. */
  protected y(value: number): number {
    return value - 66;
  }
}
