import { Subject } from 'rxjs';

import { FoodDetail, FoodServing } from '../../core/fitsync.models';
import { BuilderHarness, createBuilder, foodDetail, hundredGrams, searchItem } from './meal-builder-testing.spec';
import { defaultMealType } from './meal-builder.component';

describe('MealBuilderComponent rows', () => {
  const rice = foodDetail('rice', 'Rice', 130, [hundredGrams('rice-100')]);
  const egg = foodDetail('egg', 'Egg', 150, [hundredGrams('egg-100')]);
  let h: BuilderHarness;

  beforeEach(async () => {
    h = await createBuilder([rice, egg], [searchItem('rice', 'Rice'), searchItem('egg', 'Egg')]);
  });

  function quantityInputs(): HTMLInputElement[] {
    return Array.from(h.el.querySelectorAll<HTMLInputElement>('.meal-item input[type="number"]'));
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    h.fixture.detectChanges();
  }

  it('keeps each row quantity on its own and prices each row by its own quantity', () => {
    h.component.addFoodResult(searchItem('rice', 'Rice'));
    h.component.addFoodResult(searchItem('egg', 'Egg'));
    h.fixture.detectChanges();

    type(quantityInputs()[0], '2');
    type(quantityInputs()[1], '1');

    expect(quantityInputs().map((input) => input.value)).toEqual(['2', '1']);
    expect(h.component.items().map((item) => [item.quantity, item.calories])).toEqual([[2, 260], [1, 150]]);

    type(quantityInputs()[1], '3');

    expect(quantityInputs().map((input) => input.value)).toEqual(['2', '3']);
    expect(h.component.items().map((item) => item.calories)).toEqual([260, 450]);
    expect(h.component.totals().calories).toBe(710);
  });

  it('keeps the steppers of two rows apart', () => {
    h.component.addFoodResult(searchItem('rice', 'Rice'));
    h.component.addFoodResult(searchItem('egg', 'Egg'));
    const [first, second] = h.component.items();

    h.component.incrementItem(first.id, 1);

    expect(h.component.items().map((item) => item.quantity)).toEqual([2, 1]);
    expect(second.quantity).toBe(1);
  });

  it('reads the default meal type once, from the clock', () => {
    expect(defaultMealType(new Date(2026, 9, 5, 8, 0))).toBe('BREAKFAST');
    expect(defaultMealType(new Date(2026, 9, 5, 12, 30))).toBe('LUNCH');
    expect(defaultMealType(new Date(2026, 9, 5, 15, 30))).toBe('SNACK');
    expect(defaultMealType(new Date(2026, 9, 5, 19, 0))).toBe('DINNER');
    expect(defaultMealType(new Date(2026, 9, 5, 23, 30))).toBe('SNACK');
  });

  it('names the default meal from a signal, so a late meal type change does not raise NG0100', () => {
    h.component.setMealType('LUNCH');
    h.fixture.detectChanges();
    expect(h.el.querySelector('.label-note-toggle small')?.textContent).toContain('defaults to "Lunch"');

    // The page sets the meal type after the builder rendered. The check that follows must not throw.
    h.component.setMealType('DINNER');
    expect(() => h.fixture.detectChanges()).not.toThrow();
    expect(h.el.querySelector('.label-note-toggle small')?.textContent).toContain('defaults to "Dinner"');
  });
});

