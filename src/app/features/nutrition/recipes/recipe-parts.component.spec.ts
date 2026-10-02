import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LOADING, Load } from '../diary/diary.models';
import { spoken } from '../diary/diary-testing.spec';
import { FitTodayComponent } from './fit-today.component';
import { IngredientsCardComponent } from './ingredients-card.component';
import { RecipeHeroComponent } from './recipe-hero.component';
import { RecipeStepsComponent } from './recipe-steps.component';
import { ServingHighlightsComponent } from './serving-highlights.component';
import { SimilarRecipesComponent } from './similar-recipes.component';
import { TodayFit } from './recipes-figures';
import { card, detail, ingredient, perServing } from './recipes-testing.spec';

function mount<T>(component: new () => T, inputs: Record<string, unknown>): ComponentFixture<T> {
  const fixture = TestBed.createComponent(component);
  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  fixture.detectChanges();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

describe('RecipeHeroComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('puts the category, the name and the tags over the photo, with the credit', () => {
    const element = html(mount(RecipeHeroComponent, { recipe: detail({ dietFlags: ['VEGETARIAN'] }) }));

    expect(element.querySelector('.eyebrow')?.textContent).toBe('Seafood · British');
    expect(element.querySelector('h2')?.textContent).toBe('Salmon Avocado Salad');
    expect(Array.from(element.querySelectorAll('.tags span')).map((tag) => tag.textContent)).toEqual(['High protein', 'Vegetarian']);
    expect(element.querySelector('.credit')?.textContent).toBe('Photo from TheMealDB');
    expect(element.querySelector('.shade')).not.toBeNull();
  });

  it('draws a cover from the biggest groups when there is no photo', () => {
    const element = html(mount(RecipeHeroComponent, { recipe: detail({ imageUrl: null }) }));

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelectorAll('.dot').length).toBe(2);
    expect(element.querySelector('.credit')).toBeNull();
  });
});

describe('FitTodayComponent', () => {
  const ready = (overrides: Partial<TodayFit> = {}): Load<TodayFit> => ({
    status: 'ready',
    data: {
      calories: { label: 'Calories', before: 1268, after: 1880, of: 2100, unit: 'kcal', beforeShare: 0.6, afterShare: 0.895 },
      protein: { label: 'Protein', before: 87, after: 114, of: 140, unit: 'g', beforeShare: 0.62, afterShare: 0.81 },
      vitamin: { label: 'Vitamin D', before: 20, after: 74, of: 100, unit: '%', beforeShare: 0.2, afterShare: 0.74 },
      leftKcal: 220,
      ...overrides
    }
  });

  it('shows calories, protein and the vitamin as before, after and the target, and what is left', () => {
    const element = html(mount(FitTodayComponent, { state: ready(), servings: 1 }));
    const rows = Array.from(element.querySelectorAll('.row')).map((row) => spoken(row));

    expect(element.querySelector('.head strong')?.textContent).toBe('With this serving today');
    expect(element.querySelector('.head span')?.textContent).toBe('220 kcal left after');
    expect(rows[0]).toBe('Calories 1,268 → 1,880 of 2,100');
    expect(rows[1]).toBe('Protein 87 → 114 of 140 g');
    expect(rows[2]).toBe('Vitamin D 20% → 74% of a day');
  });

  it('says servings in the plural above one, and over rather than left when the day goes over', () => {
    const element = html(mount(FitTodayComponent, { state: ready({ leftKcal: -68 }), servings: 2 }));

    expect(element.querySelector('.head strong')?.textContent).toBe('With these servings today');
    expect(element.querySelector('.head span')?.textContent).toBe('68 kcal over after');
  });

  it('draws a solid bar for the day so far and a lighter one that carries on from it', () => {
    const element = html(mount(FitTodayComponent, { state: ready() }));
    const bars = element.querySelectorAll<HTMLElement>('.track')[0];

    expect(bars.querySelector<HTMLElement>('.before')?.style.width).toBe('60%');
    expect(bars.querySelector<HTMLElement>('.after')?.style.width).toBe('90%');
  });

  it('keeps a bar inside the track when the day goes over the target', () => {
    const element = html(
      mount(FitTodayComponent, {
        state: ready({ calories: { label: 'Calories', before: 2000, after: 2600, of: 2100, unit: 'kcal', beforeShare: 0.95, afterShare: 1.24 } })
      })
    );

    expect(element.querySelector<HTMLElement>('.track .after')?.style.width).toBe('100%');
  });

  it('leaves out a row it has nothing for', () => {
    const element = html(mount(FitTodayComponent, { state: ready({ vitamin: null }) }));

    expect(element.querySelectorAll('.row').length).toBe(2);
  });

  it('shows a skeleton while loading and its message on failure', () => {
    expect(html(mount(FitTodayComponent, { state: LOADING })).querySelector('.skeleton')).not.toBeNull();

    const failed = html(mount(FitTodayComponent, { state: { status: 'error', message: 'Today could not load.' } }));
    expect(failed.querySelector('.note')?.textContent).toBe('Today could not load.');
  });
});

