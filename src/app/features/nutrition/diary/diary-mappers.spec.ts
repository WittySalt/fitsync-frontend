import {
  amountLabel,
  mapDiaryItem,
  mapDiaryMeal,
  mapDiarySummary,
  mapDrinkDetail,
  mapDrinkOption,
  mapFrequentDrink,
  mapNutrientSummary,
  mapRangeDay,
  mapWaterDay,
  num
} from './diary-mappers';

describe('num', () => {
  it('reads numbers and numeric strings and rejects the rest', () => {
    expect(num(3)).toBe(3);
    expect(num('4.5')).toBe(4.5);
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('')).toBeNull();
    expect(num('abc')).toBeNull();
    expect(num(Infinity)).toBeNull();
  });
});

describe('amountLabel', () => {
  it('reads grams and millilitres as the amount, whatever the serving label says', () => {
    expect(amountLabel(187, 'g', '1 cup', 187)).toBe('187 g');
    expect(amountLabel(250, 'ml', '1 glass', null)).toBe('250 ml');
    expect(amountLabel(12.5, 'G', null, 12.5)).toBe('12.5 g');
  });

  it('uses the serving label for one serving of a piece, with the weight when it is known', () => {
    expect(amountLabel(1, 'piece', '1 medium', 118)).toBe('1 medium (118 g)');
    expect(amountLabel(1, 'piece', '1 medium', null)).toBe('1 medium');
  });

  it('spells out another count, and keeps a bare word short', () => {
    expect(amountLabel(1.1, 'piece', '1 medium', 130)).toBe('1.1 servings of 1 medium (130 g)');
    expect(amountLabel(2, 'piece', 'slice', null)).toBe('2 \u00d7 slice');
  });

  it('does not say the weight twice', () => {
    expect(amountLabel(1, 'serving', '20 g', 20)).toBe('20 g');
  });

  it('falls back to the unit with the weight, and to grams or a serving when there is no unit', () => {
    expect(amountLabel(2, 'piece', null, 90)).toBe('2 piece (90 g)');
    expect(amountLabel(1.5, 'serving', null, null)).toBe('1.5 serving');
    expect(amountLabel(1, null, null, 199.6)).toBe('200 g');
    expect(amountLabel(3, null, null, null)).toBe('3 serving');
  });
});

describe('mapDiaryItem', () => {
  const wire = {
    mealItemId: 'i1',
    foodName: 'Almonds',
    foodCatalogItemId: 'f1',
    foodServingId: 's1',
    quantity: '1',
    unit: 'serving',
    snapshotServingLabel: '20 g',
    calories: 116,
    proteinGrams: 4,
    carbsGrams: '4',
    fatGrams: 10,
    fiberGrams: 2.6,
    categoryCode: 'NUTS_SEEDS',
    foodGroup: 'NUTS',
    gramsConsumed: 20,
    waterMl: null
  };

  it('maps the new fields', () => {
    const mapped = mapDiaryItem(wire);
    expect(mapped.foodGroup).toBe('NUTS');
    expect(mapped.gramsConsumed).toBe(20);
    expect(mapped.categoryCode).toBe('NUTS_SEEDS');
    expect(mapped.amount).toBe('20 g');
    expect(mapped.carbsGrams).toBe(4);
    expect(mapped.fiberGrams).toBe(2.6);
    expect(mapped.sugarGrams).toBeNull();
  });

  it('keeps the draft a saved meal needs', () => {
    expect(mapDiaryItem(wire).draft).toEqual(jasmine.objectContaining({ foodCatalogItemId: 'f1', foodServingId: 's1', foodName: 'Almonds', calories: 116 }));
  });

  it('copes with an old response that lacks the new fields', () => {
    const mapped = mapDiaryItem({ foodName: 'Toast', calories: 80 });
    expect(mapped.foodGroup).toBeNull();
    expect(mapped.gramsConsumed).toBeNull();
    expect(mapped.waterMl).toBeNull();
    expect(mapped.amount).toBe('1 serving');
  });

  it('reads OTHER and an unknown word as no group', () => {
    expect(mapDiaryItem({ foodName: 'x', foodGroup: 'OTHER' }).foodGroup).toBeNull();
    expect(mapDiaryItem({ foodName: 'x', foodGroup: 'MYSTERY' }).foodGroup).toBeNull();
  });
});

describe('mapDiaryMeal', () => {
  it('upper-cases the type and maps the items', () => {
    const meal = mapDiaryMeal({ mealId: 'm', mealType: 'lunch', totalCalories: 300, items: [{ foodName: 'Rice' }, 'junk'] });
    expect(meal.mealType).toBe('LUNCH');
    expect(meal.items.length).toBe(1);
    expect(meal.totalCalories).toBe(300);
  });
});

