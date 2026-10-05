import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { mapFoodNutrition, mapFoodProgress, mapGoalProgress, mapReviews } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService } from './progress-api.service';
import { FOOD_WIRE, GOAL_WIRE, NUTRITION_WIRE, REVIEWS_WIRE } from './progress-testing.spec';

describe('ProgressApiService', () => {
  let service: ProgressApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProgressApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the goal with nothing but from and to', () => {
    let result: GoalProgress | null = null;
    service.getGoal('2026-07-06', '2026-10-03').subscribe((goal) => (result = goal));
    const request = http.expectOne((req) => req.url === '/api/v1/analytics/progress/goal');
    expect(request.request.params.keys().sort()).toEqual(['from', 'to']);
    expect(request.request.params.get('from')).toBe('2026-07-06');
    request.flush(GOAL_WIRE);
    expect(result!.hero.weeklyRate).toEqual({ value: -0.41, previous: -0.28 });
  });

  it('merges the analytics and nutrition halves of the food page', () => {
    let result: FoodProgress | null = null;
    service.getFood('2026-09-04', '2026-10-03').subscribe((food) => (result = food));
    const analytics = http.expectOne((req) => req.url === '/api/v1/analytics/progress/food');
    const nutrition = http.expectOne((req) => req.url === '/api/v1/nutrition/progress/food');
    expect(nutrition.request.params.keys().sort()).toEqual(['from', 'to']);
    analytics.flush(FOOD_WIRE);
    nutrition.flush(NUTRITION_WIRE);
    expect(result!.hero.daysLogged.value).toBe(26);
    expect(result!.nutrition?.lowestNutrients[0].displayName).toBe('Vitamin D');
    expect(result!.habits).toEqual({ waterMetDays: null, fibreMetDays: 11, loggedDays: 26 });
    const lowest = result!.highlights.find((h) => h.code === 'LOWEST_NUTRIENT')!;
    expect(lowest.title).toBe('Vitamin D is the furthest short, 34% of the daily amount.');
    expect(lowest.context).toContain('3 Sept to 3 Oct');
    expect(result!.period).toEqual({ from: '2026-09-04', to: '2026-10-03' });
  });

  it('keeps the food page when only nutrition fails', () => {
    let result: FoodProgress | null = null;
    service.getFood('2026-09-04', '2026-10-03').subscribe((food) => (result = food));
    http.expectOne((req) => req.url === '/api/v1/analytics/progress/food').flush(FOOD_WIRE);
    http.expectOne((req) => req.url === '/api/v1/nutrition/progress/food').flush('down', { status: 503, statusText: 'Down' });
    expect(result!.nutrition).toBeNull();
    expect(result!.habits.fibreMetDays).toBeNull();
    expect(result!.highlights.some((h) => h.code === 'LOWEST_NUTRIENT')).toBeFalse();
    expect(result!.hero.eatenPerDay.value).toBe(2123);
  });

  it('fails the food page when analytics fails', () => {
    let failed = false;
    service.getFood('2026-09-04', '2026-10-03').subscribe({ error: () => (failed = true) });
    const analytics = http.expectOne((req) => req.url === '/api/v1/analytics/progress/food');
    http.expectOne((req) => req.url === '/api/v1/nutrition/progress/food').flush(NUTRITION_WIRE);
    analytics.flush('down', { status: 500, statusText: 'Down' });
    expect(failed).toBeTrue();
  });

  it('reads the weekly reviews newest first', () => {
    let result: WeeklyReview[] = [];
    service.getReviews().subscribe((reviews) => (result = reviews));
    const request = http.expectOne((req) => req.url === '/api/v1/coach/reviews');
    expect(request.request.params.get('weeks')).toBe('8');
    request.flush(REVIEWS_WIRE);
    expect(result.map((r) => r.weekStart)).toEqual(['2026-09-28', '2026-09-21', '2026-09-14']);
  });
});