describe('ServingHighlightsComponent', () => {
  it('shows a serving: kcal, protein, carbs, fat and its weight', () => {
    const element = html(mount(ServingHighlightsComponent, { perServing: perServing(), servingGrams: 440 }));

    expect(Array.from(element.querySelectorAll('.macros div')).map((cell) => spoken(cell))).toEqual(['612 kcal', '27 g protein', '16 g carbs', '49 g fat']);
    expect(element.querySelector('.head span')?.textContent).toBe('440 g');
  });

  it('lists the good sources as green chips with their share', () => {
    const element = html(mount(ServingHighlightsComponent, { perServing: perServing() }));
    const chips = Array.from(element.querySelectorAll('.chip.good')).map((chip) => spoken(chip));

    expect(chips).toEqual(['Vitamin E 61%', 'Vitamin D 54%']);
  });

  it('lists what it is higher in as grey chips, fat against the target', () => {
    const element = html(mount(ServingHighlightsComponent, { perServing: perServing({ fatGrams: 49 }), fatTarget: 70, tags: ['High salt'] }));
    const chips = Array.from(element.querySelectorAll('.group:last-child .chip')).map((chip) => spoken(chip));

    expect(chips).toEqual(['Fat 49 g, 70% of a day', 'Salt 300 mg sodium']);
    expect(element.querySelectorAll('.chip.good').length).toBe(2);
  });

  it('leaves both lists and the weight out when there is nothing to say', () => {
    const element = html(mount(ServingHighlightsComponent, { perServing: perServing({ nutrients: [], fatGrams: 5 }), fatTarget: 70 }));

    expect(element.querySelectorAll('.group').length).toBe(0);
    expect(element.querySelector('.head span')).toBeNull();
  });
});

