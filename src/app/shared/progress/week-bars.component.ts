import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber, signed } from './progress-format';
import { WeekBar } from './progress.models';

const WIDTH = 320;
const X0 = 40;

interface BarRect {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeekBarsGeometry {
  bars: { rects: BarRect[]; cx: number; valueY: number; valueText: string; label: string; showLabel: boolean; current: boolean }[];
  ticks: { y: number; text: string; zero: boolean }[];
  plotBottom: number;
}

/** A tidy step for the grid: 1, 2 or 5 times a power of ten. */
export function niceStep(span: number): number {
  const rough = span / 3 || 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  return step;
}

/**
 * Bars for a run of weeks on one scale, with a zero line, so a week under (negative) hangs below
 * it and a week over stands on it. Segments stack in the order given. Labels thin out to every
 * other week when there are more than six.
 */
export function weekBarsGeometry(bars: readonly WeekBar[], height: number, signedValues: boolean, unit: string): WeekBarsGeometry | null {
  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);
  if (!values.length) {
    return null;
  }
  const step = niceStep(Math.max(...values, 0) - Math.min(...values, 0));
  const hi = Math.max(0, Math.ceil(Math.max(...values) / step) * step);
  const lo = Math.min(0, Math.floor(Math.min(...values) / step) * step);
  const top = 18;
  const bottom = height - 30;
  const y = (v: number) => top + ((bottom - top) * (hi - v)) / (hi - lo || 1);
  const slot = (WIDTH - X0) / bars.length;
  const width = Math.min(30, slot * 0.56);
  const ticks: WeekBarsGeometry['ticks'] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    ticks.push({ y: y(v), text: signedValues ? signed(v, 0) : formatNumber(v), zero: v === 0 });
  }
  return {
    ticks,
    plotBottom: bottom,
    bars: bars.map((bar, k) => {
      const cx = X0 + slot * k + slot / 2;
      const value = bar.value ?? 0;
      const rects: BarRect[] = [];
      const parts = bar.segments?.length ? bar.segments : [{ key: 'VALUE', value }];
      let base = 0;
      for (const part of parts) {
        const from = y(base);
        const to = y(base + part.value);
        rects.push({ key: part.key, x: cx - width / 2, y: Math.min(from, to), width, height: Math.max(Math.abs(to - from), 0) });
        base += part.value;
      }
      const valueText = bar.valueLabel ?? (bar.value === null ? '–' : `${signedValues ? signed(value, 0) : formatNumber(value)}${unit ? ' ' + unit : ''}`);
      return {
        rects,
        cx,
        valueY: value < 0 ? y(value) + 13 : y(value) - 6,
        valueText,
        label: bar.label,
        showLabel: bars.length <= 6 || k % 2 === (bars.length - 1) % 2,
        current: bar.current === true
      };
    })
  };
}

/** A week-by-week bar chart with value labels, an axis, and the current week drawn lighter. */
@Component({
  selector: 'app-week-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 320 ' + height()" role="img" [attr.aria-label]="summary()">
        @for (tick of g.ticks; track $index) {
          <line [class.zero]="tick.zero" class="grid" x1="36" x2="320" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text class="axis" x="32" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ tick.text }}</text>
        }
        @for (bar of g.bars; track $index) {
          @for (rect of bar.rects; track $index) {
            <rect [attr.data-key]="rect.key" [class.current]="bar.current" [attr.x]="rect.x" [attr.y]="rect.y" [attr.width]="rect.width" [attr.height]="rect.height" rx="4"></rect>
          }
          <text class="value" [attr.x]="bar.cx" [attr.y]="bar.valueY" text-anchor="middle">{{ bar.valueText }}</text>
          @if (bar.showLabel) {
            <text class="axis" [attr.x]="bar.cx" [attr.y]="g.plotBottom + 16" text-anchor="middle">{{ bar.label }}</text>
          }
          @if (bar.current) {
            <text class="now" [attr.x]="bar.cx" [attr.y]="g.plotBottom + 28" text-anchor="middle">this week</text>
          }
        }
      </svg>
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); }
    .grid.zero { stroke: var(--border-strong); }
    rect { fill: var(--accent); }
    rect.current { opacity: .7; }
    rect[data-key='STRENGTH'] { fill: var(--accent-text); }
    rect[data-key='SPORT'] { fill: color-mix(in srgb, var(--accent) 55%, var(--surface)); }
    rect[data-key='MOBILITY'] { fill: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
    text { font: 400 10px var(--font-sans); fill: var(--text-secondary); }
    .value { font-size: 11px; font-weight: 700; fill: var(--text-primary); }
    .now { font-weight: 600; fill: var(--text-primary); }
    .none { margin: 0; font-size: var(--text-xs); color: var(--text-secondary); }
  `
})
export class WeekBarsComponent {
  readonly bars = input.required<readonly WeekBar[]>();
  readonly height = input(160);
  /** Values that can be below zero, written with a sign. */
  readonly signed = input(false);
  readonly unit = input('');
  readonly label = input('Each week');

  protected readonly geometry = computed(() => weekBarsGeometry(this.bars(), this.height(), this.signed(), this.unit()));
  protected readonly summary = computed(() => {
    const parts = this.bars().map((bar) => `${bar.label} ${bar.valueLabel ?? (bar.value === null ? 'none' : formatNumber(bar.value))}`);
    return `${this.label()}: ${parts.join(', ')}`;
  });
}
