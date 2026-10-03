import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { shortDateLabel } from '../../../shared/date-label';
import { formatNumber, signed } from '../../../shared/progress/progress-format';

const WIDTH = 600;
const X0 = 44;
const RIGHT = 70;

export interface PaceWeek {
  weekStart: string;
  expectedKg: number | null;
  actualKg: number | null;
}

export interface PaceGeometry {
  ticks: { y: number; text: string; zero: boolean }[];
  expected: { line: string; dots: { x: number; y: number }[]; end: { y: number; text: string } | null };
  actual: { line: string; dots: { x: number; y: number }[]; end: { y: number; text: string } | null };
  labels: { x: number; text: string; anchor: string }[];
  origin: { x: number; y: number };
  x1: number;
}

/**
 * What the food log says the scale should show, week by week, against what the scale showed, both
 * as the change since the start. Each line starts at zero on the left; a week without a figure is
 * skipped rather than drawn as zero.
 */
export function paceGeometry(weeks: readonly PaceWeek[], height: number, compact: boolean): PaceGeometry | null {
  const values = weeks.flatMap((w) => [w.expectedKg, w.actualKg]).filter((v): v is number => v !== null);
  if (weeks.length < 2 || values.length < 2) {
    return null;
  }
  const lo = Math.min(0, Math.floor(Math.min(...values)));
  const hi = Math.max(0, Math.ceil(Math.max(...values)));
  const top = 14;
  const bottom = height - 22;
  const x1 = WIDTH - RIGHT;
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
  const reference = new Date(Number(weeks[0].weekStart.slice(0, 4)), 0, 1);
  return {
    ticks,
    expected: series((w) => w.expectedKg),
    actual: series((w) => w.actualKg),
    labels: weeks
      .map((w, k) => ({ x: x(k), text: shortDateLabel(w.weekStart, reference), anchor: k === weeks.length - 1 ? 'end' : 'middle', k }))
      .filter((label) => !compact || label.k % 2 === 1 || weeks.length <= 4),
    origin: { x: X0, y: y(0) },
    x1
  };
}

@Component({
  selector: 'app-pace-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 600 ' + height()" role="img" [attr.aria-label]="summary()">
        @for (tick of g.ticks; track $index) {
          <line class="grid" [class.zero]="tick.zero" x1="44" [attr.x2]="g.x1" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text [attr.x]="36" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ tick.text }}</text>
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
          <text class="end expected-text" [attr.x]="g.x1 + 8" [attr.y]="end.y" dominant-baseline="central">{{ end.text }}</text>
        }
        @if (g.actual.end; as end) {
          <text class="end" [attr.x]="g.x1 + 8" [attr.y]="end.y" dominant-baseline="central">{{ end.text }}</text>
        }
        @for (label of g.labels; track $index) {
          <text [attr.x]="label.x" [attr.y]="height() - 5" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
        }
      </svg>
    } @else {
      <p class="none">Not enough data yet. The log and the scale need a few weeks to compare.</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); }
    .grid.zero { stroke: var(--border-strong); }
    .actual { fill: none; stroke: var(--text-secondary); stroke-width: 2.5; stroke-linejoin: round; }
    .expected { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 4; }
    .expected-dot { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
    .actual-dot { fill: var(--text-secondary); }
    .origin { fill: var(--text-primary); }
    text { font: 400 10px var(--font-sans); fill: var(--text-secondary); }
    .end { font-size: 11px; font-weight: 700; fill: var(--text-primary); }
    .expected-text { fill: var(--accent-text); }
    .none { margin: 0; font-size: 13px; color: var(--text-secondary); }
  `
})
export class PaceChartComponent {
  readonly weeks = input.required<readonly PaceWeek[]>();
  readonly height = input(200);
  readonly compact = input(false);

  protected readonly geometry = computed(() => paceGeometry(this.weeks(), this.height(), this.compact()));
  protected readonly summary = computed(() => {
    const g = this.geometry();
    if (!g) {
      return '';
    }
    return `Expected from your food log ${g.expected.end?.text ?? 'unknown'}, on the scale ${g.actual.end?.text ?? 'unknown'}, over ${formatNumber(this.weeks().length)} weeks`;
  });
}
