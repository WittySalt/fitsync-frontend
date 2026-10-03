import { shortDateLabel } from '../../../shared/date-label';
import { formatNumber, signed } from '../../../shared/progress/progress-format';
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

/** "+3% on the 30 days before", with a true minus sign. */
export function percentAgainst(value: number | null, previous: number | null, days: number): string {
  if (value === null || previous === null || previous === 0) {
    return '';
  }
  const pct = Math.round((value / previous - 1) * 100);
  return `${pct === 0 ? '0' : signed(pct, 0)}% on the ${days} days before`;
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

/** The Food page's hero figures (board 19b). */
export function foodHeroStats(food: FoodProgress, days: number): HeroStat[] {
  const { hero } = food;
  const balance = hero.balancePerDay.value;
  const previousBalance = food.energy.weeklyBalance.filter((week) => !week.current).at(-1)?.balance ?? null;
  return [
    {
      label: 'Eaten a day',
      value: hero.eatenPerDay.value === null ? '–' : formatNumber(hero.eatenPerDay.value),
      unit: hero.eatenPerDay.value === null ? '' : 'kcal',
      context: percentAgainst(hero.eatenPerDay.value, hero.eatenPerDay.previous, days)
    },
    {
      label: 'Protein a day',
      value: hero.proteinPerDay.value === null ? '–' : formatNumber(hero.proteinPerDay.value),
      unit: hero.proteinPerDay.value === null ? '' : 'g',
      context: percentAgainst(hero.proteinPerDay.value, hero.proteinPerDay.previous, days)
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
      context:
        hero.daysLogged.value === null || hero.daysLogged.previous === null
          ? ''
          : `${signed(hero.daysLogged.value - hero.daysLogged.previous, 0)} on the ${days} days before`
    }
  ];
}

/** Whether the food response has anything to show. */
export function hasFood(food: FoodProgress): boolean {
  return food.hero.eatenPerDay.value !== null || (food.hero.daysLogged.value ?? 0) > 0;
}
