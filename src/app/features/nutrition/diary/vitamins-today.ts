import { NutrientRow, NutrientSummary } from './diary.models';
import { NutrientView, nutrientView } from './diary-figures';

/** The names of the watched nutrients in a sentence, such as "Vitamin B12, iron and zinc are watched first." */
export function focusLine(summary: NutrientSummary): string {
  const names = summary.nutrients.filter((row) => summary.focusCodes.includes(row.code)).map((row) => row.displayName);
  if (names.length === 0) {
    return '';
  }
  const lower = names.map((name, index) => (index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)));
  const list = lower.length === 1 ? lower[0] : `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}`;
  return `${list} ${lower.length === 1 ? 'is' : 'are'} watched first.`;
}

/** How much of the logged food has no vitamin data, or an empty string when all of it has. */
export function coverageLine(summary: NutrientSummary): string {
  const missing = summary.itemsWithoutNutrients;
  const logged = summary.itemsLogged;
  if (missing === null || missing <= 0) {
    return '';
  }
  return logged !== null && logged > 0
    ? `${missing} of ${logged} logged foods have no vitamin data, so these amounts may be low.`
    : `${missing} logged foods have no vitamin data, so these amounts may be low.`;
}

/** True when no food logged in the period has vitamin data, so every amount is unknown rather than low. */
export function noVitaminData(summary: NutrientSummary): boolean {
  const logged = summary.itemsLogged;
  if (logged !== null && logged > 0 && summary.itemsWithoutNutrients === logged) {
    return true;
  }
  return summary.nutrients.length > 0 && summary.nutrients.every((row) => row.averageAmount === null);
}

/**
 * The three lowest nutrients that are not yet met get large rings. Everything else, the met ones
 * included, is a chip. A nutrient with no data is unknown, so it appears in neither.
 */
export function todayParts(rows: readonly NutrientRow[]): { low: NutrientView[]; rest: NutrientView[] } {
  const known = rows.filter((row) => row.averageAmount !== null && row.share !== null);
  const short = known.filter((row) => (row.share ?? 0) < 1).sort((a, b) => (a.share ?? 0) - (b.share ?? 0));
  const low = short.slice(0, 3);
  return { low: low.map(nutrientView), rest: known.filter((row) => !low.includes(row)).map(nutrientView) };
}
