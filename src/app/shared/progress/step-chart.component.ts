import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { measureWidth } from './measure-width';
import { daysBetween, formatNumber, hoursAndMinutes, pointLabel, textWidth } from './progress-format';

const WIDTH = 300;
const X0 = 44;
const SIZE = 12;

export interface StepPoint {
  date: string;
  /** The running total on that date. */
  value: number;
}

export interface StepGeometry {
  path: string;
  end: { x: number; y: number };
  ticks: { y: number; value: number }[];
  x0: number;
  x1: number;
  /** The date at the left edge of the plot is left-aligned to it and the one at the right edge right-aligned; never any in between. */
  fromX: number;
  toX: number;
}

/**
 * A running total drawn as steps: flat between sessions, rising at each one. The scale can be
 * shared between several charts by passing the same `max`, so their heights compare.
 */
export function stepGeometry(
  points: readonly StepPoint[],
  from: string,
  to: string,
  height: number,
  max: number | null,
  width = WIDTH,
  labels: { from: string; to: string } = { from: '', to: '' }
): StepGeometry | null {
  const span = daysBetween(from, to);
  if (!points.length || !(span > 0)) {
    return null;
  }
  const top = 8;
  // The bottom 24 units hold the date labels.
  const bottom = height - 24;
  const last = points[points.length - 1].value;
  const hi = Math.max(max ?? 0, last, 1);
  const x1 = width - textWidth(formatTotal(last), SIZE, true) - 16;
  const x = (date: string) => X0 + ((x1 - X0) * Math.min(Math.max(daysBetween(from, date), 0), span)) / span;
  const y = (value: number) => bottom - ((bottom - top) * value) / hi;
  let path = `M${X0} ${y(0).toFixed(1)}`;
  for (const point of points) {
    path += ` H${x(point.date).toFixed(1)} V${y(point.value).toFixed(1)}`;
  }
  path += ` H${x1}`;
  // Two dates that would touch push the last one to the right, into the room the total label leaves.
  const needed = textWidth(labels.from, SIZE) + textWidth(labels.to, SIZE) + 10;
  const toX = Math.min(Math.max(x1, X0 + needed), width);
  return { path, end: { x: x1, y: y(last) }, ticks: [0, hi / 2, hi].map((value) => ({ y: y(value), value })), x0: X0, x1, fromX: X0, toX };
}

const formatTotal = (minutes: number): string => (minutes ? hoursAndMinutes(minutes) : '0');

/** The cumulative chart of an activity: total time (or any running total) across the period. */
@Component({
  selector: 'app-step-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.px]="width()" role="img" [attr.aria-label]="summary()" [attr.data-kind]="kind()">
        @for (tick of g.ticks; track $index) {
          <line class="grid" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text class="axis" [attr.x]="g.x0 - 6" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ format(tick.value) }}</text>
        }
        <path class="step" [attr.d]="g.path"></path>
        <circle class="dot" [attr.cx]="g.end.x" [attr.cy]="g.end.y" r="3"></circle>
        <text class="total" [attr.x]="g.end.x + 8" [attr.y]="g.end.y" dominant-baseline="central">{{ format(total()) }}</text>
        <text class="axis" [attr.x]="g.fromX" [attr.y]="height() - 3">{{ fromLabel() }}</text>
        <text class="axis" [attr.x]="g.toX" [attr.y]="height() - 3" text-anchor="end">{{ toLabel() }}</text>
      </svg>
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); }
    .step { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; }
    .dot { fill: var(--accent); }
    [data-kind='STRENGTH'] { --step: var(--accent-text); }
    [data-kind='SPORT'] { --step: color-mix(in srgb, var(--accent) 55%, var(--surface)); }
    [data-kind='MOBILITY'] { --step: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
    [data-kind] .step { stroke: var(--step, var(--accent)); }
    [data-kind] .dot { fill: var(--step, var(--accent)); }
    text { font: 400 var(--pg-chart) var(--font-sans); fill: var(--text-secondary); }
    .total { font-weight: 600; fill: var(--text-primary); }
    .none { margin: 0; font-size: var(--pg-chart); color: var(--text-secondary); }
  `
})
export class StepChartComponent {
  readonly points = input.required<readonly StepPoint[]>();
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** A shared top of the scale, so several charts compare. */
  readonly max = input<number | null>(null);
  /** 'minutes' writes values as "2 h 30"; 'number' writes them as plain numbers. */
  readonly valueFormat = input<'minutes' | 'number'>('minutes');
  readonly height = input(84);
  readonly label = input('Total time');
  /** The kind of training, which picks the line's shade the way the week bars do (STRENGTH, SPORT, MOBILITY). */
  readonly kind = input<string | null>(null);

  protected readonly width = measureWidth(WIDTH);
  protected readonly fromLabel = computed(() => pointLabel(this.from()));
  protected readonly toLabel = computed(() => pointLabel(this.to()));
  protected readonly geometry = computed(() =>
    stepGeometry(this.points(), this.from(), this.to(), this.height(), this.max(), this.width(), { from: this.fromLabel(), to: this.toLabel() })
  );
  protected readonly total = computed(() => this.points().at(-1)?.value ?? 0);
  protected readonly summary = computed(() => `${this.label()}: ${this.format(this.total())} from ${this.fromLabel()} to ${this.toLabel()}`);

  format(value: number): string {
    return this.valueFormat() === 'minutes' ? formatTotal(value) : formatNumber(value);
  }
}
