import { FoodDetail } from '../../../core/fitsync.models';
import { item, meal } from '../diary/diary-testing.spec';
import { EditorRow, basisFactor, categoryCodeOf, editorErrors, editorTotals, hasErrors, moveItem, parseAmount, mealToRows, previewTags, rowGroups, toDraft, totalsOf } from './recipes-editor';
import { perServing } from './recipes-testing.spec';

function food(overrides: Partial<FoodDetail> = {}): FoodDetail {
  return {
    foodId: 'f1',
    displayName: 'Rolled oats',
    brandName: '',
    categoryName: 'Grains',
    scope: 'CATALOG',
    calories: 380,
    proteinGrams: 13,
    carbsGrams: 68,
    fatGrams: 7,
    fiberGrams: null,
    sugarGrams: null,
    sodiumMg: null,
    basisQuantity: 100,
    basisUnit: 'g',
    densityGramsPerMl: null,
    primaryBarcode: '',
    sourceDataset: null,
    servings: [],
    ...overrides
  };
}

function row(overrides: Partial<EditorRow> = {}): EditorRow {
  return { key: 1, foodCatalogItemId: 'f1', name: 'Rolled oats', grams: 160, detail: food(), group: 'GRAINS', categoryCode: null, ...overrides };
}

describe('basisFactor', () => {
  it('counts the grams over the basis amount', () => {
    expect(basisFactor(food(), 160)).toBeCloseTo(1.6);
    expect(basisFactor(food({ basisQuantity: 50 }), 100)).toBe(2);
  });

  it('turns grams into millilitres with the density for a food listed per ml', () => {
    expect(basisFactor(food({ basisUnit: 'ml', densityGramsPerMl: 1.03 }), 515)).toBeCloseTo(5);
  });

  it('takes a gram as a millilitre when there is no density', () => {
    expect(basisFactor(food({ basisUnit: 'ml' }), 250)).toBeCloseTo(2.5);
  });

  it('falls back to 100 for a basis that is not positive', () => {
    expect(basisFactor(food({ basisQuantity: 0 }), 50)).toBe(0.5);
  });
});

describe('editorTotals', () => {
  it('adds the rows and shares them by the servings', () => {
    const totals = editorTotals([row({ grams: 200 }), row({ key: 2, grams: 100, detail: food({ calories: 100, proteinGrams: 1, carbsGrams: 2, fatGrams: 3 }) })], 2);

    expect(totals.kcal).toBeCloseTo((380 * 2 + 100) / 2);
    expect(totals.proteinGrams).toBeCloseTo((26 + 1) / 2);
    expect(totals.counted).toBe(2);
    expect(totals.left).toBe(0);
  });

  it('leaves out a row with no figures or no amount and says how many', () => {
    const totals = editorTotals([row(), row({ key: 2, detail: null }), row({ key: 3, grams: null }), row({ key: 4, grams: 0 })], 1);

    expect(totals.counted).toBe(1);
    expect(totals.left).toBe(3);
  });

  it('treats servings that are not positive as one', () => {
    expect(editorTotals([row({ grams: 100 })], 0).kcal).toBe(380);
  });

  it('can show the server figures as they are', () => {
    expect(totalsOf(perServing(), 3)).toEqual({ kcal: 612, proteinGrams: 27, carbsGrams: 16, fatGrams: 49, counted: 3, left: 0 });
  });
});

describe('editorErrors', () => {
  const ok = { name: 'Oats', servings: 4, rows: [row()], steps: ['Stir.'] };

  it('has none for a good recipe', () => {
    expect(hasErrors(editorErrors(ok))).toBeFalse();
  });

  it('needs a name of at most 120 characters', () => {
    expect(editorErrors({ ...ok, name: '   ' }).name).toBeTruthy();
    expect(editorErrors({ ...ok, name: 'a'.repeat(121) }).name).toBeTruthy();
    expect(editorErrors({ ...ok, name: 'a'.repeat(120) }).name).toBeUndefined();
  });

  it('needs servings above 0 and at most 100', () => {
    expect(editorErrors({ ...ok, servings: null }).servings).toBeTruthy();
    expect(editorErrors({ ...ok, servings: 0 }).servings).toBeTruthy();
    expect(editorErrors({ ...ok, servings: 101 }).servings).toBeTruthy();
    expect(editorErrors({ ...ok, servings: 0.5 }).servings).toBeUndefined();
  });

  it('needs an ingredient, each with grams above 0', () => {
    expect(editorErrors({ ...ok, rows: [] }).ingredients).toBeTruthy();
    expect(editorErrors({ ...ok, rows: [row({ grams: null })] }).ingredients).toBeTruthy();
    expect(editorErrors({ ...ok, rows: [row({ grams: -5 })] }).ingredients).toBeTruthy();
    expect(editorErrors({ ...ok, rows: [row({ grams: 100001 })] }).ingredients).toBeTruthy();
    expect(editorErrors({ ...ok, rows: [row({ foodCatalogItemId: '' })] }).ingredients).toContain('no food');
  });

  it('allows blank steps but not too many or too long', () => {
    expect(editorErrors({ ...ok, steps: ['', '  '] }).steps).toBeUndefined();
    expect(editorErrors({ ...ok, steps: Array.from({ length: 61 }, () => 'x') }).steps).toBeTruthy();
    expect(editorErrors({ ...ok, steps: ['x'.repeat(1001)] }).steps).toBeTruthy();
  });
});

