import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ProgressInsight } from '../../../core/fitsync.models';
import {
  WEIGHT_HEIGHT,
  WEIGHT_PLOT_LEFT,
  WEIGHT_PLOT_RIGHT,
  WEIGHT_WIDTH,
  weightProjection
} from '../../../shared/coach/insight/weight-projection.geometry';

/**
 * The weight chart of the Today card's Body tab.
 *
 * It draws with the same geometry as the Progress reading, but the reading sits on a dark card and
 * fixes its colours, while this chart sits on the card's own surface and takes every colour from
 * the theme tokens so it is legible in both themes.
 */
@Component({
  selector: 'app-today-weight-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chart(); as drawn) {
      <svg class="weight" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="drawn.description">
        @if (drawn.goal; as goal) {
          <line class="goal-line" [attr.x1]="left" [attr.y1]="goal.y" [attr.x2]="right" [attr.y2]="goal.y"></line>
          <text class="goal-label" [attr.x]="goal.labelX" [attr.y]="goal.labelY">{{ goal.text }}</text>
        }
        @if (drawn.projection; as projection) {
          <line class="projection" [attr.x1]="projection.x1" [attr.y1]="projection.y1" [attr.x2]="projection.x2" [attr.y2]="projection.y2"></line>
          @if (projection.arrow; as arrow) {
            <path class="arrow" [attr.d]="arrow"></path>
          }
          @if (projection.reachesGoal) {
            <circle class="reach" [attr.cx]="projection.x2" [attr.cy]="projection.y2" r="4"></circle>
          }
        }
        <polyline class="series" [attr.points]="drawn.line"></polyline>
        <circle class="latest" [attr.cx]="drawn.latest.x" [attr.cy]="drawn.latest.y" r="5"></circle>
        <text class="latest-label" [attr.x]="drawn.latest.labelX" [attr.y]="drawn.latest.labelY" [attr.text-anchor]="drawn.latest.anchor">{{ drawn.latest.text }}</text>
        @for (label of drawn.axisLabels; track $index) {
          <text class="date" [attr.x]="label.x" [attr.y]="label.y" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
        }
      </svg>
      <dl class="weight-list">
        @for (item of drawn.summary; track item.label) {
          <div>
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        }
      </dl>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        container-type: inline-size;
      }
      /* Under this width the drawing's labels would be too small to read, so the same figures are
         written as a short list. */
      .weight-list {
        display: none;
        margin: 0;
        padding: 0;
        flex-direction: column;
        gap: 8px;
      }
      .weight-list div {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        font-size: var(--text-sm);
        line-height: 1.4;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }
      .weight-list dt {
        min-width: 0;
      }
      .weight-list dd {
        margin: 0;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
        white-space: nowrap;
      }
      .weight {
        display: block;
        width: 100%;
        max-width: 600px;
        height: auto;
      }
      text {
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .goal-line {
        stroke: var(--text-secondary);
        stroke-width: 1.5;
        stroke-dasharray: 5 4;
      }
      .goal-label {
        font-weight: 700;
        fill: var(--text-secondary);
      }
      .projection {
        stroke: var(--accent);
        stroke-width: 2;
        stroke-dasharray: 5 4;
        stroke-linecap: round;
      }
      .arrow {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .reach {
        fill: var(--accent);
      }
      .series {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .latest {
        fill: var(--surface);
        stroke: var(--accent);
        stroke-width: 2.5;
      }
      .latest-label {
        font-weight: 700;
        fill: var(--text-primary);
      }
      .date {
        font-weight: 600;
        fill: var(--text-secondary);
      }
      @container (max-width: 419px) {
        .weight {
          display: none;
        }
        .weight-list {
          display: flex;
        }
      }
    `
  ]
})
export class TodayWeightChartComponent {
  readonly insight = input.required<ProgressInsight>();

  readonly viewBox = `0 0 ${WEIGHT_WIDTH} ${WEIGHT_HEIGHT}`;
  readonly left = WEIGHT_PLOT_LEFT;
  readonly right = WEIGHT_PLOT_RIGHT;

  readonly chart = computed(() => weightProjection(this.insight()));
}
