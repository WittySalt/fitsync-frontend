import { FoodServing } from '../../../core/fitsync.models';
import { DrinkDetail } from './diary.models';
import { drinkItem, drinkPreview, loggedMoment, progressShares, timelineMarks, waterTotals } from './diary-water';
import { waterDay } from './diary-testing';

function serving(overrides: Partial<FoodServing> = {}): FoodServing {
  return {
    servingId: 's-1',
    label: '1 cup',
    quantity: 1,
    unit: 'cup',
    gramsEquivalent: 250,
    millilitersEquivalent: 250,
    sortOrder: 0,
    defaultServing: true,
    ...overrides
  };
}

function drink(overrides: Partial<DrinkDetail> = {}): DrinkDetail {
  return {
    foodId: 'oj',
    displayName: 'Orange juice',
    brandName: '',
    categoryName: 'Beverages',
    scope: 'CATALOG',
    calories: 45,
    proteinGrams: 0.7,
    carbsGrams: 10,
    fatGrams: 0.2,
    fiberGrams: 0.2,
    sugarGrams: 8.4,
    sodiumMg: 1,
    basisQuantity: 100,
    basisUnit: 'ml',
    densityGramsPerMl: null,
    primaryBarcode: '',
    sourceDataset: null,
    servings: [serving()],
    foodGroup: 'DRINKS',
    countsTowardWater: true,
    waterGrams: 88,
    alcoholGrams: 0,
    ...overrides
  };
}

describe('waterTotals and progressShares', () => {
  it('adds plain water to the water that came with drinks', () => {
    expect(waterTotals(waterDay({ totalMl: 1000, fromDrinksMl: 250 }))).toEqual({ plainMl: 1000, drinksMl: 250, totalMl: 1250 });
  });

  it('keeps the drinks part null when the backend does not report it', () => {
    expect(waterTotals(waterDay({ totalMl: 500, fromDrinksMl: null })).drinksMl).toBeNull();
  });

  it('splits the bar by the goal and never fills past the end', () => {
    expect(progressShares(1000, 500, 2000)).toEqual({ plain: 50, drinks: 25 });
    const full = progressShares(1800, 800, 2000);
    expect(full?.plain).toBe(90);
    expect(full?.drinks).toBeCloseTo(10);
  });

  it('gives no bar without a goal', () => {
    expect(progressShares(500, 0, null)).toBeNull();
    expect(progressShares(500, 0, 0)).toBeNull();
  });
});

describe('timelineMarks', () => {
  it('places a dot by the clock between 6:00 and 22:00 and sizes it by the amount', () => {
    const marks = timelineMarks(
      waterDay({
        entries: [{ waterId: 'w1', amountMl: 250, loggedAt: new Date(2026, 9, 2, 14, 0).toISOString() }],
        drinkEntries: [{ mealItemId: 'm1', mealId: 'meal', foodName: 'Latte', waterMl: 220, consumedAt: new Date(2026, 9, 2, 6, 0).toISOString() }]
      })
    );
    expect(marks.length).toBe(2);
    expect(marks[0].left).toBeCloseTo(50);
    expect(marks[0].kind).toBe('water');
    expect(marks[1].left).toBe(0);
    expect(marks[1].kind).toBe('drink');
    expect(marks[0].size).toBeCloseTo(10.5);
    expect(marks[1].label).toContain('Latte');
  });

  it('keeps a late or early entry on the line and drops one with no usable time or amount', () => {
    const marks = timelineMarks(
      waterDay({
        entries: [
          { waterId: 'late', amountMl: 250, loggedAt: new Date(2026, 9, 2, 23, 30).toISOString() },
          { waterId: 'bad', amountMl: 250, loggedAt: 'nope' },
          { waterId: 'zero', amountMl: 0, loggedAt: new Date(2026, 9, 2, 9, 0).toISOString() }
        ]
      })
    );
    expect(marks.map((entry) => entry.key)).toEqual(['w-late']);
    expect(marks[0].left).toBe(100);
  });
});

describe('loggedMoment', () => {
  const now = new Date(2026, 9, 2, 16, 30);

  it('is now for today when no time was chosen', () => {
    expect(loggedMoment('2026-10-02', '', '2026-10-02', now)).toBe(now);
  });

  it('uses the chosen time, and noon for another day with none', () => {
    expect(loggedMoment('2026-10-02', '08:15', '2026-10-02', now).getHours()).toBe(8);
    expect(loggedMoment('2026-10-01', '', '2026-10-02', now).getHours()).toBe(12);
  });
});

describe('drinkPreview', () => {
  it('scales water, kcal and sugar to the amount', () => {
    expect(drinkPreview(drink(), 250)).toEqual({ waterMl: 220, calories: 113, sugarGrams: 21, alcoholGrams: null });
  });

  it('reads a basis in grams through the density', () => {
    const preview = drinkPreview(drink({ basisUnit: 'g', basisQuantity: 100, densityGramsPerMl: 1.05 }), 250);
    expect(preview?.calories).toBe(Math.round(45 * (250 / (100 / 1.05))));
  });

  it('shows alcohol and no water for a drink with alcohol', () => {
    const beer = drink({ calories: 43, sugarGrams: 0, alcoholGrams: 3.9, countsTowardWater: false, waterGrams: 92 });
    expect(drinkPreview(beer, 330)).toEqual({ waterMl: null, calories: 142, sugarGrams: 0, alcoholGrams: 12.9 });
  });

  it('counts no water when the drink is flagged not to count or its water is unknown', () => {
    expect(drinkPreview(drink({ countsTowardWater: false }), 250)?.waterMl).toBeNull();
    expect(drinkPreview(drink({ waterGrams: null }), 250)?.waterMl).toBeNull();
  });

  it('gives nothing for an unusable amount or basis', () => {
    expect(drinkPreview(drink(), 0)).toBeNull();
    expect(drinkPreview(drink({ basisUnit: 'cup' }), 250)).toBeNull();
  });
});

describe('drinkItem', () => {
  it('uses a listed serving of exactly the chosen size', () => {
    const item = drinkItem(drink(), 250);
    expect(item?.foodServingId).toBe('s-1');
    expect(item?.quantity).toBe(1);
    expect(item?.calories).toBe(113);
    expect(item?.foodCatalogItemId).toBe('oj');
  });

  it('scales the default serving for another size, keeping a real serving id', () => {
    const item = drinkItem(drink(), 500);
    expect(item?.foodServingId).toBe('s-1');
    expect(item?.quantity).toBe(2);
    expect(item?.calories).toBe(225);
  });

  it('makes a serving from the amount when none has a volume', () => {
    const item = drinkItem(drink({ servings: [serving({ millilitersEquivalent: null, gramsEquivalent: null })] }), 330);
    expect(item?.foodServingId).toBeNull();
    expect(item?.snapshotServingLabel).toBe('330 ml');
    expect(item?.calories).toBe(Math.round(45 * 3.3));
  });
});
