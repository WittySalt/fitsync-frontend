import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { detail, recipesServiceStub } from '../recipes/recipes-testing.spec';
import { RecipesService } from '../recipes/recipes.service';
import { DiaryRow, diaryRows } from './diary-food';
import { item, meal, spoken } from './diary-testing.spec';
import { RecipeRowComponent } from './recipe-row.component';

describe('diaryRows', () => {
  const part = (id: string, servings: number | null, calories: number) => item({ mealItemId: id, foodName: id, calories, proteinGrams: 10, carbsGrams: 5, fatGrams: 2, recipeId: 'r1', recipeServings: servings });

  it('keeps foods logged by hand as rows of their own', () => {
    const rows = diaryRows([meal({ items: [item({ mealItemId: 'a' }), item({ mealItemId: 'b' })] })]);

    expect(rows.map((row) => row.kind)).toEqual(['food', 'food']);
  });

  it('joins the items of one recipe in one meal into a row where the first one was, with the totals', () => {
    const rows = diaryRows([meal({ items: [part('salmon', 1, 300), item({ mealItemId: 'tea', calories: 2 }), part('avocado', 1, 312)] })]);

    expect(rows.map((row) => row.kind)).toEqual(['recipe', 'food']);
    const recipe = rows[0] as Extract<DiaryRow, { kind: 'recipe' }>;
    expect(recipe.items.length).toBe(2);
    expect(recipe.calories).toBe(612);
    expect(recipe.proteinGrams).toBe(20);
    expect(recipe.servings).toBe(1);
  });

  it('keeps one recipe logged in two meals as two rows', () => {
    const rows = diaryRows([meal({ mealId: 'm1', items: [part('a', 1, 100)] }), meal({ mealId: 'm2', items: [part('b', 2, 200)] })]);

    expect(rows.length).toBe(2);
    expect((rows[1] as Extract<DiaryRow, { kind: 'recipe' }>).servings).toBe(2);
  });

  it('keeps two different recipes of one meal apart', () => {
    const other = item({ mealItemId: 'x', recipeId: 'r2', recipeServings: 1 });

    expect(diaryRows([meal({ items: [part('a', 1, 100), other] })]).length).toBe(2);
  });
});

describe('RecipeRowComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;

  beforeEach(() => {
    service = recipesServiceStub();
    TestBed.configureTestingModule({ providers: [{ provide: RecipesService, useValue: service }] });
  });

  const row = (servings: number | null = 1): Extract<DiaryRow, { kind: 'recipe' }> => ({
    kind: 'recipe',
    recipeId: 'r1',
    servings,
    items: [item({ mealItemId: 'a', foodName: 'Salmon', calories: 300, recipeId: 'r1' }), item({ mealItemId: 'b', foodName: 'Avocado', calories: 312, recipeId: 'r1' })],
    calories: 612,
    proteinGrams: 27,
    carbsGrams: 16,
    fatGrams: 49
  });

  function render(value = row()): ComponentFixture<RecipeRowComponent> {
    const fixture = TestBed.createComponent(RecipeRowComponent);
    fixture.componentRef.setInput('row', value);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipeRowComponent>) => fixture.nativeElement as HTMLElement;

  it('shows the recipe name and cover, the servings of the whole, the ingredients and the macros', () => {
    const element = el(render());

    expect(element.querySelector('.name')?.textContent).toBe('Salmon Avocado Salad');
    expect(element.querySelector('app-recipe-cover img')).not.toBeNull();
    expect(element.querySelector('.macros')?.textContent).toBe('1 serving of 4 · 2 ingredients · P 27 · C 16 · F 49 g');
    expect(element.querySelector('.kcal')?.textContent).toBe('612');
  });

  it('says servings in the plural and drops the count when the server did not send it', () => {
    expect(el(render(row(2))).querySelector('.macros')?.textContent).toContain('2 servings of 4');
    expect(el(render(row(null))).querySelector('.macros')?.textContent).toBe('2 ingredients · P 27 · C 16 · F 49 g');
  });

  it('folds the ingredients under Show ingredients and unfolds them on a press', () => {
    const fixture = render();
    const toggle = el(fixture).querySelector('.toggle') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).toBe('Show ingredients');
    expect(el(fixture).querySelectorAll('app-food-row').length).toBe(0);

    toggle.click();
    fixture.detectChanges();

    expect(toggle.textContent?.trim()).toBe('Hide ingredients');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(el(fixture).querySelectorAll('app-food-row')).map((food) => spoken(food).split(' ')[0])).toEqual(['Salmon', 'Avocado']);
  });

  it('says Recipe with a plain cover when the recipe cannot be read, and still works', () => {
    service.lookup.and.returnValue(of(null));
    const element = el(render());

    expect(element.querySelector('.name')?.textContent).toBe('Recipe');
    expect(element.querySelector('app-recipe-cover img')).toBeNull();
    expect(element.querySelector('.macros')?.textContent).toBe('1 serving · 2 ingredients · P 27 · C 16 · F 49 g');
  });

  it('reads the recipe by its id', () => {
    render();

    expect(service.lookup).toHaveBeenCalledWith('r1');
    expect(detail().servings).toBe(4);
  });
});
