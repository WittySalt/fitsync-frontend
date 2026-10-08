import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { shortDateLabel } from '../../../shared/date-label';
import { PlacedLabel, timeAxisLabels } from '../../../shared/progress/chart-axis';
import { measureWidth } from '../../../shared/progress/measure-width';
import { daysBetween, formatNumber, shiftDay, textWidth } from '../../../shared/progress/progress-format';
import { GoalProgress, WeightGoal } from '../progress-api.models';

const WIDTH = 600;
const X0 = 52;
/** Under this plot width the goal label shortens to "Goal 68 kg · 11 Dec". */
const SHORT_LABEL_BELOW = 560;
/** What the pace label needs under the goal line: its baseline drop and its descenders. */
const PACE_LABEL_DROP = 22;

type Weight = GoalProgress['weight'];

interface Pt {
  x: number;
  y: number;
}

export interface WeightChartGeometry {
  ticks: { y: number; text: string }[];
  /** Week dates or month names along the bottom, none touching the one before. */
  labels: PlacedLabel[];
  dots: Pt[];
  line: string;
  first: Pt & { text: string };
  now: Pt & { text: string };
  /** The pace label sits below the goal line, ending at the end of the line or running right from the axis when it is wider. */
  projection: { line: string; end: Pt; text: string; labelY: number; labelX: number; anchor: 'start' | 'end' } | null;
  goal: { y: number; text: string; labelY: number; byX: number | null } | null;
  today: number | null;
  mark: (Pt & { text: string }) | null;
  x0: number;
  x1: number;
  bottom: number;
}

/**
 * The weight chart: each week's average as the line, each weigh-in as a grey dot, the carried-forward
 * pace as a dashed line to the goal, the goal as a dashed level with its date, and a quiet line at
 * today. On the card the dots and the coach's mark are left out and the goal label sits top right,
 * clear of the projection. `width` is the pixel width the chart is drawn at.
 */