describe('mapDiarySummary', () => {
  it('leaves balance and protein by meal null when the backend sends none', () => {
    const summary = mapDiarySummary({ totalCalories: 100, targetCalories: null });
    expect(summary.balance).toBeNull();
    expect(summary.proteinByMeal).toBeNull();
    expect(summary.targetCalories).toBeNull();
  });

  it('maps balance entries and drops a broken one', () => {
    const summary = mapDiarySummary({
      balance: [
        { code: 'FIBER', displayName: 'Fibre', kind: 'TARGET', amount: 15, unit: 'g', reference: 28, share: 0.54, met: false, over: false, topSources: [{ foodName: 'Apple', amount: 4 }] },
        { code: 'SUGAR', kind: 'LIMIT', amount: 5, reference: 0 }
      ],
      proteinByMeal: { weightKg: 72, lowGrams: 22, highGrams: 29, meals: [{ mealType: 'lunch', grams: 40 }] }
    });
    expect(summary.balance?.length).toBe(1);
    expect(summary.balance?.[0].topSources[0].foodName).toBe('Apple');
    expect(summary.proteinByMeal?.meals[0].mealType).toBe('LUNCH');
  });

  it('keeps a balance entry with no amount as unknown, not as zero', () => {
    const entry = mapDiarySummary({
      balance: [{ code: 'FIBER', displayName: 'Fibre', kind: 'TARGET', amount: null, unit: 'g', reference: 28, share: null, met: null, over: null, topSources: [] }]
    }).balance?.[0];
    expect(entry?.amount).toBeNull();
    expect(entry?.share).toBeNull();
    expect(entry?.met).toBeFalse();
    expect(entry?.over).toBeFalse();
  });

  it('treats an empty balance list as missing so the card hides', () => {
    expect(mapDiarySummary({ balance: [] }).balance).toBeNull();
  });

  it('ignores a protein by meal without a band', () => {
    expect(mapDiarySummary({ proteinByMeal: { meals: [] } }).proteinByMeal).toBeNull();
  });
});

describe('mapRangeDay and mapWaterDay', () => {
  it('keeps flags null for a day with no meals', () => {
    const day = mapRangeDay({ date: '2026-10-01', logged: false, totalCalories: 0, fiberMet: null });
    expect(day.logged).toBeFalse();
    expect(day.fiberMet).toBeNull();
    expect(day.targetCalories).toBeNull();
  });

  it('maps the water day with the new drink fields, or null when they are missing', () => {
    const full = mapWaterDay({ totalMl: 500, fromDrinksMl: 220, entries: [{ waterId: 'w', amountMl: 250, loggedAt: 'x' }], drinkEntries: [{ mealItemId: 'i', foodName: 'Latte', waterMl: 220 }] }, '2026-10-02');
    expect(full.fromDrinksMl).toBe(220);
    expect(full.drinkEntries[0].foodName).toBe('Latte');
    const old = mapWaterDay({ totalMl: 500 }, '2026-10-02');
    expect(old.fromDrinksMl).toBeNull();
    expect(old.date).toBe('2026-10-02');
  });
});

describe('mapNutrientSummary', () => {
  it('maps rows, focus codes and coverage, and drops a row without a reference', () => {
    const summary = mapNutrientSummary({
      daysLogged: 5,
      referenceLabel: 'for a man aged 19 to 30',
      focusCodes: ['VIT_B12', 7],
      coverage: { itemsLogged: 20, itemsWithoutNutrients: 4 },
      nutrients: [
        { code: 'VIT_D', displayName: 'Vitamin D', kind: 'VITAMIN', unit: 'µg', averageAmount: 5.1, reference: 15, share: 0.34, met: false, upperLimit: 100, aboveUpperLimit: false, richestUsualFood: 'Salmon' },
        { code: 'BAD', averageAmount: 1 }
      ]
    });
    expect(summary.focusCodes).toEqual(['VIT_B12']);
    expect(summary.itemsWithoutNutrients).toBe(4);
    expect(summary.nutrients.length).toBe(1);
    expect(summary.nutrients[0].richestUsualFood).toBe('Salmon');
  });

  it('keeps a nutrient with no amount as unknown, not as zero', () => {
    const row = mapNutrientSummary({ nutrients: [{ code: 'IRON', reference: 8, averageAmount: null, share: null, met: null }] }).nutrients[0];
    expect(row.averageAmount).toBeNull();
    expect(row.share).toBeNull();
  });

  it('has no coverage when the backend sends none', () => {
    expect(mapNutrientSummary({}).itemsWithoutNutrients).toBeNull();
  });
});

describe('drinks', () => {
  it('maps a drink option and skips a food without an id', () => {
    expect(mapDrinkOption({ foodId: 'oj', displayName: 'Orange juice', calories: 45, basisLabel: '100 ml', countsTowardWater: true })).toEqual({
      foodId: 'oj',
      name: 'Orange juice',
      calories: 45,
      basisLabel: '100 ml',
      countsTowardWater: true
    });
    expect(mapDrinkOption({ displayName: 'x' })).toBeNull();
  });

  it('maps a frequent drink with its draft and skips a custom food', () => {
    const drink = mapFrequentDrink({ foodCatalogItemId: 'latte', foodName: 'Latte', calories: 110, quantity: 1 });
    expect(drink?.draft.foodCatalogItemId).toBe('latte');
    expect(mapFrequentDrink({ customFoodId: 'c', foodName: 'Mine' })).toBeNull();
  });

  it('maps the drink detail with water and alcohol', () => {
    const detail = mapDrinkDetail({ foodId: 'b', displayName: 'Beer', basisQuantity: '100', basisUnit: 'ml', waterGrams: 92, alcoholGrams: 3.9, countsTowardWater: false, servings: [{ servingId: 's', millilitersEquivalent: 330 }] });
    expect(detail.alcoholGrams).toBe(3.9);
    expect(detail.countsTowardWater).toBeFalse();
    expect(detail.servings[0].millilitersEquivalent).toBe(330);
    expect(mapDrinkDetail({}).waterGrams).toBeNull();
  });
});