describe('MealBuilderComponent serving select', () => {
  const sandwich: FoodServing = {
    servingId: 'mac-1',
    label: '1 sandwich',
    quantity: 1,
    unit: 'sandwich',
    gramsEquivalent: 200,
    millilitersEquivalent: null,
    sortOrder: 0,
    defaultServing: true
  };
  const mac = foodDetail('mac', 'Big Mac', 250, [sandwich, hundredGrams('mac-100')]);
  let h: BuilderHarness;

  beforeEach(async () => {
    h = await createBuilder([mac], [searchItem('mac', 'Big Mac', { defaultServing: { servingId: 'mac-1', label: '1 sandwich', gramsEquivalent: 200 } })]);
  });

  function select(): HTMLSelectElement {
    return h.el.querySelector<HTMLSelectElement>('.meal-item .serving-select')!;
  }

  function choose(value: string): void {
    const element = select();
    element.value = value;
    element.dispatchEvent(new Event('change'));
    h.fixture.detectChanges();
  }

  function addMac(): void {
    h.component.addFoodResult(searchItem('mac', 'Big Mac', { defaultServing: { servingId: 'mac-1', label: '1 sandwich', gramsEquivalent: 200 } }));
    h.fixture.detectChanges();
  }

  it('adds a row on the serving the search named and offers every serving then custom grams', () => {
    addMac();

    expect(Array.from(select().options).map((option) => option.textContent?.trim())).toEqual(['1 sandwich', '100 g', 'Custom grams']);
    expect(select().selectedOptions[0].textContent?.trim()).toBe('1 sandwich');
    expect(h.component.items()[0].calories).toBe(500);
  });

  it('keeps the quantity as a count of the chosen serving and prices it by grams', () => {
    addMac();
    h.component.updateItemQuantity(h.component.items()[0].id, '2');
    expect(h.component.items()[0].calories).toBe(1000);

    choose('mac-100');

    const item = h.component.items()[0];
    expect(item.quantity).toBe(2);
    expect(item.foodServingId).toBe('mac-100');
    expect(item.calories).toBe(500);
  });

  it('reveals a grams field for custom grams, carrying over the weight, and logs it without a serving id', () => {
    addMac();
    h.component.updateItemQuantity(h.component.items()[0].id, '2');
    expect(h.el.querySelector('.grams-field')).toBeNull();

    choose('__custom_grams__');

    const grams = h.el.querySelector<HTMLInputElement>('.grams-field input')!;
    expect(grams.value).toBe('400');
    expect(h.el.querySelector('.meal-item .stepper')).toBeNull();

    grams.value = '150';
    grams.dispatchEvent(new Event('input'));
    h.fixture.detectChanges();
    expect(h.component.items()[0].calories).toBe(375);

    h.component.saveMeal();
    const sent = h.data.createMeal.calls.mostRecent().args[0].items[0];
    expect(sent.foodServingId).toBeNull();
    expect(sent.snapshotServingLabel).toBe('150 g');
    expect(sent.calories).toBe(375);
    expect(Object.keys(sent)).not.toContain('custom');
    expect(Object.keys(sent)).not.toContain('grams');
  });

  it('goes back from custom grams to a serving count of one', () => {
    addMac();
    choose('__custom_grams__');
    choose('mac-1');

    expect(h.component.items()[0].custom).toBeFalsy();
    expect(h.component.items()[0].quantity).toBe(1);
    expect(h.component.items()[0].calories).toBe(500);
    expect(h.el.querySelector('.meal-item .stepper')).not.toBeNull();
  });

  it('shows the logged serving until the food loads, then lets the person change it', () => {
    const detail$ = new Subject<FoodDetail | null>();
    h.data.getFoodDetail.and.returnValue(detail$);
    const pending = h.data.getFoodDetail.calls.count();
    h.component.addLoggedFoodToMeal({
      foodId: 'mac',
      customFoodId: null,
      foodServingId: 'mac-1',
      scope: 'CATALOG',
      foodName: 'Big Mac',
      brandName: '',
      servingLabel: '1 sandwich',
      quantity: 1,
      unit: 'serving',
      servingSize: 1,
      servingUnit: 'sandwich',
      calories: 500,
      proteinGrams: 24,
      carbsGrams: 40,
      fatGrams: 28,
      fiberGrams: null,
      sugarGrams: null,
      sodiumMg: null,
      timesLogged: 1,
      lastLoggedAt: null
    });
    h.fixture.detectChanges();

    expect(h.data.getFoodDetail.calls.count()).toBe(pending + 1);
    expect(select().disabled).toBeTrue();
    expect(select().options[0].textContent?.trim()).toBe('1 sandwich');

    detail$.next(mac);
    h.fixture.detectChanges();

    expect(select().disabled).toBeFalse();
    expect(select().selectedOptions[0].textContent?.trim()).toBe('1 sandwich');
    choose('mac-100');
    expect(h.component.items()[0].calories).toBe(250);
  });
});

describe('MealBuilderComponent tiles', () => {
  const rice = foodDetail('rice', 'Rice', 130, [hundredGrams('rice-100')]);
  const mac = { ...foodDetail('mac', 'Big Mac', 250, [hundredGrams('mac-100')]), brandName: "McDonald's" };
  const cereal = foodDetail('cereal', 'Corn flakes', 380, [hundredGrams('cereal-100')]);
  const results = [
    searchItem('rice', 'Rice', { categoryCode: 'GRAINS' }),
    searchItem('mac', 'Big Mac', { brandName: "McDonald's", categoryCode: 'MEAT_POULTRY' }),
    searchItem('cereal', 'Corn flakes', { brandName: 'Kellogg', imageUrl: 'https://images.example/flakes.jpg' })
  ];
  let h: BuilderHarness;

  beforeEach(async () => {
    h = await createBuilder([rice, mac, cereal], results);
  });

  function tiles(scope: string): HTMLElement[] {
    return Array.from(h.el.querySelectorAll<HTMLElement>(`${scope} app-food-tile`));
  }

  it('gives each search result a tile: group icon, brand letter or photo', () => {
    const [grains, brand, photo] = tiles('.food-row');

    expect((grains.querySelector('app-food-icon') as HTMLElement).style.getPropertyValue('--tile')).toBe('var(--food-grains)');
    expect(brand.querySelector('.brand')?.textContent?.trim()).toBe('M');
    expect(brand.querySelector('.brand')?.getAttribute('title')).toBe("McDonald's");
    expect(photo.querySelector('img')?.getAttribute('src')).toBe('https://images.example/flakes.jpg');
  });

  it('keeps the tile on the rows of the meal', () => {
    results.forEach((food) => h.component.addFoodResult(food));
    h.fixture.detectChanges();

    const [grains, brand, photo] = tiles('.meal-item');
    expect((grains.querySelector('app-food-icon') as HTMLElement).style.getPropertyValue('--tile')).toBe('var(--food-grains)');
    expect(brand.querySelector('.brand')?.textContent?.trim()).toBe('M');
    expect(photo.querySelector('img')).not.toBeNull();
  });
});
