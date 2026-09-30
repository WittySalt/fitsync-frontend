import { ProteinByMeal } from '../../../core/fitsync.models';

/**
 * Geometry for the meal chart in a nutrition reading, kept free of Angular so every number can be
 * tested. One vertical bar for each meal, all the same width, drawn on the same 540 by 128 grid as
 * the slope chart so that the panel keeps one height whichever page it is on.
 */

export const MEAL_WIDTH = 540;
export const MEAL_HEIGHT = 128;

const PLOT_LEFT = 12;
const PLOT_RIGHT = 528;
export const MEAL_BASELINE_Y = 96;
const TALLEST_BAR = 72;
const VALUE_GAP = 7;
const LABEL_Y = 116;
const MAX_BAR_WIDTH = 40;
const MAX_LABEL_LENGTH = 16;

export interface MealBar {
  label: string;
  fullLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  valueY: number;
  labelY: number;
  valueText: string;
  /** The bar's height as a share of the tallest one, for the list drawn in narrow panels. */
  share: number;
  bright: boolean;
}

export interface MealBarsChart {
  bars: MealBar[];
  description: string;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function shortLabel(label: string): string {
  return label.length <= MAX_LABEL_LENGTH ? label : `${label.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
}

function isLunchOrDinner(meal: ProteinByMeal): boolean {
  const type = meal.mealType.toUpperCase();
  return type === 'LUNCH' || type === 'DINNER';
}

/**
 * The bars for the meals as given. When the reading is about the lunch-and-dinner share, those two
 * bars are the brighter green and the rest the quieter one; otherwise every bar is the same green.
 * Nothing is drawn without a meal or when no meal has any protein, because every bar would be flat.
 */
export function mealBars(meals: ProteinByMeal[], emphasiseLunchAndDinner: boolean): MealBarsChart | null {
  const shown = meals.filter((meal) => Number.isFinite(meal.gramsPerDay) && meal.gramsPerDay >= 0);
  const tallest = Math.max(0, ...shown.map((meal) => meal.gramsPerDay));
  if (!shown.length || tallest <= 0) {
    return null;
  }

  const slot = (PLOT_RIGHT - PLOT_LEFT) / shown.length;
  const width = Math.round(Math.min(MAX_BAR_WIDTH, slot * 0.4));

  const bars = shown.map((meal, index): MealBar => {
    const height = round((meal.gramsPerDay / tallest) * TALLEST_BAR);
    const centerX = round(PLOT_LEFT + slot * (index + 0.5));
    const fullLabel = meal.label.trim() || meal.mealType;
    return {
      label: shortLabel(fullLabel),
      fullLabel,
      x: round(centerX - width / 2),
      y: round(MEAL_BASELINE_Y - height),
      width,
      height,
      centerX,
      valueY: round(MEAL_BASELINE_Y - height - VALUE_GAP),
      labelY: LABEL_Y,
      valueText: `${Math.round(meal.gramsPerDay)} g`,
      share: meal.gramsPerDay / tallest,
      bright: !emphasiseLunchAndDinner || isLunchOrDinner(meal)
    };
  });

  const values = bars.map((bar) => `${bar.fullLabel} ${bar.valueText}`).join(', ');
  return { bars, description: `Protein on an average day, by meal. ${values}.` };
}
