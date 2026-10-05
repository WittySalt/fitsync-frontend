import { FoodDetail } from '../../core/fitsync.models';
import { calculateGramsItem, calculateMealItem, scaleDraft, servingGrams } from './meal-item-math';

describe('meal item math', () => {
  const burger: FoodDetail = {
    foodId: 'burger',
    displayName: 'Big Mac',
    brandName: "McDonald's",
    categoryName: null,
    scope: 'CATALOG',
    calories: 250,
    proteinGrams: 12,
    carbsGrams: 20,
    fatGrams: 14,
    fiberGrams: 1,
    sugarGrams: 4,
    sodiumMg: 400,
    basisQuantity: 100,
    basisUnit: 'g',
    densityGramsPerMl: null,
    primaryBarcode: '',
    sourceDataset: 'USDA_SR',
    servings: []
  };
  const sandwich = {
    servingId: 's1',
    label: '1 sandwich',
    quantity: 1,
    unit: 'sandwich',
    gramsEquivalent: 200,
    millilitersEquivalent: null,
    sortOrder: 0,
    defaultServing: true
  };

  it('scales nutrition by grams, grams being the count times the serving weight', () => {
    expect(servingGrams(burger, sandwich)).toBe(200);
    const two = calculateMealItem(burger, sandwich, 2);
    expect(two?.calories).toBe(1000);
    expect(two?.proteinGrams).toBe(48);
    expect(two?.quantity).toBe(2);
    expect(two?.foodServingId).toBe('s1');
  });

  it('prices an amount typed in grams without a serving id', () => {
    const item = calculateGramsItem(burger, 150);
    expect(item?.calories).toBe(375);
    expect(item?.carbsGrams).toBe(30);
    expect(item?.foodServingId).toBeNull();
    expect(item?.snapshotServingLabel).toBe('150 g');
    expect(item?.quantity).toBe(1);
  });

  it('takes a millilitre food as one gram to the millilitre when no density is known', () => {
    const juice = { ...burger, basisUnit: 'ml', calories: 40 };
    expect(calculateGramsItem(juice, 250)?.calories).toBe(100);
  });

  it('refuses grams that are not positive or a food listed by an unknown unit', () => {
    expect(calculateGramsItem(burger, 0)).toBeNull();
    expect(calculateGramsItem(burger, Number.NaN)).toBeNull();
    expect(calculateGramsItem({ ...burger, basisUnit: 'serving' }, 100)).toBeNull();
  });

  it('scales a draft that has no food behind it by the ratio of the amounts', () => {
    const draft = calculateMealItem(burger, sandwich, 1);
    const doubled = scaleDraft(draft!, 2, 2);
    expect(doubled.quantity).toBe(2);
    expect(doubled.calories).toBe(1000);
    expect(doubled.sodiumMg).toBe(1600);
  });
});
