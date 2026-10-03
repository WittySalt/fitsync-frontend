import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { shortDateLabel } from '../../../shared/date-label';
import { daysBetween, formatNumber, shiftDay } from '../../../shared/progress/progress-format';
import { GoalProgress, WeightGoal } from '../progress-api.models';

const WIDTH = 600;
const X0 = 44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

type Weight = GoalProgress['weight'];

interface Pt {
  x: number;
  y: number;
}

export interface WeightChartGeometry {
  ticks: { y: number; text: string }[];
  months: { x: number; text: string }[];
  dots: Pt[];
  line: string;
  first: Pt & { text: string };
  now: Pt & { text: string };
  projection: { line: string; end: Pt; text: string } | null;
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
 * clear of the projection.
 */
export function weightChartGeometry(
  weight: Weight,
  goal: WeightGoal | null,
  today: string,
  height: number,
  cardView: boolean,
  compact: boolean
): WeightChartGeometry | null {
  const weeks = weight.weekly.map((w) => ({ date: shiftDay(w.weekStart, 3), kg: w.avgKg }));
  const line = weeks.length >= 2 ? weeks : weight.daily.map((d) => ({ date: d.date, kg: d.kg }));
  if (line.length < 2) {
    return null;
  }
  const target = goal?.targetKg ?? null;
  const projection = weight.projection;
  const dates = [...line.map((p) => p.date), ...weight.daily.map((d) => d.date), ...projection.map((p) => p.date), today];
  if (goal?.byDate) {
    dates.push(goal.byDate);
  }
  const d0 = dates.reduce((a, b) => (a < b ? a : b));
  const d1 = dates.reduce((a, b) => (a > b ? a : b));
  const kgs = [...line.map((p) => p.kg), ...weight.daily.map((d) => d.kg), ...projection.map((p) => p.kg), ...(target === null ? [] : [target])];
  const step = Math.max(...kgs) - Math.min(...kgs) > 6 ? 2 : 1;
  const lo = Math.floor((Math.min(...kgs) - 0.5) / step) * step;
  const hi = Math.ceil((Math.max(...kgs) + 0.5) / step) * step;
  const x1 = WIDTH - (cardView ? 8 : 10);
  const top = 26;
  const bottom = height - 22;
  const span = Math.max(daysBetween(d0, d1), 1);
  const x = (date: string) => X0 + ((x1 - X0) * daysBetween(d0, date)) / span;
  const y = (kg: number) => top + ((bottom - top) * (hi - kg)) / (hi - lo || 1);
  const ticks: WeightChartGeometry['ticks'] = [];
  for (let v = lo + step; v < hi; v += step) {
    ticks.push({ y: y(v), text: `${formatNumber(v)} kg` });
  }
  const months: WeightChartGeometry['months'] = [];
  let cursor = `${d0.slice(0, 8)}01`;
  while (cursor <= d1) {
    if (cursor >= d0) {
      const month = MONTHS[Number(cursor.slice(5, 7)) - 1];
      months.push({ x: x(cursor), text: compact ? month : `1 ${month}` });
    }
    const [yy, mm] = cursor.split('-').map(Number);
    cursor = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  }
  const lastDaily = weight.daily.at(-1);
  const nowPoint = lastDaily ? { date: lastDaily.date, kg: lastDaily.kg } : line[line.length - 1];
  const reference = new Date(Number(today.slice(0, 4)), 0, 1);
  const projEnd = projection.length >= 2 ? projection[projection.length - 1] : null;
  const mark = !cardView && weight.rateChangeMark ? weeks.find((w) => w.date >= weight.rateChangeMark!.date) ?? null : null;
  return {
    ticks,
    months,
    dots: cardView ? [] : weight.daily.map((d) => ({ x: x(d.date), y: y(d.kg) })),
    line: line.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' '),
    first: { x: x(line[0].date), y: y(line[0].kg), text: formatNumber(line[0].kg, 1) },
    now: { x: x(nowPoint.date), y: y(nowPoint.kg), text: `${formatNumber(nowPoint.kg, 1)} kg` },
    projection: projEnd
      ? {
          line: projection.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' '),
          end: { x: x(projEnd.date), y: y(projEnd.kg) },
          text: cardView || compact ? shortDateLabel(projEnd.date, reference) : `${shortDateLabel(projEnd.date, reference)} at this pace`
        }
      : null,
    goal:
      target === null
        ? null
        : {
            y: y(target),
            text: goal?.byDate ? `Goal ${formatNumber(target, 1)} kg by ${shortDateLabel(goal.byDate, reference)}` : `Goal ${formatNumber(target, 1)} kg`,
            labelY: cardView ? top - 12 : y(target) - 8,
            byX: goal?.byDate ? x(goal.byDate) : null
          },
    today: today >= d0 && today <= d1 ? x(today) : null,
    mark: mark && weight.rateChangeMark ? { x: x(mark.date), y: y(mark.kg), text: weight.rateChangeMark.text } : null,
    x0: X0,
    x1,
    bottom
  };
}

