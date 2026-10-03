import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PlacedLabel, fromFirstData, weekLabelMarks } from '../../../shared/progress/chart-axis';
import { measureWidth } from '../../../shared/progress/measure-width';
import { formatNumber, signed, textWidth } from '../../../shared/progress/progress-format';

const WIDTH = 600;
const X0 = 52;

export interface PaceWeek {
  weekStart: string;
  expectedKg: number | null;
  actualKg: number | null;
}

export interface PaceGeometry {
  ticks: { y: number; text: string; zero: boolean }[];
  expected: { line: string; dots: { x: number; y: number }[]; end: { y: number; text: string } | null };
  actual: { line: string; dots: { x: number; y: number }[]; end: { y: number; text: string } | null };
  labels: PlacedLabel[];
  origin: { x: number; y: number };
  x1: number;
}

/**
 * What the food log says the scale should show, week by week, against what the scale showed, both
 * as the change since the start. The run starts at the first week with a figure; each line starts
 * at zero on the left, and a later week without a figure is skipped rather than drawn as zero.
 */
export function paceGeometry(allWeeks: readonly PaceWeek[], height: number, width = WIDTH): PaceGeometry | null {
  const weeks = fromFirstData(allWeeks, (w) => w.expectedKg !== null || w.actualKg !== null);
  const values = weeks.flatMap((w) => [w.expectedKg, w.actualKg]).filter((v): v is number => v !== null);
  if (weeks.length < 2 || values.length < 2) {
    return null;
  }
  const lo = Math.min(0, Math.floor(Math.min(...values)));
  const hi = Math.max(0, Math.ceil(Math.max(...values)));
  const top = 14;
  const bottom = height - 26;
  const right = Math.max(...values.map((v) => textWidth(`${signed(v)} kg`, 12, true)), 40) + 18;
  const x1 = width - right;
  const x = (k: number) => X0 + ((x1 - X0) * (k + 1)) / weeks.length;
  const y = (v: number) => top + ((bottom - top) * (hi - v)) / (hi - lo || 1);
  const ticks: PaceGeometry['ticks'] = [];
  for (let v = hi; v >= lo; v -= 1) {
    ticks.push({ y: y(v), text: v === 0 ? '0' : `${signed(v, 0)} kg`, zero: v === 0 });
  }
  const series = (pick: (w: PaceWeek) => number | null) => {
    const points = weeks.map((w, k) => ({ k, v: pick(w) })).filter((p): p is { k: number; v: number } => p.v !== null);
    const last = points.at(-1);
    return {
      line: [`${X0},${y(0).toFixed(1)}`, ...points.map((p) => `${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`)].join(' '),
      dots: points.map((p) => ({ x: x(p.k), y: y(p.v) })),
      end: last ? { y: y(last.v), text: `${signed(last.v)} kg` } : null
    };
  };
  return {
    ticks,
    expected: series((w) => w.expectedKg),
    actual: series((w) => w.actualKg),
    labels: weekLabelMarks(
      weeks.map((w) => w.weekStart),
      x
    ),
    origin: { x: X0, y: y(0) },
    x1
  };
}

@Component({
  selector: 'app-pace-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.px]="width()" role="img" [attr.aria-label]="summary()">
        @for (tick of g.ticks; track $index) {
          <line class="grid" [class.zero]="tick.zero" [attr.x1]="g.origin.x" [attr.x2]="g.x1" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text [attr.x]="g.origin.x - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ tick.text }}</text>
        }
        <polyline class="actual" [attr.points]="g.actual.line"></polyline>
        <polyline class="expected" [attr.points]="g.expected.line"></polyline>
        @for (dot of g.expected.dots; track $index) {
          <circle class="expected-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="3"></circle>
        }
        @for (dot of g.actual.dots; track $index) {
          <circle class="actual-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="3"></circle>
        }
        <circle class="origin" [attr.cx]="g.origin.x" [attr.cy]="g.origin.y" r="3"></circle>
        @if (g.expected.end; as end) {
          <text class="end expected-text" [attr.x]="g.x1 + 10" [attr.y]="end.y" dominant-baseline="central">{{ end.text }}</text>
        }
        @if (g.actual.end; as end) {
          <text class="end" [attr.x]="g.x1 + 10" [attr.y]="end.y" dominant-baseline="central">{{ end.text }}</text>
        }
        @for (label of g.labels; track $index) {
          <text [attr.x]="label.x" [attr.y]="height() - 6" text-anchor="middle">{{ label.text }}</text>
        }
      </svg>
    } @else {
      <p class="none">Not enough data yet. The log and the scale need a few weeks to compare.</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .grid.zero { stroke: var(--border-strong); }
    .actual { fill: none; stroke: var(--text-secondary); stroke-width: 2; stroke-linejoin: round; }
    .expected { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 4; }
    .expected-dot { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
    .actual-dot { fill: var(--text-secondary); }
    .origin { fill: var(--text-primary); }
    text { font: 400 var(--pg-chart) var(--font-sans); fill: var(--text-secondary); }
    .end { font-weight: 600; fill: var(--text-primary); }
    .expected-text { fill: var(--accent-text); }
    .none { margin: 0; font-size: var(--pg-text); color: var(--text-secondary); }
  `
})
export class PaceChartComponent {
  readonly weeks = input.required<readonly PaceWeek[]>();
  readonly height = input(200);

  protected readonly width = measureWidth(WIDTH);
  protected readonly geometry = computed(() => paceGeometry(this.weeks(), this.height(), this.width()));
  protected readonly summary = computed(() => {
    const g = this.geometry();
    if (!g) {
      return '';
    }
    return `Expected from your food log ${g.expected.end?.text ?? 'unknown'}, on the scale ${g.actual.end?.text ?? 'unknown'}, over ${formatNumber(this.weeks().length)} weeks`;
  });
}
