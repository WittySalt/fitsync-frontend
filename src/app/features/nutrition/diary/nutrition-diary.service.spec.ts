import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { Meal } from '../../../core/fitsync.models';
import { NutritionDiaryService } from './nutrition-diary.service';
import { item } from './diary-testing.spec';

describe('NutritionDiaryService', () => {
  let service: NutritionDiaryService;
  let http: HttpTestingController;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['createMeal']);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: FitSyncDataService, useValue: dataService }]
    });
    service = TestBed.inject(NutritionDiaryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the daily summary with the date and no timezone parameter', () => {
    let result: unknown;
    service.getSummary('2026-10-02').subscribe((value) => (result = value));
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/summary/daily');
    expect(request.request.params.get('date')).toBe('2026-10-02');
    expect(request.request.params.has('timezone')).toBeFalse();
    request.flush({ totalCalories: 1200, targetCalories: 2100 });
    expect(result).toEqual(jasmine.objectContaining({ totalCalories: 1200, balance: null }));
  });

  it('lets a summary failure through so the page can show its retry', () => {
    let failed = false;
    service.getSummary('2026-10-02').subscribe({ error: () => (failed = true) });
    http.expectOne((req) => req.url === '/api/v1/nutrition/summary/daily').flush('no', { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
  });

  it('reads the meals of a local day by its first and last instant', () => {
    let count = -1;
    service.getMeals('2026-10-02').subscribe((meals) => (count = meals.length));
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/meals');
    expect(new Date(request.request.params.get('from') ?? '').getHours()).toBe(0);
    expect(new Date(request.request.params.get('to') ?? '').getMinutes()).toBe(59);
    request.flush([{ mealId: 'm1', mealType: 'LUNCH', items: [{ mealItemId: 'i1', foodName: 'Rice' }] }]);
    expect(count).toBe(1);
  });

  it('reads the range and returns an empty list when the body has no days', () => {
    const results: number[] = [];
    service.getRange('2026-09-28', '2026-10-04').subscribe((days) => results.push(days.length));
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/summary/range');
    expect(request.request.params.get('from')).toBe('2026-09-28');
    expect(request.request.params.get('to')).toBe('2026-10-04');
    request.flush({ from: '2026-09-28', to: '2026-10-04', days: [{ date: '2026-09-28', logged: true, totalCalories: 2000 }] });
    service.getRange('2026-09-28', '2026-10-04').subscribe((days) => results.push(days.length));
    http.expectOne((req) => req.url === '/api/v1/nutrition/summary/range').flush({});
    expect(results).toEqual([1, 0]);
  });

  it('reads water and nutrients for their periods', () => {
    service.getWater('2026-10-02').subscribe();
    const water = http.expectOne((req) => req.url === '/api/v1/nutrition/water');
    expect(water.request.params.get('date')).toBe('2026-10-02');
    water.flush({});

    service.getNutrients('2026-09-26', '2026-10-02').subscribe();
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/nutrients/summary');
    expect(request.request.params.get('from')).toBe('2026-09-26');
    request.flush({});
  });

  it('limits drink search, recent drinks and frequent drinks to the drinks group', () => {
    service.searchDrinks('orange').subscribe();
    const search = http.expectOne((req) => req.url === '/api/v1/nutrition/foods/search');
    expect(search.request.params.get('foodGroup')).toBe('DRINKS');
    expect(search.request.params.get('q')).toBe('orange');
    search.flush({ content: [{ foodId: 'oj', displayName: 'Orange juice', calories: 45, basisLabel: '100 ml' }, { displayName: 'No id' }] });

    let recent = 0;
    service.recentDrinks().subscribe((drinks) => (recent = drinks.length));
    const recentRequest = http.expectOne((req) => req.url === '/api/v1/nutrition/foods/recent');
    expect(recentRequest.request.params.get('foodGroup')).toBe('DRINKS');
    recentRequest.flush([{ foodCatalogItemId: 'latte', foodName: 'Latte' }]);
    expect(recent).toBe(1);

    let names: string[] = [];
    service.frequentDrinks(2).subscribe((drinks) => (names = drinks.map((drink) => drink.name)));
    const frequent = http.expectOne((req) => req.url === '/api/v1/nutrition/foods/frequent');
    expect(frequent.request.params.get('limit')).toBe('2');
    expect(frequent.request.params.get('foodGroup')).toBe('DRINKS');
    frequent.flush([{ foodCatalogItemId: 'tea', foodName: 'Green tea', quantity: 1, calories: 0 }, { foodName: 'Custom, skipped' }]);
    expect(names).toEqual(['Green tea']);
  });

  it('reads a drink in detail', () => {
    let name = '';
    service.getDrinkDetail('oj').subscribe((detail) => (name = detail.displayName));
    http.expectOne('/api/v1/nutrition/foods/oj').flush({ foodId: 'oj', displayName: 'Orange juice', waterGrams: 88 });
    expect(name).toBe('Orange juice');
  });

  it('logs plain water at a moment and gives back the id for the undo', () => {
    let id = '';
    const at = new Date(2026, 9, 2, 16, 30);
    service.logWater(250, at).subscribe((entry) => (id = entry.waterId));
    const request = http.expectOne('/api/v1/nutrition/water');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ amountMl: 250, loggedAt: at.toISOString() });
    request.flush({ waterId: 'w-9', amountMl: 250 });
    expect(id).toBe('w-9');
  });

  it('deletes water and meals by id', () => {
    service.deleteWater('w-9').subscribe();
    const water = http.expectOne('/api/v1/nutrition/water/w-9');
    expect(water.request.method).toBe('DELETE');
    water.flush(null);

    service.deleteMeal('m-1').subscribe();
    const meal = http.expectOne('/api/v1/nutrition/meals/m-1');
    expect(meal.request.method).toBe('DELETE');
    meal.flush(null);
  });

  it('marks a past day as fasted with a FAST meal that has no foods, put at midday of that day', () => {
    dataService.createMeal.and.returnValue(of({ mealId: 'm-3' } as Meal));
    service.markFasted('2026-09-29', '2026-10-05').subscribe();
    const draft = dataService.createMeal.calls.mostRecent().args[0];

    expect(draft.mealType).toBe('FAST');
    expect(draft.items).toEqual([]);
    const at = new Date(draft.consumedAt ?? '');
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2026, 8, 29, 12]);
  });

  it('logs a drink as a meal of one food with the meal type the clock gives', () => {
    dataService.createMeal.and.returnValue(of({ mealId: 'm-2' } as Meal));
    const at = new Date(2026, 9, 2, 8, 0);
    service.logDrink(item().draft, at).subscribe();
    const draft = dataService.createMeal.calls.mostRecent().args[0];
    expect(draft.mealType).toBe('BREAKFAST');
    expect(draft.items.length).toBe(1);
    expect(draft.consumedAt).toBe(at.toISOString());
  });
});
