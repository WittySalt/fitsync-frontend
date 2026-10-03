import { shortDateLabel } from '../../../shared/date-label';
import { daysBetween, formatNumber, signed } from '../../../shared/progress/progress-format';
import { BodySeries, GoalProgress } from '../progress-api.models';
import { HeroStat, SummaryLine } from '../../../shared/progress/progress.models';

/** A weekly change within this many kilograms of the one before reads as steady. */
const STEADY_RATE_KG = 0.02;

function date(key: string | null): string {
  return key ? shortDateLabel(key) : '';
}

/** True when the goal weight is below the current weight, so a falling rate is progress. */
export function isLosing(goal: GoalProgress): boolean {
  const target = goal.goal?.targetKg ?? null;
  const now = goal.hero.nowKg;
  return target === null || now === null ? true : target < now;
}

/** "faster", "slower" or "steady", read in the direction of the goal. */
export function rateWord(value: number, previous: number | null, losing: boolean): string {
  if (previous === null || Math.abs(value - previous) < STEADY_RATE_KG) {
    return 'steady';
  }
  const towardGoal = losing ? value < previous : value > previous;
  return towardGoal ? 'faster' : 'slower';
}

/** Whether the goal has any figure to show at all. */
export function hasWeight(goal: GoalProgress): boolean {
  return goal.hero.nowKg !== null || goal.weight.weekly.length > 0 || goal.weight.daily.length > 0;
}

/** "68 kg by 11 Dec", or a plainer title when the goal has no date or there is no goal. */
export function goalTitle(goal: GoalProgress): string {
  const target = goal.goal?.targetKg ?? null;
  if (target === null) {
    return 'No weight goal yet';
  }
  return goal.goal?.byDate ? `${formatNumber(target, 1)} kg by ${date(goal.goal.byDate)}` : `${formatNumber(target, 1)} kg`;
}

/** Days early (positive) or late (negative) of the projected date against the goal date. */
export function daysEarly(goal: GoalProgress): number | null {
  const projected = goal.hero.projectedDate.value;
  const by = goal.goal?.byDate ?? null;
  return projected && by ? daysBetween(projected, by) : null;
}

function bodyChange(series: BodySeries | null): number | null {
  if (!series) {
    return null;
  }
  const start = series.start ?? series.series[0]?.value ?? null;
  const end = series.end ?? series.series.at(-1)?.value ?? null;
  return start === null || end === null ? null : end - start;
}

function changeWord(delta: number, steady: number): string {
  return Math.abs(delta) < steady ? 'steady' : delta < 0 ? 'down' : 'up';
}

/** The Goal card's three lines (board 19c): the rate, the projected date, and the waist. */
export function goalSummaryLines(goal: GoalProgress): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const rate = goal.hero.weeklyRate;
  if (rate.value !== null) {
    lines.push({ figure: `${signed(rate.value, 2)} kg`, text: 'a week, the last 28 days', trend: rateWord(rate.value, rate.previous, isLosing(goal)) });
  }
  const projected = goal.hero.projectedDate.value;
  const early = daysEarly(goal);
  if (projected) {
    const text = early === null ? 'at this pace' : early === 0 ? 'on your date' : early > 0 ? `${early} days early` : `${-early} days late`;
    lines.push({ figure: `On course for ${date(projected)},`, text, trend: early === null || early === 0 ? 'on time' : early > 0 ? 'ahead' : 'behind' });
  }
  const waist = bodyChange(goal.body.waist);
  const fat = bodyChange(goal.body.bodyFat);
  if (waist !== null) {
    lines.push({ figure: `Waist ${signed(waist)} cm`, text: 'in 4 weeks', trend: changeWord(waist, 0.3) });
  } else if (fat !== null) {
    lines.push({ figure: `Body fat ${signed(fat)} points`, text: 'in 4 weeks', trend: changeWord(fat, 0.2) });
  }
  return lines;
}

export function goalSummaryContext(goal: GoalProgress): string {
  const previous = goal.hero.weeklyRate.previous;
  return previous === null ? '' : `Was ${signed(previous, 2)} kg a week in the 4 weeks before`;
}

/** The Goal page's hero figures (board 19a). A figure the server did not send shows a dash. */
export function goalHeroStats(goal: GoalProgress): HeroStat[] {
  const { hero } = goal;
  return [
    {
      label: 'Now',
      value: hero.nowKg === null ? '–' : formatNumber(hero.nowKg, 1),
      unit: hero.nowKg === null ? '' : 'kg',
      context: hero.changeKg === null ? '' : `${signed(hero.changeKg)} kg on 4 weeks before`
    },
    {
      label: 'A week',
      value: hero.weeklyRate.value === null ? '–' : signed(hero.weeklyRate.value, 2),
      unit: hero.weeklyRate.value === null ? '' : 'kg',
      context: hero.weeklyRate.previous === null ? '' : `was ${signed(hero.weeklyRate.previous, 2)}`
    },
    {
      label: 'Projected',
      value: hero.projectedDate.value ? date(hero.projectedDate.value) : '–',
      context: hero.projectedDate.previous ? `was ${date(hero.projectedDate.previous)}` : ''
    },
    {
      label: 'Days left',
      value: hero.daysLeft === null ? '–' : String(hero.daysLeft),
      context: goal.goal?.byDate ? `to ${date(goal.goal.byDate)}` : ''
    }
  ];
}
