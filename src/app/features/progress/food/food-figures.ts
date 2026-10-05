import { shortDateLabel } from '../../../shared/date-label';
import { NO_EARLIER_DATA, formatNumber, signed } from '../../../shared/progress/progress-format';
import { HeroStat, SummaryLine } from '../../../shared/progress/progress.models';
import { FoodProgress, MacroTrend } from '../progress-api.models';

/** Within this share of the period before, a daily figure reads as steady (board 19c: −3% is steady). */
const STEADY_SHARE = 0.05;
/** Within 8% of the first week, a macro reads as steady (board 19b). */
const MACRO_STEADY_SHARE = 0.08;

export function changeWord(value: number, previous: number | null, steadyShare = STEADY_SHARE): string {
  if (previous === null || previous === 0) {
    return 'steady';
  }
  const change = value / previous - 1;
  return Math.abs(change) < steadyShare ? 'steady' : change < 0 ? 'down' : 'up';
}

export function macroWord(macro: MacroTrend | null): string {
  const first = macro?.firstWeek ?? macro?.series[0]?.value ?? null;
  const last = macro?.thisWeek ?? macro?.series.at(-1)?.value ?? null;
  return first === null || last === null ? '' : changeWord(last, first, MACRO_STEADY_SHARE);
}

/** "+3% on the 30 days before", with a true minus sign. Nothing from a missing or zero earlier figure. */
export function percentAgainst(value: number | null, previous: number | null, days: number, before = `the ${days} days before`): string {
  if (value === null || previous === null || previous === 0) {
    return '';
  }
  const pct = Math.round((value / previous - 1) * 100);
  return `${pct === 0 ? '0' : signed(pct, 0)}% on ${before}`;
}

/** A compared figure's line: the change when there is an earlier figure, "No earlier data" when there is not. */
function againstEarlier(value: number | null, previous: number | null, change: string): string {
  if (value === null) {
    return '';
  }
  return previous === null || previous === 0 ? NO_EARLIER_DATA : change;
}

/** The big number of the energy balance and its words: "279" and "kcal a day under what you used". */
export function balanceHeadline(balance: number | null): { value: string; words: string } | null {
  if (balance === null) {
    return null;
  }
  const value = formatNumber(Math.abs(Math.round(balance)));
  return { value, words: balance <= 0 ? 'kcal a day under what you used' : 'kcal a day over what you used' };
}

/** The Food card's three lines (board 19c): calories a day, the protein drift and the lowest nutrient. */
export function foodSummaryLines(food: FoodProgress, days: number): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const eaten = food.hero.eatenPerDay;
  const logged = food.hero.daysLogged.value;
  if (eaten.value !== null) {
    lines.push({
      figure: `${formatNumber(eaten.value)} kcal`,
      text: logged === null ? 'a day' : `a day, ${logged} of ${days} days logged`,
      trend: changeWord(eaten.value, eaten.previous)
    });
  }
  const protein = food.macros.protein;
  const first = protein?.firstWeek ?? protein?.series[0]?.value ?? null;
  const last = protein?.thisWeek ?? protein?.series.at(-1)?.value ?? null;
  if (first !== null && last !== null) {
    const since = protein?.series[0]?.weekStart;
    lines.push({
      figure: `Protein ${formatNumber(first)} → ${formatNumber(last)} g`,
      text: since ? `a day since ${shortDateLabel(since)}` : 'a day',
      trend: macroWord(protein)
    });
  }
  const lowest = food.nutrition?.lowestNutrients[0];
  if (lowest) {
    lines.push({ figure: `${lowest.displayName} ${Math.round(lowest.share * 100)}%,`, text: 'the furthest short', trend: 'low' });
  }
  return lines;
}

export function foodSummaryContext(food: FoodProgress, days: number): string {
  const previous = food.hero.eatenPerDay.previous;
  return previous === null ? '' : `${formatNumber(previous)} kcal a day in the ${days} days before`;
}