@Component({
  selector: 'app-goal-weight-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 600 ' + height()" role="img" [attr.aria-label]="summary()">
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
          <circle class="dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.2"></circle>
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
          <circle class="end" [attr.cx]="p.end.x" [attr.cy]="p.end.y" r="4.5"></circle>
          <text class="label halo" [attr.x]="p.end.x" [attr.y]="p.end.y + 18" text-anchor="end">{{ p.text }}</text>
        }
        <circle class="start" [attr.cx]="g.first.x" [attr.cy]="g.first.y" r="3"></circle>
        <text class="axis halo" [attr.x]="g.first.x + 2" [attr.y]="g.first.y - 10">{{ g.first.text }}</text>
        <circle class="now" [attr.cx]="g.now.x" [attr.cy]="g.now.y" r="4.5"></circle>
        <text class="label strong halo" [attr.x]="g.now.x - 8" [attr.y]="g.now.y + 16" text-anchor="end">{{ g.now.text }}</text>
        @if (g.mark; as m) {
          <line class="mark-line" [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="m.y - 30" [attr.y2]="m.y - 6"></line>
          <rect class="mark" [attr.x]="m.x - 9" [attr.y]="m.y - 48" width="18" height="18" rx="6"></rect>
          <text class="mark-c" [attr.x]="m.x" [attr.y]="m.y - 39" text-anchor="middle" dominant-baseline="central">C</text>
          <text class="label halo" [attr.x]="m.x + 14" [attr.y]="m.y - 39" dominant-baseline="central">{{ m.text }}</text>
        }
        @for (month of g.months; track $index) {
          <text class="axis" [attr.x]="month.x" [attr.y]="height() - 5" text-anchor="middle">{{ month.text }}</text>
        }
        <line class="base" [attr.x1]="g.x0" [attr.x2]="g.x1" [attr.y1]="g.bottom" [attr.y2]="g.bottom"></line>
      </svg>
    } @else {
      <p class="none">Not enough data yet. Two weeks of weigh-ins draw the line.</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); }
    .base { stroke: var(--border-strong); }
    .today { stroke: var(--border-strong); stroke-dasharray: 2 3; }
    .dot { fill: var(--border-strong); }
    .goal { stroke: var(--accent-text); stroke-dasharray: 4 4; }
    .goal-tick { stroke: var(--accent-text); stroke-width: 2; }
    .line { fill: none; stroke: var(--accent); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
    .projection { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 3 5; }
    .start, .now { fill: var(--surface); stroke: var(--accent); stroke-width: 2.5; }
    .end { fill: var(--accent); }
    .mark { fill: var(--accent); }
    .mark-line { stroke: var(--text-primary); }
    .mark-c { font: 700 11px var(--font-sans); fill: var(--text-on-accent); }
    text { font: 400 10px var(--font-sans); fill: var(--text-secondary); }
    .label { font-size: 11px; font-weight: 600; fill: var(--text-primary); }
    .strong { font-weight: 700; }
    .goal-text { font-size: 11px; font-weight: 700; fill: var(--accent-text); }
    .halo { paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
    .none { margin: 0; font-size: 13px; color: var(--text-secondary); }
  `
})
export class GoalWeightChartComponent {
  readonly weight = input.required<Weight>();
  readonly goal = input<WeightGoal | null>(null);
  readonly today = input.required<string>();
  readonly height = input(280);
  readonly cardView = input(false);
  readonly compact = input(false);

  protected readonly geometry = computed(() =>
    weightChartGeometry(this.weight(), this.goal(), this.today(), this.height(), this.cardView(), this.compact())
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
