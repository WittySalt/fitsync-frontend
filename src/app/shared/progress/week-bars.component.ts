import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AxisPeriod, PlacedLabel, dropColliding, fromFirstData, monthPointMarks, periodForWeeks, weekLabelMarks } from './chart-axis';
import { measureWidth } from './measure-width';
import { formatNumber, signed, textWidth } from './progress-format';
import { WeekBar } from './progress.models';

const WIDTH = 320;
const SIZE = 12;
/** A bar's slot needs this much room before every bar carries its value; otherwise only the last does. */
const VALUE_SLOT = 36;

interface BarRect {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeekBarsGeometry {
  bars: { rects: BarRect[]; cx: number; valueY: number; valueText: string; showValue: boolean; current: boolean }[];
  ticks: { y: number; text: string; zero: boolean }[];
  labels: PlacedLabel[];
  x0: number;
  x1: number;
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
 * it and a week over stands on it. Segments stack in the order given. The run starts at the first
 * week with a figure. Week labels follow the period (every week, every second week with month
 * names, or month starts) and a label that would touch the one before is dropped; a narrow slot
 * writes the value over the last bar only.
 */
export function weekBarsGeometry(
  allBars: readonly WeekBar[],
  height: number,
  signedValues: boolean,
  unit: string,
  width = WIDTH,
  period?: AxisPeriod,
  monthly = false
): WeekBarsGeometry | null {
  // Months keep every slot of the period, so a year with data in two months still shows twelve.
  const bars = monthly ? [...allBars] : fromFirstData(allBars, (bar) => bar.value !== null);
  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);
  if (!values.length) {
    return null;
  }
  const valueTexts = values.map((v) => (signedValues ? signed(v, 0) : formatNumber(v)));
  const x0 = Math.max(...valueTexts.map((text) => textWidth(text, SIZE)), 12) + 12;
  const x1 = width;
  const step = niceStep(Math.max(...values, 0) - Math.min(...values, 0));
  const hi = Math.max(0, Math.ceil(Math.max(...values) / step) * step);
  const lo = Math.min(0, Math.floor(Math.min(...values) / step) * step);
  const top = 22;
  const bottom = height - 28;
  const y = (v: number) => top + ((bottom - top) * (hi - v)) / (hi - lo || 1);
  const slot = (x1 - x0) / bars.length;
  const barWidth = Math.min(32, slot * 0.56);
  const ticks: WeekBarsGeometry['ticks'] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    ticks.push({ y: y(v), text: signedValues ? signed(v, 0) : formatNumber(v), zero: v === 0 });
  }
  const cxOf = (k: number) => x0 + slot * k + slot / 2;
  const dated = bars.every((bar) => !!bar.weekStart);
  const labels = dated && monthly
    ? monthPointMarks(bars.map((bar) => bar.weekStart as string), cxOf)
    : dated
    ? weekLabelMarks(bars.map((bar) => bar.weekStart as string), cxOf, period ?? periodForWeeks(bars.length))
    : dropColliding(
        bars
          .map((bar, k) => ({ x: cxOf(k), text: bar.label, anchor: 'middle' as const }))
          .filter((_, k) => bars.length <= 6 || k % 2 === (bars.length - 1) % 2)
      );
  return {
    ticks,
    labels,
    x0,
    x1,
    plotBottom: bottom,
    bars: bars.map((bar, k) => {
      const cx = cxOf(k);
      const value = bar.value ?? 0;
      const rects: BarRect[] = [];
      const parts = bar.segments?.length ? bar.segments : [{ key: 'VALUE', value }];
      let base = 0;
      for (const part of parts) {
        const from = y(base);
        const to = y(base + part.value);
        rects.push({ key: part.key, x: cx - barWidth / 2, y: Math.min(from, to), width: barWidth, height: Math.max(Math.abs(to - from), 0) });
        base += part.value;
      }
      const valueText = bar.valueLabel ?? (bar.value === null ? '–' : `${signedValues ? signed(value, 0) : formatNumber(value)}${unit ? ' ' + unit : ''}`);
      return {
        rects,
        cx,
        valueY: value < 0 ? y(value) + 16 : y(value) - 6,
        valueText,
        showValue: bar.value !== null && (slot >= VALUE_SLOT || k === bars.length - 1),
        current: bar.current === true
      };
    })
  };
}