describe('IngredientsCardComponent', () => {
  const rows = [ingredient(), ingredient({ ingredientId: 'i2', displayText: '3 Avocado', name: 'Avocado', grams: 453, foodGroup: 'FRUIT', categoryCode: 'FRUITS' })];

  beforeEach(() => {
    sessionStorage.removeItem('fitsync.recipe.ticks.r1');
    sessionStorage.removeItem('fitsync.recipe.ticks.r2');
  });

  const make = (inputs: Record<string, unknown> = {}) =>
    mount(IngredientsCardComponent, { recipeId: 'r1', ingredients: rows, recipeServings: 4, servings: 1, ...inputs });
  const grams = (fixture: ComponentFixture<unknown>) => Array.from(html(fixture).querySelectorAll('.grams')).map((cell) => cell.textContent);

  it('shows the friendly name and the grams for the chosen servings', () => {
    const fixture = make();

    expect(Array.from(html(fixture).querySelectorAll('.text')).map((cell) => cell.textContent)).toEqual(['Salmon', 'Avocado']);
    expect(grams(fixture)).toEqual(['100 g', '113 g']);
  });

  it('rescales the amounts with the servings', () => {
    const fixture = make({ servings: 2.5 });

    expect(grams(fixture)).toEqual(['250 g', '283 g']);
  });

  it('switches between the chosen servings and the whole recipe', () => {
    const fixture = make({ servings: 2 });
    const toggle = html(fixture).querySelectorAll<HTMLButtonElement>('.unit button');
    expect(Array.from(toggle).map((button) => button.textContent?.trim())).toEqual(['2 servings', 'Whole recipe']);

    toggle[1].click();
    fixture.detectChanges();

    expect(grams(fixture)).toEqual(['400 g', '453 g']);
    expect(toggle[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('shows no grams for an ingredient with no weight', () => {
    const fixture = make({ ingredients: [ingredient({ grams: null })] });

    expect(grams(fixture)).toEqual(['']);
  });

  it('ticks an ingredient, strikes it through and keeps the tick for the session', () => {
    const fixture = make();
    const tick = html(fixture).querySelector<HTMLButtonElement>('.tick');

    tick?.click();
    fixture.detectChanges();

    expect(html(fixture).querySelector('li')?.classList.contains('done')).toBeTrue();
    expect(tick?.getAttribute('aria-checked')).toBe('true');
    expect(JSON.parse(sessionStorage.getItem('fitsync.recipe.ticks.r1') ?? '[]')).toEqual(['i1']);

    const again = make();
    expect(html(again).querySelector('li')?.classList.contains('done')).toBeTrue();
    html(again).querySelector<HTMLButtonElement>('.tick')?.click();
    again.detectChanges();
    expect(html(again).querySelector('li')?.classList.contains('done')).toBeFalse();
  });

  it('keeps the ticks of one recipe apart from another', () => {
    make().nativeElement.querySelector('.tick')?.click();

    const other = make({ recipeId: 'r2' });
    expect(html(other).querySelector('li')?.classList.contains('done')).toBeFalse();
  });

  it('says so when a recipe has no ingredients listed', () => {
    expect(html(make({ ingredients: [] })).textContent).toContain('no ingredients listed');
  });
});

describe('RecipeStepsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('numbers the steps and links Start cooking to cook mode', () => {
    const element = html(mount(RecipeStepsComponent, { recipeId: 'r1', steps: detail().steps }));

    expect(Array.from(element.querySelectorAll('.number')).map((number) => number.textContent)).toEqual(['1', '2']);
    expect(element.querySelector('.cook')?.getAttribute('href')).toBe('/nutrition/recipes/r1/cook');
  });

  it('notes a timer in cook mode beside a step that has times, and runs none', () => {
    const element = html(mount(RecipeStepsComponent, { recipeId: 'r1', steps: detail().steps }));
    const items = element.querySelectorAll('li');

    expect(items[0].querySelector('.timer')).toBeNull();
    expect(items[1].querySelector('.timer')?.textContent?.trim()).toBe('Timer in cook mode');
  });

  it('ends with the credit', () => {
    const element = html(mount(RecipeStepsComponent, { recipeId: 'r1', steps: detail().steps }));

    expect(element.querySelector('.credit')?.textContent).toBe('Recipe and photo from TheMealDB. Nutrition worked out from USDA FoodData Central.');
  });

  it('says so and leaves the cook link out when a recipe has no steps', () => {
    const element = html(mount(RecipeStepsComponent, { recipeId: 'r1', steps: [] }));

    expect(element.querySelector('.hint')?.textContent).toContain('No steps');
    expect(element.querySelector('.cook')).toBeNull();
  });
});

describe('SimilarRecipesComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('shows each recipe with a link, its name and what a serving gives', () => {
    const element = html(mount(SimilarRecipesComponent, { cards: [card({ id: 'a', name: 'Honey Teriyaki Salmon', kcalPerServing: 398, proteinGramsPerServing: 31 })], category: 'Seafood' }));

    expect(element.querySelector('h3')?.textContent).toBe('More like this');
    expect(element.querySelector('.head span')?.textContent).toBe('also Seafood');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/nutrition/recipes/a');
    expect(spoken(element.querySelector('a'))).toContain('Honey Teriyaki Salmon');
    expect(element.querySelector('a span')?.textContent).toBe('398 kcal · 31 g protein');
  });

  it('shows nothing when there are no other recipes', () => {
    expect(html(mount(SimilarRecipesComponent, { cards: [] })).querySelector('h3')).toBeNull();
  });
});
