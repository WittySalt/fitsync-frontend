import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { measureWidth } from './measure-width';
import { formatNumber, pointLabel, textWidth } from './progress-format';
import { SeriesPoint } from './progress.models';

const WIDTH = 300;
const SIZE = 12;

export interface SmallTrendGeometry {
  line: string;
  start: { x: number; y: number; text: string };
  end: { x: number; y: number; text: string };
  target: { y: number; x1: number; x2: number; text: string } | null;
}

/**
 * Where a small trend line goes: the start value sits left of the first point and the end value
 * right of the last, so the line takes the room between them. A target, when given, is part of the
 * scale, so its dashed line is always inside the box.
 */
export function smallTrendGeometry(
  values: readonly number[],
  height: number,
  startText: string,
  endText: string,
  target: number | null,
  targetText: string,
  width = WIDTH
): SmallTrendGeometry | null {
  if (values.length < 2) {
    return null;
  }
  const left = textWidth(startText, SIZE) + 10;
  const right = textWidth(endText, SIZE, true) + 10;
  const scale = target === null ? values : [...values, target];
  const lo = Math.min(...scale);
  const hi = Math.max(...scale);
  const top = target === null ? 6 : 18;
  const x = (i: number) => left + ((width - left - right) * i) / (values.length - 1);
  const y = (v: number) => height - 6 - ((height - 6 - top) * (v - lo)) / (hi - lo || 1);
  const last = values.length - 1;
  return {
    line: values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '),
    start: { x: x(0), y: y(values[0]), text: startText },
    end: { x: x(last), y: y(values[last]), text: endText },
    target: target === null ? null : { y: y(target), x1: left, x2: width - right, text: targetText }
  };
}

/**
 * A small trend line with its start value on the left, its end value on the right, the first and
 * last dates underneath and, when given, a dashed target line with a haloed label. It draws at the
 * pixel width of its host, so its text is never scaled. Fewer than two points say so in words; an
 * empty chart is never drawn.
 */
@Component({
  selector: 'app-small-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <figure class="trend">
        <svg [attr.viewBox]="'0 0 ' + drawWidth() + ' ' + height()" [style.width.px]="drawWidth()" role="img" [attr.aria-label]="summary()">
          @if (g.target; as t) {
            <line class="target" [attr.x1]="t.x1" [attr.x2]="t.x2" [attr.y1]="t.y" [attr.y2]="t.y"></line>
            <text class="target-text halo" [attr.x]="t.x2 - 2" [attr.y]="t.y - 5" text-anchor="end">{{ t.text }}</text>
          }
          <polyline class="line" [attr.points]="g.line"></polyline>
          <circle class="first" [attr.cx]="g.start.x" [attr.cy]="g.start.y" r="3"></circle>
          <circle class="last" [attr.cx]="g.end.x" [attr.cy]="g.end.y" r="3"></circle>
          <text class="start" [attr.x]="g.start.x - 8" [attr.y]="g.start.y" text-anchor="end" dominant-baseline="central">{{ g.start.text }}</text>
          <text class="end" [attr.x]="g.end.x + 8" [attr.y]="g.end.y" dominant-baseline="central">{{ g.end.text }}</text>
        </svg>
        @if (showDates()) {
          <figcaption class="dates"><span>{{ firstLabel() }}</span><span>{{ lastLabel() }}</span></figcaption>
        }
      </figure>
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .trend { margin: 0; display: flex; flex-direction: column; gap: 2px; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .first { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
    .last { fill: var(--accent); }
    .target { stroke: var(--accent-text); stroke-width: 1; stroke-dasharray: 4 4; }
    text { font: 400 var(--pg-chart) var(--font-sans); fill: var(--text-secondary); }
    .end { font-weight: 600; fill: var(--text-primary); }
    .target-text { font-weight: 500; fill: var(--accent-text); }
    .halo { paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
    .dates { display: flex; justify-content: space-between; font-size: var(--pg-chart); color: var(--text-secondary); }
    .none { margin: 0; font-size: var(--pg-chart); color: var(--text-secondary); }
  `
})
export class SmallTrendComponent {
  readonly points = input.required<readonly SeriesPoint[]>();
  readonly unit = input('');
  readonly digits = input(0);
  /** Text left of the first point; the first value when not given. */
  readonly startText = input<string | null>(null);
  /** Text right of the last point; the last value and the unit when not given. */
  readonly endText = input<string | null>(null);
  readonly target = input<number | null>(null);
  readonly targetText = input<string | null>(null);
  readonly height = input(56);
  /** A fixed width in pixels for a slot that is not the host's width; the host's own width when not given. */
  readonly width = input<number | null>(null);
  readonly showDates = input(true);
  readonly label = input('');

  private readonly measured = measureWidth(WIDTH);
  protected readonly drawWidth = computed(() => this.width() ?? this.measured());

  protected readonly geometry = computed(() => {
    const points = this.points();
    const values = points.map((p) => p.value);
    if (values.length < 2) {
      return null;
    }
    const unit = this.unit() ? ` ${this.unit()}` : '';
    const start = this.startText() ?? formatNumber(values[0], this.digits());
    const end = this.endText() ?? `${formatNumber(values[values.length - 1], this.digits())}${unit}`;
    const target = this.target();
    const targetText = this.targetText() ?? (target === null ? '' : `target ${formatNumber(target, this.digits())}${unit}`);
    return smallTrendGeometry(values, this.height(), start, end, target, targetText, this.drawWidth());
  });

  protected readonly firstLabel = computed(() => pointLabel(this.points()[0]?.label ?? ''));
  protected readonly lastLabel = computed(() => pointLabel(this.points().at(-1)?.label ?? ''));

  protected readonly summary = computed(() => {
    const g = this.geometry();
    if (!g) {
      return '';
    }
    const head = this.label() ? `${this.label()}: ` : '';
    return `${head}from ${g.start.text} on ${this.firstLabel()} to ${g.end.text} on ${this.lastLabel()}`;
  });
}
