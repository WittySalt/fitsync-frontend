import { BalanceEntry, MealProtein, NutrientRow, ProteinByMealView } from './diary.models';

/** A number with thousands separators, rounded to whole units. */
export function whole(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}

/**
 * An amount with its unit. Milligrams and larger figures are whole numbers, small figures keep one
 * decimal that is dropped when it is zero: "15 g", "5.1 µg", "1,860 mg".
 */
export function amountText(value: number, unit: string): string {
  const small = Math.abs(value) < 100 && unit !== 'mg';
  const text = small ? String(Math.round(value * 10) / 10) : whole(value);
  return `${text} ${unit}`.trim();
}

export interface BudgetFigures {
  /** Fraction of the target eaten within it, 0 to 1. */
  within: number;
  /** Fraction of the target eaten beyond it, shown dark grey; 0 when not over. */
  over: number;
  percent: number;
  /** "N kcal left" or "N kcal over". */
  line: string;
  isOver: boolean;
}

/** The budget ring and the line under the big number. Null when there is no target to measure against. */
export function budgetFigures(eaten: number, target: number | null): BudgetFigures | null {
  if (target === null || target <= 0) {
    return null;
  }
  const share = eaten / target;
  const isOver = eaten > target;
  return {
    within: Math.min(share, 1),
    over: isOver ? Math.min(share - 1, 1) : 0,
    percent: Math.round(share * 100),
    line: isOver ? `${whole(eaten - target)} kcal over` : `${whole(target - eaten)} kcal left`,
    isOver
  };
}

/** A bar that is filled `share` of the way, never past full. */
export function barPercent(share: number): number {
  return Math.min(Math.max(share, 0), 1) * 100;
}

export interface BalanceRowView {
  entry: BalanceEntry;
  /** True when there is no data for this nutrient yet. The row then has no bar and no amount. */
  unknown: boolean;
  value: string;
  reference: string;
  /** Where the limit marker sits along a bar of a limit that was passed, as a percentage; null otherwise. */
  marker: number | null;
  /** "met · 100%" for a reached target, otherwise empty. */
  metText: string;
  source: string;
}

/** "Mostly from apple, granola and banana." from the top sources. Empty when there are none. */
export function sourceLine(entry: BalanceEntry): string {
  const names = entry.topSources.map((source) => source.foodName.toLowerCase());
  if (names.length === 0) {
    return '';
  }
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Mostly from ${list}.`;
}

export function balanceRow(entry: BalanceEntry): BalanceRowView {
  const limit = entry.kind === 'LIMIT';
  const amount = entry.amount;
  const share = entry.share;
  if (amount === null || share === null) {
    return { entry, unknown: true, value: '', reference: '', marker: null, metText: '', source: '' };
  }
  return {
    entry,
    unknown: false,
    value: amountText(amount, entry.unit),
    reference: limit ? `${amountText(entry.reference, entry.unit)} limit` : `${amountText(entry.reference, entry.unit)} a day`,
    marker: limit && entry.over && share > 0 ? 100 / share : null,
    metText: !limit && entry.met ? `met · ${Math.round(share * 100)}%` : '',
    source: sourceLine(entry)
  };
}

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack' };

export interface ProteinBar {
  label: string;
  grams: number;
  /** Bar height as a percentage of the chart. */
  height: number;
  inBand: boolean;
}

export interface ProteinChart {
  bars: ProteinBar[];
  /** The personal band as percentages of the chart height, measured from the bottom. */
  bandBottom: number;
  bandHeight: number;
  rangeText: string;
}

/** Protein at each meal against the person's band. The chart always has the four meals, with 0 for a meal not logged. */
export function proteinChart(view: ProteinByMealView): ProteinChart {
  const byType = new Map<string, number>(view.meals.map((meal: MealProtein) => [meal.mealType, meal.grams]));
  const rows = MEAL_ORDER.map((type) => ({ type, grams: byType.get(type) ?? 0 }));
  const top = Math.max(60, view.highGrams * 1.25, ...rows.map((row) => row.grams));
  return {
    bars: rows.map((row) => ({
      label: MEAL_LABEL[row.type],
      grams: Math.round(row.grams),
      height: (row.grams / top) * 100,
      inBand: row.grams >= view.lowGrams && row.grams <= view.highGrams
    })),
    bandBottom: (view.lowGrams / top) * 100,
    bandHeight: ((view.highGrams - view.lowGrams) / top) * 100,
    rangeText: `${Math.round(view.lowGrams)} to ${Math.round(view.highGrams)} g a meal`
  };
}

export interface NutrientView {
  row: NutrientRow;
  percent: number;
  /** "5.1 of 15 µg" for the large rows. */
  amount: string;
  /** The words under a large row: the upper limit message or the richest usual food. */
  words: string;
}

export function nutrientView(row: NutrientRow): NutrientView {
  return {
    row,
    percent: Math.round((row.share ?? 0) * 100),
    amount: `${amountText(row.averageAmount ?? 0, '').trim()} of ${amountText(row.reference, row.unit)}`,
    words: row.aboveUpperLimit && row.upperLimit !== null
      ? `Above the upper limit of ${amountText(row.upperLimit, row.unit)}.`
      : row.richestUsualFood
        ? `Among foods you often eat, ${row.richestUsualFood.toLowerCase()} has the most.`
        : ''
  };
}

/** The lowest three as large rows and the rest as chips. The backend already sorts focus codes first, then lowest first. */
export function splitNutrients(rows: readonly NutrientRow[]): { low: NutrientView[]; rest: NutrientView[] } {
  // A nutrient with no data at all is unknown, so it gets no ring and no percentage.
  const views = rows.filter((row) => row.averageAmount !== null && row.share !== null).map(nutrientView);
  return { low: views.slice(0, 3), rest: views.slice(3) };
}
