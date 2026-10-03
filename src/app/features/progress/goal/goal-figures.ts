import { shortDateLabel } from '../../../shared/date-label';
import { NO_EARLIER_DATA, daysBetween, formatNumber, signed } from '../../../shared/progress/progress-format';
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

/**
 * The Goal page's four figures (board 19a). A figure the server did not send shows a dash, and a
 * figure with nothing earlier to compare with says so instead of showing a change.
 */
export function goalHeroStats(goal: GoalProgress, span = '4 weeks'): HeroStat[] {
  const { hero } = goal;
  return [
    {
      label: 'Now',
      value: hero.nowKg === null ? '–' : formatNumber(hero.nowKg, 1),
      unit: hero.nowKg === null ? '' : 'kg',
      context: hero.nowKg === null ? '' : hero.changeKg == null ? NO_EARLIER_DATA : `${signed(hero.changeKg)} kg in ${span}`
    },
    {
      label: 'A week',
      value: hero.weeklyRate.value === null ? '–' : signed(hero.weeklyRate.value, 2),
      unit: hero.weeklyRate.value === null ? '' : 'kg',
      context: hero.weeklyRate.value === null ? '' : hero.weeklyRate.previous == null ? NO_EARLIER_DATA : `was ${signed(hero.weeklyRate.previous, 2)} kg a week`
    },
    {
      label: 'Projected',
      value: hero.projectedDate.value ? date(hero.projectedDate.value) : '–',
      context: !hero.projectedDate.value ? '' : hero.projectedDate.previous != null ? `was ${date(hero.projectedDate.previous)}` : NO_EARLIER_DATA
    },
    {
      label: 'Days left',
      value: hero.daysLeft === null ? '–' : String(hero.daysLeft),
      context: goal.goal?.byDate ? `to ${date(goal.goal.byDate)}` : ''
    }
  ];
}

export interface Verdict {
  text: string;
  /** Green for a good answer, ink for the rest. */
  tone: 'good' | 'ink';
}

/** The weight the series starts from: the first weekly average, else the first weigh-in. */
function startKg(goal: GoalProgress): number | null {
  return goal.weight.weekly[0]?.avgKg ?? goal.weight.daily[0]?.kg ?? null;
}

/**
 * The page's answer in two words, from the goal and the weight alone so it never waits for a model:
 * reached, past the date, holding steady, ahead (a week or more early), behind (a week or more
 * late) or on course.
 */
export function goalVerdict(goal: GoalProgress, today: string): Verdict {
  if (!hasWeight(goal)) {
    return { text: 'Start logging.', tone: 'ink' };
  }
  const target = goal.goal?.targetKg ?? null;
  if (target === null) {
    return { text: 'No goal yet.', tone: 'ink' };
  }
  const now = goal.hero.nowKg;
  const start = startKg(goal);
  const keeping = start !== null && Math.abs(start - target) <= 1;
  if (!keeping && now !== null && start !== null && (target < start ? now <= target : now >= target)) {
    return { text: 'Goal reached.', tone: 'good' };
  }
  const by = goal.goal?.byDate ?? null;
  if (by && today > by) {
    return { text: 'Past your date.', tone: 'ink' };
  }
  const rate = goal.hero.weeklyRate.value;
  if (!keeping && rate !== null && Math.abs(rate) < 0.05) {
    return { text: 'Holding steady.', tone: 'ink' };
  }
  const early = daysEarly(goal);
  if (early !== null && early >= 7) {
    return { text: 'Ahead of schedule.', tone: 'good' };
  }
  if (early !== null && early <= -7) {
    return { text: 'Behind schedule.', tone: 'ink' };
  }
  return { text: 'On course.', tone: 'good' };
}

function projectedClause(goal: GoalProgress): string {
  const projected = goal.hero.projectedDate.value;
  const target = goal.goal?.targetKg ?? null;
  if (!projected || target === null) {
    return '';
  }
  const early = daysEarly(goal);
  const gap = early === null ? '' : early === 0 ? ', on your date' : early > 0 ? `, ${early} days before your date` : `, ${-early} days after your date`;
  return `At this pace you reach ${formatNumber(target, 1)} kg on ${date(projected)}${gap}.`;
}

/** The sentence under the verdict, from the figures of the page: where the weight is, and where it is going. */
export function goalSentence(goal: GoalProgress, span = 'four weeks'): string {
  const { nowKg, changeKg } = goal.hero;
  const parts: string[] = [];
  if (nowKg !== null) {
    const moved = changeKg !== null && Math.abs(changeKg) >= 0.05 ? `, ${changeKg < 0 ? 'down' : 'up'} ${formatNumber(Math.abs(changeKg), 1)} kg in ${span}` : '';
    parts.push(`${formatNumber(nowKg, 1)} kg now${moved}.`);
  }
  const clause = projectedClause(goal);
  if (clause) {
    parts.push(clause);
  }
  return parts.join(' ') || 'Log your weight each morning and this page fills in.';
}

/** The one sentence under Weight: the coach's mark on the line, then where the pace leads. */
export function weightSentence(goal: GoalProgress): string {
  const mark = goal.weight.rateChangeMark?.text;
  const parts = [mark ? `${mark}.` : '', projectedClause(goal)].filter((part) => part);
  return parts.join(' ') || 'Each point is the average of a week of morning weigh-ins.';
}

/** The one sentence under Body: how far the waist and the body fat moved over the same weeks. */
export function bodySentence(body: GoalProgress['body']): string {
  const change = (series: BodySeries | null): number | null => bodyChange(series);
  const waist = change(body.waist);
  const fat = change(body.bodyFat);
  const parts: string[] = [];
  if (waist !== null) {
    parts.push(`Waist ${waist < 0 ? 'fell' : 'rose'} ${formatNumber(Math.abs(waist), 1)} cm`);
  }
  if (fat !== null) {
    parts.push(`body fat ${fat < 0 ? 'fell' : 'rose'} ${formatNumber(Math.abs(fat), 1)} points`);
  }
  if (!parts.length) {
    return 'Record a measurement and its change shows here.';
  }
  const text = parts.join(' and ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} over the same weeks.`;
}

/** The one sentence under Pace: the scale against what the food log accounts for, as it stands now. */
export function paceSentence(goal: GoalProgress): string {
  const last = [...goal.pace.weeks].reverse().find((week) => week.actualKg !== null && week.expectedKg !== null);
  if (!last || last.actualKg === null || last.expectedKg === null) {
    return 'The date is worked out from the scale.';
  }
  return `The scale shows ${signed(last.actualKg)} kg since the start and your food log accounts for ${signed(last.expectedKg)} kg. The date is worked out from the scale.`;
}

/** What Ask puts in the composer for Weight: how the date is worked out and why the weekly line is the one to read. */
export function weightAsk(method: string): string {
  return `How is the date worked out? ${method} Daily weigh-ins move with water and salt from one morning to the next, so I should read the weekly line.`.replace(/\s+/g, ' ').trim();
}

export const PACE_ASK =
  'How does my food log compare with the scale? The log adds up what I ate minus resting energy × 1.2 and workouts, at 7,700 kcal a kilo. Days without a food log are not counted, so the log reads low.';