/** The Food page's four figures (board 19b). `before` names the period before: "the 4 weeks before". */
export function foodHeroStats(food: FoodProgress, days: number, before = `the ${days} days before`): HeroStat[] {
  const { hero } = food;
  const balance = hero.balancePerDay.value;
  const previousBalance = food.energy.weeklyBalance.filter((week) => !week.current).at(-1)?.balance ?? null;
  return [
    {
      label: 'Eaten a day',
      value: hero.eatenPerDay.value === null ? '–' : formatNumber(hero.eatenPerDay.value),
      unit: hero.eatenPerDay.value === null ? '' : 'kcal',
      context: againstEarlier(hero.eatenPerDay.value, hero.eatenPerDay.previous, percentAgainst(hero.eatenPerDay.value, hero.eatenPerDay.previous, days, before))
    },
    {
      label: 'Protein a day',
      value: hero.proteinPerDay.value === null ? '–' : formatNumber(hero.proteinPerDay.value),
      unit: hero.proteinPerDay.value === null ? '' : 'g',
      context: againstEarlier(hero.proteinPerDay.value, hero.proteinPerDay.previous, percentAgainst(hero.proteinPerDay.value, hero.proteinPerDay.previous, days, before))
    },
    {
      label: balance !== null && balance > 0 ? 'Over what you used' : 'Under what you used',
      value: balance === null ? '–' : formatNumber(Math.abs(Math.round(balance))),
      unit: balance === null ? '' : 'kcal',
      context:
        balance === null
          ? ''
          : previousBalance === null
            ? 'a day this week'
            : `a day this week, ${formatNumber(Math.abs(Math.round(previousBalance)))} the week before`
    },
    {
      label: 'Days logged',
      value: hero.daysLogged.value === null ? '–' : String(hero.daysLogged.value),
      unit: hero.daysLogged.value === null ? '' : `of ${hero.daysLogged.days ?? days}`,
      context: againstEarlier(
        hero.daysLogged.value,
        hero.daysLogged.previous,
        hero.daysLogged.value === null || hero.daysLogged.previous === null ? '' : `${signed(hero.daysLogged.value - hero.daysLogged.previous, 0)} on ${before}`
      )
    }
  ];
}

/** Whether the food response has anything to show. */
export function hasFood(food: FoodProgress): boolean {
  return food.hero.eatenPerDay.value !== null || (food.hero.daysLogged.value ?? 0) > 0;
}

export interface FoodVerdict {
  text: string;
  tone: 'good' | 'ink';
}

/** Under this share of the days logged, the answer is about the gaps and not about the balance. */
const LOGGED_ENOUGH = 0.7;

/**
 * The page's answer: logging gaps first (a balance over few days says little), then the four weeks
 * of eating against the calorie target: "On target." within 5 % of it, "Under target." or "Over
 * target." beyond. Without a target it falls back to the balance against what you use. Nothing
 * logged at all reads as "Start logging.".
 */
export function foodVerdict(food: FoodProgress, days: number, calorieTarget: number | null = null): FoodVerdict {
  if (!hasFood(food)) {
    return { text: 'Start logging.', tone: 'ink' };
  }
  const { value, days: of } = food.hero.daysLogged;
  if (value !== null && value / (of ?? days) < LOGGED_ENOUGH) {
    return { text: 'Logging gaps.', tone: 'ink' };
  }
  const eaten = food.hero.eatenPerDay.value;
  if (eaten !== null && calorieTarget !== null && calorieTarget > 0) {
    const ratio = eaten / calorieTarget;
    return Math.abs(ratio - 1) <= STEADY_SHARE ? { text: 'On target.', tone: 'good' } : { text: ratio < 1 ? 'Under target.' : 'Over target.', tone: 'ink' };
  }
  const balance = food.hero.balancePerDay.value;
  if (balance === null) {
    return { text: 'Too early to judge.', tone: 'ink' };
  }
  return balance <= 0 ? { text: 'Under what you use.', tone: 'good' } : { text: 'Over what you use.', tone: 'ink' };
}

/** The sentence under the verdict: the four weeks' eating and logging, never today's partial day. */
export function foodSentence(food: FoodProgress, days: number): string {
  const { eatenPerDay, daysLogged } = food.hero;
  if (eatenPerDay.value === null) {
    return 'Log what you eat and this page fills in.';
  }
  const logged = daysLogged.value === null ? '' : ` and logged ${daysLogged.value} of ${daysLogged.days ?? days} days`;
  return `You ate ${formatNumber(eatenPerDay.value)} kcal a day${logged}.`;
}

/** The one sentence under Macros: protein from the first week to this one against its goal. */
export function macroSentence(macros: FoodProgress['macros']): string {
  const protein = macros.protein;
  const first = protein?.firstWeek ?? protein?.series[0]?.value ?? null;
  const last = protein?.thisWeek ?? protein?.series.at(-1)?.value ?? null;
  if (first === null || last === null) {
    return 'Grams a day against your daily goals, once there are weeks to compare.';
  }
  const goal = protein?.target ? ` against a goal of ${formatNumber(protein.target)} g` : '';
  return `Protein went from ${formatNumber(first)} to ${formatNumber(last)} g a day${goal}.`;
}

/** What Ask puts in the composer for Macros: what each tile shows and how it is averaged. */
export function macroAsk(macros: FoodProgress['macros']): string {
  const first = macros.protein?.series[0]?.weekStart;
  const since = first ? ` from the week of ${shortDateLabel(first)}` : '';
  return `How are my macros doing against my goals? Each tile is the average of a week, on logged days only${since}.`;
}

export const ENERGY_ASK = 'How is my energy balance worked out? It is what I ate against resting energy × 1.2 plus workouts, on logged days only.';
