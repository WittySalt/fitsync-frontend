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
