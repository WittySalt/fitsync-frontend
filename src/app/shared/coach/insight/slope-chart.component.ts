import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { LiftProgress } from '../../../core/coach/coach.models';
import { SLOPE_HEIGHT, SLOPE_LEFT_X, SLOPE_RIGHT_X, SLOPE_WIDTH, slopeChart } from './slope-chart.geometry';

/**
 * The slope chart inside a Workout reading.
 *
 * One line for each lift, from an earlier session to the latest. It sits on the reading's dark
 * card, so its colours are the slate and green primitives and do not change with the theme.
 */
@Component({
  selector: 'app-slope-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chart(); as drawn) {
      <svg class="slope" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="drawn.description">
        <text class="heading" [attr.x]="leftX" y="14" text-anchor="middle">{{ drawn.fromHeading }}</text>
        <text class="heading" [attr.x]="rightX" y="14" text-anchor="middle">{{ drawn.toHeading }}</text>
        <line class="axis" [attr.x1]="leftX" y1="22" [attr.x2]="leftX" y2="120"></line>
        <line class="axis" [attr.x1]="rightX" y1="22" [attr.x2]="rightX" y2="120"></line>
        @for (line of drawn.lines; track line.fullName) {
          <line class="lift" [class.falling]="!line.rising" [attr.x1]="leftX" [attr.y1]="line.fromY" [attr.x2]="rightX" [attr.y2]="line.toY"></line>
          <circle class="from" [class.falling]="!line.rising" [attr.cx]="leftX" [attr.cy]="line.fromY" r="4.5"></circle>
          <circle class="to" [attr.cx]="rightX" [attr.cy]="line.toY" r="5"></circle>
          <text class="label" [attr.x]="leftX - 14" [attr.y]="line.fromLabelY" text-anchor="end">
            {{ line.name }} <tspan class="value">{{ line.fromText }}</tspan>
          </text>
          <text class="label value" [attr.x]="rightX + 14" [attr.y]="line.toLabelY">
            {{ line.toText }} <tspan class="change" [class.falling]="!line.rising">{{ line.changeText }}</tspan>
          </text>
        }
      </svg>
      <ul class="lift-list">
        @for (line of drawn.lines; track line.fullName) {
          <li>
            <span class="lift-name">{{ line.fullName }}</span>
            <span class="lift-values">
              {{ line.fromText }} to <strong>{{ line.toText }}</strong>
              @if (line.changeText) {
                <span class="lift-change" [class.falling]="!line.rising">{{ line.changeText }}</span>
              }
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      /* The drawing is scaled by its container, and under this width its labels would be too
         small to read. The same lifts are then written as a short list. */
      .lift-list {
        display: none;
        margin: 0;
        padding: 0;
        list-style: none;
        flex-direction: column;
        gap: 8px;
      }
      .lift-list li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        gap: 12px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--slate-300);
        font-variant-numeric: tabular-nums;
      }
      .lift-name {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .lift-values {
        white-space: nowrap;
      }
      .lift-values strong {
        color: var(--white);
      }
      .lift-change {
        margin-left: 6px;
        font-weight: 600;
        color: var(--green-400);
      }
      .lift-change.falling {
        color: var(--slate-300);
      }
      .slope {
        display: block;
        width: 100%;
        max-width: 540px;
        height: auto;
      }
      text {
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .heading {
        font-weight: 600;
        fill: var(--slate-300);
      }
      .axis {
        stroke: var(--slate-700);
        stroke-width: 1;
      }
      .lift {
        stroke: var(--green-500);
        stroke-width: 2.5;
        stroke-linecap: round;
      }
      .lift.falling {
        stroke: var(--slate-400);
      }
      .from {
        fill: var(--slate-900);
        stroke: var(--green-500);
        stroke-width: 2.5;
      }
      .from.falling {
        stroke: var(--slate-400);
      }
      .to {
        fill: var(--white);
      }
      .label {
        fill: var(--slate-300);
      }
      .value {
        font-weight: 700;
        fill: var(--white);
      }
      .change {
        font-weight: 600;
        fill: var(--green-400);
      }
      .change.falling {
        fill: var(--slate-300);
      }
      @container (max-width: 470px) {
        .slope {
          display: none;
        }
        .lift-list {
          display: flex;
        }
      }
    `
  ]
})
export class SlopeChartComponent {
  readonly lifts = input.required<LiftProgress[]>();

  readonly viewBox = `0 0 ${SLOPE_WIDTH} ${SLOPE_HEIGHT}`;
  readonly leftX = SLOPE_LEFT_X;
  readonly rightX = SLOPE_RIGHT_X;

  readonly chart = computed(() => slopeChart(this.lifts()));
}
