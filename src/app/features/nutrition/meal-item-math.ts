import { FoodDetail, FoodServing, MealItemDraft } from '../../core/fitsync.models';

export function isCustomFoodScope(scope: string | null | undefined): boolean {
  const normalized = (scope ?? '').toUpperCase();
  return normalized === 'USER' || normalized === 'CUSTOM';
}

export function calculateMealItem(detail: FoodDetail, serving: FoodServing, quantity: number): MealItemDraft | null {
  const safeQuantity = Number(quantity);
  if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
    return null;
  }

  const scale = calculateServingScale(detail, serving, safeQuantity);
  if (scale == null) {
    return null;
  }

  const isCustom = isCustomFoodScope(detail.scope);
  return {
    foodCatalogItemId: isCustom ? null : detail.foodId,
    customFoodId: isCustom ? detail.foodId : null,
    foodServingId: serving.servingId,
    foodName: detail.displayName,
    brandName: detail.brandName || null,
    brandLogoUrl: detail.brandLogoUrl ?? null,
    quantity: roundDecimal(safeQuantity, 2),
    unit: 'serving',
    servingSize: serving.quantity,
    servingUnit: serving.unit ?? null,
    snapshotServingLabel: serving.label,
    calories: Math.round(detail.calories * scale),
    proteinGrams: roundDecimal(detail.proteinGrams * scale),
    carbsGrams: roundDecimal(detail.carbsGrams * scale),
    fatGrams: roundDecimal(detail.fatGrams * scale),
    fiberGrams: detail.fiberGrams == null ? null : roundDecimal(detail.fiberGrams * scale),
    sugarGrams: detail.sugarGrams == null ? null : roundDecimal(detail.sugarGrams * scale),
    sodiumMg: detail.sodiumMg == null ? null : roundDecimal(detail.sodiumMg * scale)
  };
}

function calculateServingScale(detail: FoodDetail, serving: FoodServing, quantity: number): number | null {
  const basis = basisAmount(detail);
  const servingAmount = servingAmountForBasis(detail, serving);
  if (!basis || !servingAmount) {
    return null;
  }
  return (quantity * servingAmount) / basis;
}

function basisAmount(detail: FoodDetail): number | null {
  const amount = Number(detail.basisQuantity);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unit = normalizeUnit(detail.basisUnit);
  if (unit === 'kg' || unit === 'l') {
    return amount * 1000;
  }
  return amount;
}

function servingAmountForBasis(detail: FoodDetail, serving: FoodServing): number | null {
  const basisUnit = normalizeUnit(detail.basisUnit);
  if (basisUnit === 'g' || basisUnit === 'kg') {
    if (serving.gramsEquivalent != null) {
      return serving.gramsEquivalent;
    }
    if (serving.millilitersEquivalent != null && detail.densityGramsPerMl != null) {
      return serving.millilitersEquivalent * detail.densityGramsPerMl;
    }
  }
  if (basisUnit === 'ml' || basisUnit === 'l') {
    if (serving.millilitersEquivalent != null) {
      return serving.millilitersEquivalent;
    }
    if (serving.gramsEquivalent != null && detail.densityGramsPerMl != null && detail.densityGramsPerMl > 0) {
      return serving.gramsEquivalent / detail.densityGramsPerMl;
    }
  }

  if (serving.quantity != null && normalizeUnit(serving.unit) === basisUnit) {
    return serving.quantity;
  }

  return basisAmount(detail);
}

function normalizeUnit(unit: string | null | undefined): string {
  const normalized = (unit ?? '').trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(normalized)) {
    return 'g';
  }
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
    return 'kg';
  }
  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
    return 'ml';
  }
  if (['l', 'liter', 'liters'].includes(normalized)) {
    return 'l';
  }
  return normalized;
}

export function roundDecimal(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}


/** The select value of the entry that lets a person type grams instead of picking a serving. */
export const CUSTOM_SERVING_KEY = '__custom_grams__';

