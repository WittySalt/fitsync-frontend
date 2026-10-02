import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { MAX_SEARCH_LENGTH, RecipesService } from './recipes.service';
import { savedMeal } from './recipes-testing.spec';

describe('RecipesService', () => {
  let service: RecipesService;
  let http: HttpTestingController;
  const base = '/api/v1/nutrition';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: FitSyncDataService, useValue: {} }]
    });
    service = TestBed.inject(RecipesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a scope with its filters, a trimmed search and at most 80 characters of it', () => {
    service.list({ scope: 'library', q: `  ${'a'.repeat(120)}  `, category: 'Seafood', diet: 'VEGAN', page: 2, size: 20 }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/recipes`);
    expect(request.request.params.get('scope')).toBe('library');
    expect(request.request.params.get('q')?.length).toBe(MAX_SEARCH_LENGTH);
    expect(request.request.params.get('category')).toBe('Seafood');
    expect(request.request.params.get('diet')).toBe('VEGAN');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ content: [], totalPages: 0 });
  });

  it('leaves the search out when it is blank', () => {
    service.list({ scope: 'mine', q: '   ' }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/recipes`);
    expect(request.request.params.has('q')).toBeFalse();
    request.flush({ content: [] });
  });

  it('walks every page of a query, fifty cards at a time', () => {
    let ids: string[] = [];
    service.listAll({ scope: 'library', diet: 'VEGAN' }).subscribe((cards) => (ids = cards.map((entry) => entry.id)));
    const first = http.expectOne((req) => req.params.get('page') === '0');
    expect(first.request.params.get('size')).toBe('50');
    expect(first.request.params.get('diet')).toBe('VEGAN');
    first.flush({ content: [{ id: 'a' }], number: 0, totalPages: 2 });
    http.expectOne((req) => req.params.get('page') === '1').flush({ content: [{ id: 'b' }], number: 1, totalPages: 2 });

    expect(ids).toEqual(['a', 'b']);
  });

  it('stops walking at twelve pages', () => {
    let count = 0;
    service.listAll({ scope: 'library' }).subscribe((cards) => (count = cards.length));
    for (let page = 0; page < 12; page++) {
      http.expectOne((req) => req.params.get('page') === String(page)).flush({ content: [{ id: 'p' + page }], number: page, totalPages: 40 });
    }

    expect(count).toBe(12);
  });

  it('walks the pages of the library once to find the categories', () => {
    const seen: string[][] = [];
    service.categories().subscribe((value) => seen.push(value));
    http.expectOne((req) => req.params.get('page') === '0').flush({ content: [{ id: 'a', category: 'Seafood' }], number: 0, totalPages: 2 });
    http.expectOne((req) => req.params.get('page') === '1').flush({ content: [{ id: 'b', category: 'Beef' }, { id: 'c', category: 'Seafood' }], number: 1, totalPages: 2 });
    service.categories().subscribe((value) => seen.push(value));

    expect(seen).toEqual([['Beef', 'Seafood'], ['Beef', 'Seafood']]);
  });

  it('gives no categories when the library cannot be read', () => {
    let result: string[] | undefined;
    service.categories().subscribe((value) => (result = value));
    http.expectOne((req) => req.url === `${base}/recipes`).flush('no', { status: 500, statusText: 'Server Error' });

    expect(result).toEqual([]);
  });

  it('remembers a lookup and gives null when the recipe cannot be read', () => {
    const results: unknown[] = [];
    service.lookup('gone').subscribe((value) => results.push(value));
    service.lookup('gone').subscribe((value) => results.push(value));
    http.expectOne(`${base}/recipes/gone`).flush('no', { status: 404, statusText: 'Not Found' });

    expect(results).toEqual([null, null]);
  });

  it('finds three like this one, without this one', () => {
    let names: string[] = [];
    service.similar('Seafood', 'a').subscribe((cards) => (names = cards.map((entry) => entry.id)));
    const request = http.expectOne((req) => req.url === `${base}/recipes`);
    expect(request.request.params.get('category')).toBe('Seafood');
    request.flush({ content: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] });

    expect(names).toEqual(['b', 'c', 'd']);
  });

  it('asks for nothing like this when there is no category', () => {
    let names: string[] | undefined;
    service.similar(null, 'a').subscribe((cards) => (names = cards.map((entry) => entry.id)));

    expect(names).toEqual([]);
  });

  it('creates a recipe with grams, display text and numbered steps, and answers its id', () => {
    let id = '';
    service
      .create({ name: ' Oats ', servings: 2, ingredients: [{ foodCatalogItemId: 'f1', grams: 80, displayText: 'Oats' }], steps: [' Stir. ', ''] })
      .subscribe((value) => (id = value));
    const request = http.expectOne(`${base}/recipes`);
    expect(request.request.body).toEqual({
      name: 'Oats',
      servings: 2,
      ingredients: [{ foodCatalogItemId: 'f1', quantity: 1, grams: 80, displayText: 'Oats' }],
      steps: [{ text: 'Stir.' }]
    });
    request.flush({ recipeId: 'new-1' });

    expect(id).toBe('new-1');
  });

  it('updates, deletes and copies by id', () => {
    service.update('r 1', { name: 'A', servings: 1, ingredients: [], steps: [] }).subscribe();
    const put = http.expectOne({ method: 'PUT', url: `${base}/recipes/r%201` });
    put.flush({ recipeId: 'r 1' });
    service.remove('r1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${base}/recipes/r1` }).flush(null);
    let copied = '';
    service.copy('r1').subscribe((recipe) => (copied = recipe.id));
    http.expectOne({ method: 'POST', url: `${base}/recipes/r1/copy` }).flush({ id: 'r2', name: 'Copy' });

    expect(put.request.body.name).toBe('A');
    expect(copied).toBe('r2');
  });

  it('saves and removes a favourite with POST and DELETE', () => {
    let calls = 0;
    service.setFavorite('r1', true).subscribe(() => calls++);
    http.expectOne({ method: 'POST', url: `${base}/recipes/r1/favorite` }).flush(null);
    service.setFavorite('r1', false).subscribe(() => calls++);
    http.expectOne({ method: 'DELETE', url: `${base}/recipes/r1/favorite` }).flush(null);

    expect(calls).toBe(2);
  });

  it('logs servings with the meal type, the moment and the time zone', () => {
    let mealId = '';
    service.logRecipe('r1', { servings: 1.5, mealType: 'LUNCH', consumedAt: new Date('2026-10-02T05:00:00Z') }).subscribe((meal) => (mealId = meal.mealId));
    const request = http.expectOne(`${base}/meals/from-recipe/r1`);
    expect(request.request.body).toEqual(jasmine.objectContaining({ servings: 1.5, mealType: 'LUNCH', consumedAt: '2026-10-02T05:00:00.000Z' }));
    expect(typeof request.request.body.timezone).toBe('string');
    request.flush({ mealId: 'm1' });

    expect(mealId).toBe('m1');
  });

  it('logs a saved meal now, under the meal type given', () => {
    service.logSavedMeal('t1', 'DINNER').subscribe();
    const request = http.expectOne(`${base}/meals/from-template/t1`);
    expect(request.request.body.mealType).toBe('DINNER');
    expect(request.request.body.consumedAt).toBeTruthy();
    request.flush({ mealId: 'm1' });
  });

  it('makes a new saved meal of one recipe', () => {
    service.createSavedMealWithRecipe('Lunch', 'LUNCH', 'r1', 2).subscribe();
    const request = http.expectOne(`${base}/meal-templates`);
    expect(request.request.body).toEqual({ name: 'Lunch', mealType: 'LUNCH', recipeItems: [{ recipeId: 'r1', servings: 2 }] });
    request.flush({});
  });

  it('rebuilds a saved meal with the recipe added and deletes the old one only after that worked', () => {
    let done = false;
    service.addRecipeToSavedMeal(savedMeal(), 'r1', 1).subscribe(() => (done = true));
    const create = http.expectOne({ method: 'POST', url: `${base}/meal-templates` });
    expect(create.request.body.items.length).toBe(1);
    expect(create.request.body.recipeItems).toEqual([{ recipeId: 'r1', servings: 1 }]);
    http.expectNone({ method: 'DELETE', url: `${base}/meal-templates/t1` });
    create.flush({});
    http.expectOne({ method: 'DELETE', url: `${base}/meal-templates/t1` }).flush(null);

    expect(done).toBeTrue();
  });

  it('keeps the old saved meal when the new one could not be saved', () => {
    let failed = false;
    service.addRecipeToSavedMeal(savedMeal(), 'r1', 1).subscribe({ error: () => (failed = true) });
    http.expectOne({ method: 'POST', url: `${base}/meal-templates` }).flush('no', { status: 400, statusText: 'Bad Request' });
    http.expectNone({ method: 'DELETE', url: `${base}/meal-templates/t1` });

    expect(failed).toBeTrue();
  });

  it('refuses to rebuild a saved meal that holds a food it cannot name', () => {
    let failed = false;
    service.addRecipeToSavedMeal(savedMeal({ raw: [{ foodName: 'Quick add', quantity: 1 }] }), 'r1', 1).subscribe({ error: () => (failed = true) });

    expect(failed).toBeTrue();
  });
});
