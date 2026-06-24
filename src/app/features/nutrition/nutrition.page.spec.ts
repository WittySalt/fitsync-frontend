import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { NutritionSummary } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { NutritionPage } from './nutrition.page';

function summary(overrides: Partial<NutritionSummary> = {}): NutritionSummary {
  return {
    totalCalories: 142,
    targetCalories: null,
    totalProteinGrams: 2.8,
    targetProteinGrams: null,
    totalCarbsGrams: 20,
    targetCarbsGrams: null,
    totalFatGrams: 5,
    targetFatGrams: null,
    mealCount: 1,
    totalFiberGrams: null,
    totalSugarGrams: null,
    totalSodiumMg: null,
    fiberTargetGrams: null,
    sugarLimitGrams: null,
    sodiumLimitMg: null,
    fiberTargetMet: null,
    sugarWithinLimit: null,
    sodiumWithinLimit: null,
    ...overrides
  };
}

describe('NutritionPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getDailyNutritionSummary',
      'getTodayMeals',
      'copyMeal',
      'getFoodCategories',
      'getRecentFoods',
      'getFavoriteFoods',
      'getFrequentFoods',
      'getMealTemplates',
      'searchFoodsPage',
      'getFoodDetail',
      'createMeal',
      'quickAddMeal',
      'getFoodByBarcode',
      'addFavoriteFood',
      'removeFavoriteFood'
    ]);
    dataService.getTodayMeals.and.returnValue(of([]));
    dataService.getFoodCategories.and.returnValue(of([]));
    dataService.getRecentFoods.and.returnValue(of([]));
    dataService.getFavoriteFoods.and.returnValue(of([]));
    dataService.getFrequentFoods.and.returnValue(of([]));
    dataService.getMealTemplates.and.returnValue(of([]));
    dataService.searchFoodsPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }));
    dataService.copyMeal.and.returnValue(of({ ok: true }));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [NutritionPage],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('shows logged totals and target setup guidance when daily targets are missing', () => {
    dataService.getDailyNutritionSummary.and.returnValue(of(summary()));
    const fixture = TestBed.createComponent(NutritionPage);
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('142');
    expect(text).toContain('kcal logged');
    expect(text).toContain('Daily calorie target not set');
    expect(text).toContain('Set daily target');
    expect(text).toContain('2.8g · target not set');
    expect(text).not.toContain('of 0 kcal');
    expect(text).not.toContain('0%');
    expect(text).not.toContain('0g left');
  });

  it('keeps progress and remaining copy when daily targets are available', () => {
    dataService.getDailyNutritionSummary.and.returnValue(
      of(
        summary({
          totalCalories: 600,
          targetCalories: 2000,
          totalProteinGrams: 50,
          targetProteinGrams: 100,
          totalCarbsGrams: 120,
          targetCarbsGrams: 240,
          totalFatGrams: 20,
          targetFatGrams: 60
        })
      )
    );
    const fixture = TestBed.createComponent(NutritionPage);
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('of 2000 kcal logged');
    expect(text).toContain('30%');
    expect(text).toContain('1400 kcal');
    expect(text).toContain('50g left');
    expect(text).toContain('120g left');
    expect(text).toContain('40g left');
  });

  it('stores dashboard load errors while still refreshing meal history', () => {
    dataService.getDailyNutritionSummary.and.returnValue(throwError(() => new Error('Dashboard unavailable')));
    dataService.getTodayMeals.and.returnValue(of([]));

    const fixture = TestBed.createComponent(NutritionPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.error()).toBe('Dashboard unavailable');
    expect(dataService.getTodayMeals).toHaveBeenCalled();
  });

  it('copies meals, guards empty ids, and reports copy errors', () => {
    dataService.getDailyNutritionSummary.and.returnValue(of(summary()));
    const component = TestBed.createComponent(NutritionPage).componentInstance;

    component.copyMeal('', 'DINNER');
    expect(dataService.copyMeal).not.toHaveBeenCalled();

    component.copyMeal('meal-1', 'DINNER');
    expect(dataService.copyMeal).toHaveBeenCalledWith('meal-1', 'DINNER');
    expect(toast.success).toHaveBeenCalledWith('Meal copied to now.');

    dataService.copyMeal.and.returnValue(throwError(() => new Error('copy failed')));
    component.copyMeal('meal-2', 'BREAKFAST');

    expect(toast.error).toHaveBeenCalledWith('Unable to copy meal. Please retry.');
  });

  it('reports refresh-dashboard errors after a meal save', () => {
    dataService.getDailyNutritionSummary.and.returnValue(throwError(() => new Error('refresh failed')));
    dataService.getTodayMeals.and.returnValue(of([]));
    const component = TestBed.createComponent(NutritionPage).componentInstance;

    component.refreshAfterMealSave();

    expect(toast.error).toHaveBeenCalledWith('Meal saved, but today summary could not refresh.');
    expect(dataService.getTodayMeals).toHaveBeenCalled();
  });

  it('computes progress, remaining amounts, labels, and formatted values', () => {
    const component = TestBed.createComponent(NutritionPage).componentInstance;

    expect(component.progress(50, null)).toBeNull();
    expect(component.progress(50, 0)).toBeNull();
    expect(component.progress(250, 200)).toBe(100);
    expect(component.remaining(250, 200)).toBe(0);
    expect(component.remaining(50, null)).toBeNull();
    expect(component.label(null)).toBe('');
    expect(component.label('POST_WORKOUT')).toBe('Post Workout');
    expect(component.formatTime(null)).toBe('');
    expect(component.formatTime('not-a-date')).toBe('');
    expect(component.formatTime('2026-06-21T08:05:00Z')).toMatch(/\d{2}:\d{2}/);
    expect(component.formatAmount(null, 'g')).toBe('No data');
    expect(component.formatAmount(1.24, 'g')).toBe('1.2g');
    expect(component.formatAmount(1234.56, 'mg')).toBe('1235mg');
  });

  it('builds meal timeline entries and calorie/macro cards from loaded data', () => {
    const component = TestBed.createComponent(NutritionPage).componentInstance;
    component.nutritionSummary.set(summary({ totalCalories: 2300, targetCalories: 2000, targetProteinGrams: 100 }));
    component.todayMeals.set([
      {
        mealId: 'meal-1',
        name: 'Lunch bowl',
        mealType: 'LUNCH',
        consumedAt: '2026-06-21T04:30:00Z',
        totalCalories: 620,
        totalProteinGrams: 32.6,
        itemCount: 3
      }
    ]);

    expect(component.hasCalorieTarget()).toBeTrue();
    expect(component.caloriesRemaining()).toBe(0);
    expect(component.calorieProgress()).toBe(100);
    expect(component.macroCards()[0]).toEqual(jasmine.objectContaining({ label: 'Protein', targetSet: true }));
    expect(component.mealTimeline()[0]).toEqual(jasmine.objectContaining({ type: 'Lunch', protein: 33 }));
  });

  it('uses zeroed nutrition fallbacks when dashboard data is absent', () => {
    const component = TestBed.createComponent(NutritionPage).componentInstance;
    component.nutritionSummary.set(null);

    expect(component.nutrition()).toBeNull();
    expect(component.hasCalorieTarget()).toBeFalse();
    expect(component.caloriesRemaining()).toBeNull();
    expect(component.calorieProgress()).toBe(0);
    expect(component.macroCards()).toEqual([
      jasmine.objectContaining({ label: 'Protein', value: 0, target: null, targetSet: false }),
      jasmine.objectContaining({ label: 'Carbs', value: 0, target: null, targetSet: false }),
      jasmine.objectContaining({ label: 'Fat', value: 0, target: null, targetSet: false })
    ]);
  });

  it('filters absent nutrition checks and labels target/limit status states', () => {
    const component = TestBed.createComponent(NutritionPage).componentInstance;

    expect(component.nutritionChecks()).toEqual([]);

    component.nutritionSummary.set(
      summary({
        totalFiberGrams: 18,
        fiberTargetGrams: 25,
        fiberTargetMet: false,
        totalSugarGrams: 30,
        sugarLimitGrams: 50,
        sugarWithinLimit: true,
        totalSodiumMg: 2600,
        sodiumLimitMg: 2300,
        sodiumWithinLimit: false
      })
    );

    expect(component.nutritionChecks()).toEqual([
      jasmine.objectContaining({ label: 'Fiber', status: 'warning', statusLabel: 'Below target', detail: '7g left to target.' }),
      jasmine.objectContaining({ label: 'Sugar', status: 'success', statusLabel: 'Within limit', detail: "Sugar is within today's limit." }),
      jasmine.objectContaining({ label: 'Sodium', status: 'warning', statusLabel: 'Over limit', detail: "300mg over today's limit." })
    ]);

    component.nutritionSummary.set(summary({ totalFiberGrams: 25, fiberTargetGrams: 25, fiberTargetMet: true, totalSugarGrams: 10, sugarWithinLimit: null }));

    expect(component.nutritionChecks()).toEqual([
      jasmine.objectContaining({ label: 'Fiber', status: 'success', statusLabel: 'Target met', detail: 'Fiber target met.' }),
      jasmine.objectContaining({ label: 'Sugar', status: 'neutral', statusLabel: 'Waiting for target' })
    ]);
  });
});