/**
 * A week-by-week bar chart with value labels and an axis. The week still under way is drawn
 * lighter, and a line under the chart says so once.
 */
@Component({
  selector: 'app-week-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.px]="width()" role="img" [attr.aria-label]="summary()">
        @for (tick of g.ticks; track $index) {
          <line [class.zero]="tick.zero" class="grid" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text class="axis" [attr.x]="g.x0 - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ tick.text }}</text>
        }
        @for (bar of g.bars; track $index) {
          @for (rect of bar.rects; track $index) {
            <rect [attr.data-key]="rect.key" [class.current]="bar.current" [attr.x]="rect.x" [attr.y]="rect.y" [attr.width]="rect.width" [attr.height]="rect.height" [attr.rx]="radius(rect.width)"></rect>
          }
          @if (bar.showValue) {
            <text class="value" [attr.x]="bar.cx" [attr.y]="bar.valueY" text-anchor="middle">{{ bar.valueText }}</text>
          }
        }
        @for (label of g.labels; track $index) {
          <text class="axis" [attr.x]="label.x" [attr.y]="g.plotBottom + 20" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
        }
      </svg>
      @if (hasCurrent()) {
        <p class="key"><i class="swatch"></i>The lighter bar is this {{ monthly() ? 'month' : 'week' }} so far.</p>
      }
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .grid.zero { stroke: var(--border-strong); }
    rect { fill: var(--accent); }
    rect.current { opacity: .6; }
    rect[data-key='STRENGTH'] { fill: var(--accent-text); }
    rect[data-key='SPORT'] { fill: color-mix(in srgb, var(--accent) 55%, var(--surface)); }
    rect[data-key='MOBILITY'] { fill: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
    text { font: 400 var(--pg-chart) var(--font-sans); fill: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .value { font-weight: 600; fill: var(--text-primary); }
    .key { margin: 6px 0 0; display: flex; align-items: center; gap: 6px; font-size: var(--pg-chart); color: var(--text-secondary); }
    .swatch { width: 10px; height: 10px; border-radius: 4px; background: var(--accent); opacity: .6; }
    .none { margin: 0; font-size: var(--pg-chart); color: var(--text-secondary); }
  `
})
export class WeekBarsComponent {
  readonly bars = input.required<readonly WeekBar[]>();
  readonly height = input(160);
  /** Values that can be below zero, written with a sign. */
  readonly signed = input(false);
  readonly unit = input('');
  readonly label = input('Each week');
  /** Four weeks, three months or a year; worked out from the number of weeks when not given. */
  readonly period = input<AxisPeriod | null>(null);
  /** One bar per calendar month: `weekStart` of each bar is the month's first day and the axis names months. */
  readonly monthly = input(false);

  protected readonly width = measureWidth(WIDTH);
  protected readonly geometry = computed(() => weekBarsGeometry(this.bars(), this.height(), this.signed(), this.unit(), this.width(), this.period() ?? undefined, this.monthly()));
  protected readonly hasCurrent = computed(() => this.bars().some((bar) => bar.current === true && bar.value !== null));
  protected readonly summary = computed(() => {
    const parts = this.bars().map((bar) => `${bar.label} ${bar.valueLabel ?? (bar.value === null ? 'none' : formatNumber(bar.value))}`);
    return `${this.label()}: ${parts.join(', ')}`;
  });

  protected radius(width: number): number {
    return Math.min(4, width / 2);
  }
}
