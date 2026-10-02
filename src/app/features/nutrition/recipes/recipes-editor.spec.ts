import { FoodDetail } from '../../../core/fitsync.models';
import { EditorRow, basisFactor, editorErrors, editorTotals, hasErrors, parseAmount, toDraft, totalsOf } from './recipes-editor';
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
});