/** Grams one count of a serving weighs, or null when that cannot be told. */
export function servingGrams(detail: FoodDetail, serving: FoodServing): number | null {
  if (serving.gramsEquivalent != null && serving.gramsEquivalent > 0) {
    return serving.gramsEquivalent;
  }
  if (serving.millilitersEquivalent != null && serving.millilitersEquivalent > 0) {
    return serving.millilitersEquivalent * (detail.densityGramsPerMl ?? 1);
  }
  return null;
}

/**
 * The meal item for an amount typed in grams. Nutrition scales by grams against the food's basis;
 * a food listed per millilitre is taken as 1 g to the millilitre when no density is known.
 */
export function calculateGramsItem(detail: FoodDetail, grams: number): MealItemDraft | null {
  const amount = Number(grams);
  const basisUnit = normalizeUnit(detail.basisUnit);
  if (!Number.isFinite(amount) || amount <= 0 || !['g', 'kg', 'ml', 'l'].includes(basisUnit)) {
    return null;
  }
  const measured: FoodServing = {
    servingId: null,
    label: `${roundDecimal(amount, 1)} g`,
    quantity: amount,
    unit: 'g',
    gramsEquivalent: amount,
    millilitersEquivalent: null,
    sortOrder: null,
    defaultServing: false
  };
  return calculateMealItem({ ...detail, densityGramsPerMl: detail.densityGramsPerMl ?? 1 }, measured, 1);
}

/** What a volume of a drink is logged as: a count of one of the food's servings, or grams. */
export interface VolumeChoice {
  item: MealItemDraft;
  /** The catalogue serving the item is a count of, or null when the amount is typed in grams. */
  serving: FoodServing | null;
  /** The grams of a custom item. */
  grams: number | null;
}

function servingMillilitres(serving: FoodServing): number | null {
  if (serving.millilitersEquivalent != null && serving.millilitersEquivalent > 0) {
    return serving.millilitersEquivalent;
  }
  const quantity = serving.quantity;
  return normalizeUnit(serving.unit) === 'ml' && quantity != null && quantity > 0 ? quantity : null;
}

/**
 * The item for `ml` of a drink, always carrying a serving the backend knows: the serving of exactly
 * that volume, else a count of a millilitre-based serving ("1 ml" x 250), else a count of any
 * serving with a volume. A food with no such serving falls back to grams (1 ml as density grams).
 */
export function calculateVolumeItem(detail: FoodDetail, ml: number): VolumeChoice | null {
  const measured = detail.servings
    .map((serving) => ({ serving, per: servingMillilitres(serving) }))
    .filter((entry): entry is { serving: FoodServing; per: number } => entry.per !== null);
  const exact = measured.find((entry) => Math.abs(entry.per - ml) < 0.5);
  const smallest = [...measured].sort((a, b) => a.per - b.per)[0];
  const pick = exact ?? smallest;
  if (pick) {
    const item = calculateMealItem(detail, pick.serving, exact ? 1 : roundDecimal(ml / pick.per, 2));
    return item ? { item, serving: pick.serving, grams: null } : null;
  }
  const grams = roundDecimal(ml * (detail.densityGramsPerMl ?? 1), 1);
  const item = calculateGramsItem(detail, grams);
  return item ? { item, serving: null, grams } : null;
}

/** A draft whose amount changed by a ratio, for a row that has no food detail to recalculate from. */
export function scaleDraft(item: MealItemDraft, quantity: number, ratio: number): MealItemDraft {
  const scaled = (value: number | null): number | null => (value == null ? null : roundDecimal(value * ratio, 1));
  return {
    ...item,
    quantity,
    calories: Math.round(item.calories * ratio),
    proteinGrams: scaled(item.proteinGrams) ?? 0,
    carbsGrams: scaled(item.carbsGrams) ?? 0,
    fatGrams: scaled(item.fatGrams) ?? 0,
    fiberGrams: scaled(item.fiberGrams),
    sugarGrams: scaled(item.sugarGrams),
    sodiumMg: scaled(item.sodiumMg)
  };
}