describe('toDraft and parseAmount', () => {
  it('trims the name, keeps the rows as written and drops blank steps', () => {
    expect(toDraft({ name: ' Oats ', servings: 2, rows: [row({ grams: 80 })], steps: [' Stir. ', ' '] })).toEqual({
      name: 'Oats',
      servings: 2,
      ingredients: [{ foodCatalogItemId: 'f1', grams: 80, displayText: 'Rolled oats' }],
      steps: ['Stir.']
    });
  });

  it('reads a number with a comma, and nothing from blank or text', () => {
    expect(parseAmount('2,5')).toBe(2.5);
    expect(parseAmount(' 80 ')).toBe(80);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  describe('reordering, categories and the preview', () => {
    it('moves an item to another place and leaves the list alone for a place that does not exist', () => {
      expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
      expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
      expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
      expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
      expect(moveItem(['a', 'b', 'c'], 0, 3)).toEqual(['a', 'b', 'c']);
      const original = ['a', 'b'];
      expect(moveItem(original, 0, 1)).not.toBe(original);
    });

    it('turns a category name into its code', () => {
      expect(categoryCodeOf('Meat & Poultry')).toBe('MEAT_POULTRY');
      expect(categoryCodeOf('Nuts & Seeds')).toBe('NUTS_SEEDS');
      expect(categoryCodeOf('Grains')).toBe('GRAINS');
      expect(categoryCodeOf('')).toBeNull();
      expect(categoryCodeOf(null)).toBeNull();
    });

    it('takes the three groups with the most grams', () => {
      const rows = [
        row({ key: 1, group: 'GRAINS', grams: 100 }),
        row({ key: 2, group: 'DAIRY', grams: 480 }),
        row({ key: 3, group: 'FRUIT', grams: 240 }),
        row({ key: 4, group: 'NUTS', grams: 64 }),
        row({ key: 5, group: null, grams: 900 })
      ];
      expect(rowGroups(rows)).toEqual(['DAIRY', 'FRUIT', 'GRAINS']);
      expect(rowGroups([])).toEqual([]);
    });

    it('tags a recipe from its rows with the thresholds of the contract', () => {
      const lentils = row({ detail: food({ calories: 300, proteinGrams: 25, fiberGrams: 11 }), grams: 100 });
      expect(previewTags([lentils])).toEqual(['High protein', 'High fibre']);
      const sweet = row({ detail: food({ calories: 400, proteinGrams: 1, sugarGrams: 60, sodiumMg: 700 }), grams: 100 });
      expect(previewTags([sweet])).toEqual(['High sugar', 'High salt']);
      expect(previewTags([row({ detail: food({ calories: 100, proteinGrams: 2 }) })])).toEqual([]);
    });

    it('says Vegetarian or Vegan only when every row has a category', () => {
      const plain = food({ calories: 100, proteinGrams: 1 });
      const veg = row({ detail: plain, categoryCode: 'VEGETABLES' });
      const milk = row({ key: 2, detail: plain, categoryCode: 'DAIRY' });
      const fish = row({ key: 3, detail: plain, categoryCode: 'SEAFOOD' });
      expect(previewTags([veg])).toEqual(['Vegan']);
      expect(previewTags([veg, milk])).toEqual(['Vegetarian']);
      expect(previewTags([veg, fish])).toEqual([]);
      expect(previewTags([veg, row({ key: 4, detail: plain, categoryCode: null })])).toEqual([]);
    });

    it('turns the foods of a meal into rows with the grams that were logged', () => {
      const custom = item({ mealItemId: 'x', foodName: 'Aunt Mei soup', draft: { ...item().draft, foodCatalogItemId: null, customFoodId: 'c1' } });
      const inServings = item({ mealItemId: 'y', foodName: 'Banana', gramsConsumed: null, draft: { ...item().draft, foodCatalogItemId: 'f2', unit: 'serving', quantity: 2 } });
      const inGrams = item({ mealItemId: 'z', foodName: 'Rice', gramsConsumed: null, draft: { ...item().draft, foodCatalogItemId: 'f3', unit: 'g', quantity: 150 } });
      const result = mealToRows(meal({ items: [item({ gramsConsumed: 203.37 }), custom, inServings, inGrams] }));
      expect(result.left).toBe(1);
      expect(result.rows.map((seed) => [seed.foodCatalogItemId, seed.name, seed.grams])).toEqual([
        ['food-1', 'Greek yogurt', 203.4],
        ['f2', 'Banana', null],
        ['f3', 'Rice', 150]
      ]);
      expect(result.rows[0].group).toBe('DAIRY');
      expect(mealToRows(meal({ items: [] }))).toEqual({ rows: [], left: 0 });
    });

    it('says nothing while a row has no amount or no figures', () => {
      expect(previewTags([])).toEqual([]);
      expect(previewTags([row({ grams: null })])).toEqual([]);
      expect(previewTags([row({ detail: null })])).toEqual([]);
    });
  });
});