export function weightChartGeometry(
  weight: Weight,
  goal: WeightGoal | null,
  today: string,
  height: number,
  cardView: boolean,
  compact: boolean,
  width = WIDTH,
  since: string | null = null
): WeightChartGeometry | null {
  const inWindow = (date: string) => since === null || date >= since;
  const daily = weight.daily.filter((d) => inWindow(d.date));
  // A weekly average is drawn at its Thursday, the middle of its week.
  const weeks = weight.weekly.map((w) => ({ date: shiftDay(w.weekStart, 3), kg: w.avgKg })).filter((w) => inWindow(w.date));
  const line = weeks.length >= 2 ? weeks : daily.map((d) => ({ date: d.date, kg: d.kg }));
  if (line.length < 2) {
    return null;
  }
  const target = goal?.targetKg ?? null;
  const projection = weight.projection;
  const dates = [...line.map((p) => p.date), ...daily.map((d) => d.date), ...projection.map((p) => p.date), today];
  if (since !== null) {
    // The axis starts where the chosen range starts, so a longer range shows more room before the first weigh-in.
    dates.push(since);
  }
  if (goal?.byDate) {
    dates.push(goal.byDate);
  }
  const d0 = dates.reduce((a, b) => (a < b ? a : b));
  const d1 = dates.reduce((a, b) => (a > b ? a : b));
  const kgs = [...line.map((p) => p.kg), ...daily.map((d) => d.kg), ...projection.map((p) => p.kg), ...(target === null ? [] : [target])];
  // Grid lines every kilo, or every two when the weights span more than 6 kg.
  const step = Math.max(...kgs) - Math.min(...kgs) > 6 ? 2 : 1;
  let lo = Math.floor((Math.min(...kgs) - 0.5) / step) * step;
  const hi = Math.ceil((Math.max(...kgs) + 0.5) / step) * step;
  const x1 = width - 12;
  const top = 26;
  const bottom = height - 26;
  const span = Math.max(daysBetween(d0, d1), 1);
  const x = (date: string) => X0 + ((x1 - X0) * daysBetween(d0, date)) / span;
  const y = (kg: number) => top + ((bottom - top) * (hi - kg)) / (hi - lo || 1);
  // The pace label hangs under the goal line, so the scale gives the line room above the axis.
  for (let tries = 0; target !== null && !cardView && projection.length >= 2 && y(target) + PACE_LABEL_DROP > bottom && tries < 4; tries += 1) {
    lo -= step;
  }
  const ticks: WeightChartGeometry['ticks'] = [];
  for (let v = lo + step; v < hi; v += step) {
    ticks.push({ y: y(v), text: `${formatNumber(v)} kg` });
  }
  const lastDaily = daily.at(-1);
  const nowPoint = lastDaily ? { date: lastDaily.date, kg: lastDaily.kg } : line[line.length - 1];
  const reference = new Date(Number(today.slice(0, 4)), 0, 1);
  const projEnd = projection.length >= 2 ? projection[projection.length - 1] : null;
  const short = x1 - X0 < SHORT_LABEL_BELOW;
  const paceText = projEnd ? (cardView || compact ? shortDateLabel(projEnd.date, reference) : `${shortDateLabel(projEnd.date, reference)} at this pace`) : '';
  const paceEnd = projEnd ? x(projEnd.date) : 0;
  const paceFits = textWidth(paceText, 11) <= paceEnd - X0;
  const mark = !cardView && weight.rateChangeMark ? weeks.find((w) => w.date >= weight.rateChangeMark!.date) ?? null : null;
  return {
    ticks,
    labels: timeAxisLabels(d0, d1, x),
    dots: cardView ? [] : daily.map((d) => ({ x: x(d.date), y: y(d.kg) })),
    line: line.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' '),
    first: { x: x(line[0].date), y: y(line[0].kg), text: formatNumber(line[0].kg, 1) },
    now: { x: x(nowPoint.date), y: y(nowPoint.kg), text: `${formatNumber(nowPoint.kg, 1)} kg` },
    projection: projEnd
      ? {
          line: projection.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' '),
          end: { x: paceEnd, y: y(projEnd.kg) },
          text: paceText,
          labelY: y(projEnd.kg) + 18,
          labelX: paceFits ? paceEnd : X0 + 2,
          anchor: paceFits ? 'end' : 'start'
        }
      : null,
    goal:
      target === null
        ? null
        : {
            y: y(target),
            text: goalText(target, goal?.byDate ?? null, short, reference),
            labelY: cardView ? top - 12 : y(target) - 6,
            byX: goal?.byDate ? x(goal.byDate) : null
          },
    today: today >= d0 && today <= d1 ? x(today) : null,
    mark: mark && weight.rateChangeMark ? { x: x(mark.date), y: y(mark.kg), text: weight.rateChangeMark.text } : null,
    x0: X0,
    x1,
    bottom
  };
}

/** "Goal 68.0 kg by 11 Dec", or "Goal 68 kg · 11 Dec" where the plot is narrow. */
function goalText(target: number, byDate: string | null, short: boolean, reference: Date): string {
  const kg = formatNumber(target, short ? (Number.isInteger(target) ? 0 : 1) : 1);
  if (!byDate) {
    return `Goal ${kg} kg`;
  }
  const date = shortDateLabel(byDate, reference);
  return short ? `Goal ${kg} kg · ${date}` : `Goal ${kg} kg by ${date}`;
}

