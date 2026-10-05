import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FoodCategory, FoodServing } from '../../core/fitsync.models';
import { DrinkDetail, DrinkOption, FrequentDrink } from './diary/diary.models';
import { BuilderHarness, createBuilder, foodDetail, searchItem } from './meal-builder-testing.spec';

describe('MealBuilderComponent drinks row', () => {
  const bottle: FoodServing = {
    servingId: 'water-250',
    label: '250 ml',
    quantity: 250,
    unit: 'ml',
    gramsEquivalent: 250,
    millilitersEquivalent: 250,
    sortOrder: 0,
    defaultServing: true
  };
  const water: DrinkDetail = {
    ...foodDetail('water', 'Water', 0, [bottle]),
    basisQuantity: 100,
    basisUnit: 'ml',
    foodGroup: 'DRINKS',
    countsTowardWater: true,
    waterGrams: 100,
    alcoholGrams: null
  };
  const waterOption: DrinkOption = { foodId: 'water', name: 'Water', calories: 0, basisLabel: '100 ml', countsTowardWater: true };
  const beverages: FoodCategory = {
    categoryId: 'cat-bev',
    parentId: null,
    code: 'BEVERAGES',
    displayName: 'Beverages',
    slug: 'beverages',
    sortOrder: 1,
    children: []
  };
  const latte: FrequentDrink = {
    name: 'Oat latte',
    calories: 120,
    draft: {
      foodCatalogItemId: 'latte',
      customFoodId: null,
      foodServingId: null,
      foodName: 'Oat latte',
      brandName: null,
      quantity: 1,
      unit: 'serving',
      servingSize: 300,
      servingUnit: 'ml',
      snapshotServingLabel: '300 ml',
      calories: 120,
      proteinGrams: 3,
      carbsGrams: 18,
      fatGrams: 4,
      fiberGrams: null,
      sugarGrams: null,
      sodiumMg: null
    }
  };
  let h: BuilderHarness;

  beforeEach(async () => {
    h = await createBuilder([water], [searchItem('water', 'Water')], ({ data, diary }) => {
      diary.searchDrinks.and.returnValue(of([waterOption]));
      diary.getDrinkDetail.and.returnValue(of(water));
      diary.frequentDrinks.and.returnValue(of([latte]));
      data.getFoodCategories.and.returnValue(of([beverages]));
    });
  });

  function chips(): string[] {
    return Array.from(h.el.querySelectorAll('app-builder-drinks button')).map((button) => button.textContent!.replace(/\s+/g, ' ').trim());
  }

  function chip(text: string): HTMLButtonElement {
    return Array.from(h.el.querySelectorAll<HTMLButtonElement>('app-builder-drinks button')).find((button) => button.textContent!.includes(text))!;
  }

  it('shows the Drinks row above the results with a glass, a bottle, the recent drink and a search chip', () => {
    expect(chips()).toEqual(['Glass 250 ml', 'Bottle 500 ml', 'Oat latte', 'Search drinks']);
    const row = h.el.querySelector('app-builder-drinks')!;
    const list = h.el.querySelector('.food-list')!;
    expect(row.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds a glass of water as a normal meal item that counts its water', () => {
    chip('Glass').click();
    h.fixture.detectChanges();

    const item = h.component.items()[0];
    expect(item.foodCatalogItemId).toBe('water');
    expect(item.foodName).toBe('Water');
    expect(item.calories).toBe(0);
    expect(h.el.querySelectorAll('.meal-item').length).toBe(1);

    chip('Bottle').click();
    h.fixture.detectChanges();
    expect(h.component.items().length).toBe(1);
    expect(h.component.items()[0].quantity).toBeCloseTo(3, 5);
  });

  it('adds the recent drink with the amount it was last logged with', () => {
    chip('Oat latte').click();
    h.fixture.detectChanges();

    expect(h.component.items()[0]).toEqual(jasmine.objectContaining({ foodName: 'Oat latte', calories: 120, snapshotServingLabel: '300 ml' }));
  });

  it('filters the search to the beverages category', () => {
    h.data.searchFoodsPage.calls.reset();
    chip('Search drinks').click();
    h.fixture.detectChanges();

    expect(h.component.selectedCategory()?.code).toBe('BEVERAGES');
    expect(h.data.searchFoodsPage).toHaveBeenCalledWith('', jasmine.objectContaining({ categoryId: 'cat-bev' }));
  });

  it('leaves out the water chips when the catalogue has no water, and disables the search chip without categories', async () => {
    TestBed.resetTestingModule();
    const bare = await createBuilder([], [], ({ diary }) => {
      diary.searchDrinks.and.returnValue(of([]));
    });

    const labels = Array.from(bare.el.querySelectorAll<HTMLButtonElement>('app-builder-drinks button'));
    expect(labels.map((button) => button.textContent!.trim())).toEqual(['Search drinks']);
    expect(labels[0].disabled).toBeTrue();
  });
});

describe('MealBuilderComponent glass of water on the real catalogue shape', () => {
  const serving = (id: string, label: string, quantity: number, unit: string, grams: number, isDefault = false): FoodServing => ({
    servingId: id,
    label,
    quantity,
    unit,
    gramsEquivalent: grams,
    millilitersEquivalent: null,
    sortOrder: 0,
    defaultServing: isDefault
  });
  const waterOf = (servings: FoodServing[]): DrinkDetail => ({
    ...foodDetail('water', 'Water, bottled, generic', 0, servings),
    foodGroup: 'DRINKS',
    countsTowardWater: true,
    waterGrams: 100,
    alcoholGrams: null
  });
  const option: DrinkOption = { foodId: 'water', name: 'Water, bottled, generic', calories: 0, basisLabel: '100 g', countsTowardWater: true };
  const beverages: FoodCategory = { categoryId: 'cat-bev', parentId: null, code: 'BEVERAGES', displayName: 'Beverages', slug: 'beverages', sortOrder: 1, children: [] };

  async function open(water: DrinkDetail): Promise<BuilderHarness> {
    const h = await createBuilder([water], [], ({ data, diary }) => {
      diary.searchDrinks.and.returnValue(of([option]));
      diary.getDrinkDetail.and.returnValue(of(water));
      data.getFoodCategories.and.returnValue(of([beverages]));
    });
    return h;
  }

  const chip = (h: BuilderHarness, text: string) =>
    Array.from(h.el.querySelectorAll<HTMLButtonElement>('app-builder-drinks button')).find((button) => button.textContent!.includes(text))!;

  it('logs a glass as 250 of the 1 ml serving, not as the default 1 fl oz', async () => {
    const h = await open(
      waterOf([
        serving('w-100', '100 g', 100, 'g', 100),
        serving('w-floz', '1 fl oz', 1, 'fl oz', 29.6, true),
        serving('w-cup', '1 cup', 1, 'cup', 237),
        serving('w-ml', '1 ml', 1, 'ml', 1)
      ])
    );
    chip(h, 'Glass').click();
    h.fixture.detectChanges();

    const select = h.el.querySelector<HTMLSelectElement>('.meal-item .serving-select')!;
    expect(select.selectedOptions[0].textContent?.trim()).toBe('1 ml');
    h.component.saveMeal();
    const sent = h.data.createMeal.calls.mostRecent().args[0].items[0];
    expect(sent.foodServingId).toBe('w-ml');
    expect(sent.quantity).toBe(250);
    expect(sent.servingSize).toBe(1);
    expect(sent.servingUnit).toBe('ml');
    // 250 of a 1 g serving is 250 g of water, not the 29.6 g of the default serving.
    expect(sent.quantity * (sent.servingSize ?? 0)).toBe(250);
  });

  it('adds a bottle to the same row as 750 ml in all', async () => {
    const h = await open(waterOf([serving('w-floz', '1 fl oz', 1, 'fl oz', 29.6, true), serving('w-ml', '1 ml', 1, 'ml', 1)]));
    chip(h, 'Glass').click();
    chip(h, 'Bottle').click();
    h.fixture.detectChanges();

    expect(h.component.items().length).toBe(1);
    expect(h.component.items()[0].foodServingId).toBe('w-ml');
    expect(h.component.items()[0].quantity).toBe(750);
  });

  it('uses a serving of exactly the amount when the catalogue has one', async () => {
    const h = await open(waterOf([serving('w-glass', '250 ml', 250, 'ml', 250, true), serving('w-ml', '1 ml', 1, 'ml', 1)]));
    chip(h, 'Glass').click();

    expect(h.component.items()[0].foodServingId).toBe('w-glass');
    expect(h.component.items()[0].quantity).toBe(1);
  });

  it('falls back to 250 g typed in grams when no serving has a volume, with no serving id', async () => {
    const h = await open(waterOf([serving('w-100', '100 g', 100, 'g', 100), serving('w-cup', '1 cup', 1, 'cup', 237, true)]));
    chip(h, 'Glass').click();
    h.fixture.detectChanges();

    expect(h.el.querySelector<HTMLInputElement>('.grams-field input')?.value).toBe('250');
    h.component.saveMeal();
    const sent = h.data.createMeal.calls.mostRecent().args[0].items[0];
    expect(sent.foodServingId).toBeNull();
    expect(sent.servingSize).toBe(250);
    expect(sent.servingUnit).toBe('g');
  });
});