describe('progress mappers', () => {
  it('reads every part of the goal response', () => {
    const goal = mapGoalProgress(GOAL_WIRE);
    expect(goal.goal).toEqual({ type: 'WEIGHT', targetKg: 68, byDate: '2026-12-11' });
    expect(goal.previous).toEqual({ from: '2026-04-05', to: '2026-07-04' });
    expect(goal.hero.projectedDate.previous).toBe('2027-01-10');
    expect(goal.weight.weekly.length).toBe(2);
    expect(goal.weight.rateChangeMark?.text).toBe('Faster from 14 Sept');
    expect(goal.body.bmi).toBeNull();
    expect(goal.body.waist?.end).toBe(83.8);
    expect(goal.otherGoals[0].days.length).toBe(2);
    expect(goal.otherGoals[1].weeks[0]).toEqual({ weekStart: '2026-09-07', value: 3, target: 4 });
  });

  it('fills a goal response that sent nothing with empty parts, never made-up values', () => {
    const goal = mapGoalProgress(null);
    expect(goal.goal).toBeNull();
    expect(goal.hero.nowKg).toBeNull();
    expect(goal.hero.projectedDate).toEqual({ value: null, previous: null });
    expect(goal.weight.daily).toEqual([]);
    expect(goal.otherGoals).toEqual([]);
  });

  it('reads the food response and drops what it cannot read', () => {
    const food = mapFoodProgress(FOOD_WIRE);
    expect(food.energy.thisWeek).toBeNull();
    expect(food.energy.weeklyBalance[1]).toEqual({ weekStart: '2026-09-28', balance: -279, daysLogged: 5, current: true });
    expect(food.macros.fat).toBeNull();
    expect(food.macros.summary).toEqual([{ text: 'Protein 150 → 136 g a day', trend: 'DOWN' }]);
    expect(food.plate.current[0]).toEqual({ group: 'VEG', kcal: 9900, share: 18 });
    expect(food.plate.current[1]).toEqual({ group: 'GRAINS', kcal: null, share: 27 });
    expect(food.meals.share[0].kcalPerDay).toBe(807);
    expect(food.meals.share[1].deltaPoints).toBeNull();
    expect(mapFoodProgress({}).hero.eatenPerDay).toEqual({ value: null, previous: null });
  });

  it('ends the weekly series at the last full week when the server says the current week is not in', () => {
    const food = mapFoodProgress({ ...FOOD_WIRE, currentWeek: { included: false, daysLogged: 0 } });
    expect(food.currentWeek).toEqual({ included: false, daysLogged: 0 });
    expect(food.macros.protein?.series).toEqual([{ weekStart: '2026-08-10', value: 150 }]);
    expect(food.macros.protein?.thisWeek).toBe(150);
    expect(food.macros.carbs?.series.map((point) => point.weekStart)).toEqual(['2026-08-10']);
    expect(food.energy.weeklyBalance.map((week) => week.weekStart)).toEqual(['2026-09-21']);
  });

  it('keeps the current week when it is in, or when the server says nothing about it', () => {
    const inside = mapFoodProgress({ ...FOOD_WIRE, currentWeek: { included: true, daysLogged: 3 } });
    expect(inside.macros.protein?.series.length).toBe(2);
    expect(inside.macros.protein?.thisWeek).toBe(136);
    const silent = mapFoodProgress(FOOD_WIRE);
    expect(silent.currentWeek).toBeNull();
    expect(silent.macros.protein?.series.length).toBe(2);
    expect(silent.energy.weeklyBalance.length).toBe(2);
  });

  it('reads the figures of today so far from a review and leaves them out when they are not sent', () => {
    const [soFar] = mapReviews([{ weekStart: '2026-09-28', current: true, status: 'READY', eatenTodaySoFarKcal: 476, proteinTodaySoFarGrams: 29 }]);
    expect(soFar.eatenTodaySoFarKcal).toBe(476);
    expect(soFar.proteinTodaySoFarGrams).toBe(29);
    const [plain] = mapReviews([{ weekStart: '2026-09-28', status: 'READY' }]);
    expect('eatenTodaySoFarKcal' in plain).toBeFalse();
  });

  it('reads nutrition’s part of the food page', () => {
    const nutrition = mapFoodNutrition(NUTRITION_WIRE);
    expect(nutrition.mealTimes[0].medianMinuteOfDay).toBe(1160);
    expect(nutrition.cooks?.last?.name).toBe('Algerian Kefta');
    expect(nutrition.recentWindow).toEqual({ from: '2026-09-03', to: '2026-10-03' });
    expect(nutrition.habits.waterMetDays).toBeNull();
    expect(mapFoodNutrition({}).cooks).toBeNull();
  });

  it('reads reviews from a list or from a wrapped list and keeps unknown states as none', () => {
    expect(mapReviews({ reviews: [{ weekStart: '2026-09-28', status: 'ODD' }] })[0]).toEqual({
      weekStart: '2026-09-28',
      weekEnd: '2026-09-28',
      current: false,
      status: 'NONE',
      headline: '',
      body: '',
      facts: []
    });
    expect(mapReviews('x')).toEqual([]);
    const facts = mapReviews([{ weekStart: '2026-09-28', status: 'READY', facts: [{ key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'sessions', note: 'Same', detail: 'as last week' }, { key: 'X' }, 'no'] }])[0].facts;
    expect(facts).toEqual([{ key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'sessions', note: 'Same', detail: 'as last week' }]);
    expect(mapReviews([{ weekStart: '2026-09-28', status: 'READY', body: 'Two sessions [1] and less food [2].', current: true }])[0].body).toBe(
      'Two sessions and less food.'
    );
  });
});
