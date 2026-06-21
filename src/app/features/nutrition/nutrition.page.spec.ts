import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { NutritionPage } from './nutrition.page';

function dashboard(overrides: Partial<DashboardData['nutrition']> = {}): DashboardData {
  return {
    profile: {
      displayName: 'Wang Xu',
      firstName: 'Wang',
      lastName: 'Xu',
      heightCm: 178,
      activityLevel: 'MODERATELY_ACTIVE',
      timezone: 'Asia/Singapore',
      onboardingCompleted: true
    },
    nutrition: {
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
    },
    latestWorkout: null,
    latestMeal: null,
    latestBodyMetric: null,
    goals: []
  };
}

describe('NutritionPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getDashboard',
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

    await TestBed.configureTestingModule({
      imports: [NutritionPage],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']) }
      ]
    }).compileComponents();
  });

  it('shows logged totals and target setup guidance when daily targets are missing', () => {
    dataService.getDashboard.and.returnValue(of(dashboard()));
    const fixture = TestBed.createComponent(NutritionPage);
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('142');
    expect(text).toContain('kcal logged');
    expect(text).toContain('未设置每日卡路里目标');
    expect(text).toContain('去设置每日目标');
    expect(text).toContain('2.8g · 目标未设置');
    expect(text).not.toContain('of 0 kcal');
    expect(text).not.toContain('0%');
    expect(text).not.toContain('0g left');
  });

  it('keeps progress and remaining copy when daily targets are available', () => {
    dataService.getDashboard.and.returnValue(
      of(
        dashboard({
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
});