@Component({
  selector: 'app-goal-weight-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.px]="width()" role="img" [attr.aria-label]="summary()">
        @for (tick of g.ticks; track $index) {
          <line class="grid" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="tick.y" [attr.y2]="tick.y"></line>
          <text class="axis" [attr.x]="g.x0 - 8" [attr.y]="tick.y" text-anchor="end" dominant-baseline="central">{{ tick.text }}</text>
        }
        @if (g.today !== null) {
          <line class="today" [attr.x1]="g.today" [attr.x2]="g.today" y1="18" [attr.y2]="g.bottom"></line>
          @if (!cardView()) {
            <text class="axis strong" [attr.x]="g.today + 4" y="14">today</text>
          }
        }
        @for (dot of g.dots; track $index) {
          <circle class="dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2"></circle>
        }
        @if (g.goal; as goal) {
          <line class="goal" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="goal.y" [attr.y2]="goal.y"></line>
          @if (goal.byX !== null) {
            <line class="goal-tick" [attr.x1]="goal.byX" [attr.x2]="goal.byX" [attr.y1]="goal.y - 6" [attr.y2]="goal.y + 6"></line>
          }
          <text class="goal-text halo" [attr.x]="g.x1" [attr.y]="goal.labelY" text-anchor="end">{{ goal.text }}</text>
        }
        <polyline class="line" [attr.points]="g.line"></polyline>
        @if (g.projection; as p) {
          <polyline class="projection" [attr.points]="p.line"></polyline>
          <circle class="end" [attr.cx]="p.end.x" [attr.cy]="p.end.y" r="3"></circle>
          <text class="label halo" [attr.x]="p.labelX" [attr.y]="p.labelY" [attr.text-anchor]="p.anchor">{{ p.text }}</text>
        }
        <circle class="start" [attr.cx]="g.first.x" [attr.cy]="g.first.y" r="3"></circle>
        <text class="axis halo" [attr.x]="g.first.x + 2" [attr.y]="g.first.y - 10">{{ g.first.text }}</text>
        <circle class="now" [attr.cx]="g.now.x" [attr.cy]="g.now.y" r="3"></circle>
        <text class="label strong halo" [attr.x]="g.now.x - 8" [attr.y]="g.now.y + 16" text-anchor="end">{{ g.now.text }}</text>
        @if (g.mark; as m) {
          <line class="mark-line" [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="m.y - 30" [attr.y2]="m.y - 6"></line>
          <rect class="mark" [attr.x]="m.x - 9" [attr.y]="m.y - 48" width="18" height="18" rx="4"></rect>
          <text class="mark-c" [attr.x]="m.x" [attr.y]="m.y - 39" text-anchor="middle" dominant-baseline="central">C</text>
          <text class="label halo" [attr.x]="m.x + 14" [attr.y]="m.y - 39" dominant-baseline="central">{{ m.text }}</text>
        }
        @for (label of g.labels; track $index) {
          <text class="axis" [attr.x]="label.x" [attr.y]="height() - 6" [attr.text-anchor]="label.anchor">{{ label.text }}</text>
        }
        <line class="base" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="g.bottom" [attr.y2]="g.bottom"></line>
      </svg>
    } @else {
      <p class="none">Not enough data yet. Two weeks of weigh-ins draw the line.</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .base { stroke: var(--border-strong); stroke-width: 1; }
    .today { stroke: var(--border-strong); stroke-dasharray: 2 3; }
    .dot { fill: var(--border-strong); }
    .goal { stroke: var(--accent-text); stroke-width: 1; stroke-dasharray: 4 4; }
    .goal-tick { stroke: var(--accent-text); stroke-width: 2; }
    .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .projection { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 3 5; }
    .start { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
    .now, .end { fill: var(--accent); }
    .mark { fill: var(--accent); }
    .mark-line { stroke: var(--text-primary); stroke-width: 1; }
    .mark-c { font: 700 var(--pg-chart) var(--font-sans); fill: var(--text-on-accent); }
    text { font: 400 var(--pg-chart) var(--font-sans); fill: var(--text-secondary); }
    .label { font-weight: 500; fill: var(--text-primary); }
    .strong { font-weight: 600; }
    .goal-text { font-weight: 600; fill: var(--accent-text); }
    .halo { paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
    .none { margin: 0; font-size: var(--pg-text); color: var(--text-secondary); }
  `
})
export class GoalWeightChartComponent {
  readonly weight = input.required<Weight>();
  readonly goal = input<WeightGoal | null>(null);
  readonly today = input.required<string>();
  readonly height = input(280);
  readonly cardView = input(false);
  readonly compact = input(false);
  /** The first day of the chosen range; the line starts there and nothing older is drawn. */
  readonly since = input<string | null>(null);

  protected readonly width = measureWidth(WIDTH);
  protected readonly geometry = computed(() =>
    weightChartGeometry(this.weight(), this.goal(), this.today(), this.height(), this.cardView(), this.compact(), this.width(), this.since())
  );

  protected readonly summary = computed(() => {
    const g = this.geometry();
    if (!g) {
      return '';
    }
    const parts = [`Weight from ${g.first.text} kg to ${g.now.text}`];
    if (g.projection) {
      parts.push(`at this pace the goal is reached on ${g.projection.text.replace(' at this pace', '')}`);
    }
    if (g.goal) {
      parts.push(g.goal.text);
    }
    return parts.join('. ');
  });
}
