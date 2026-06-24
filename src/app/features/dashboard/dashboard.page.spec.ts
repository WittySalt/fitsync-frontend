import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { DashboardPage } from './dashboard.page';

const dashboardData: DashboardData = {
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
    totalCalories: 1850,
    targetCalories: 2200,
    totalProteinGrams: 120,
    targetProteinGrams: 150,
    totalCarbsGrams: 0,
    targetCarbsGrams: null,
    totalFatGrams: 0,
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
    sodiumWithinLimit: null
  },
  workout: {
    todayWorkoutCount: 1,
    weekWorkoutCount: 7,
    weekWorkoutMinutes: 300,
    activeStreakDays: 7
  },
  latestWorkout: null,
  latestMeal: null,
  latestBodyMetric: {
    weightKg: 77,
    bodyFatRate: 18,
    bmi: 24.3,
    measuredAt: '2026-06-22T00:00:00Z'
  },
  goals: [
    {
      goalId: 'goal-calories',
      goalType: 'CALORIES',
      targetValue: 0,
      targetUnit: '',
      targetDate: '',
      status: 'ACTIVE',
      progressRatio: 0.95,
      onTrack: true
    }
  ]
};

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getDashboard', 'getDailyNutritionSummary']);
    dataService.getDashboard.and.returnValue(of(dashboardData));
    dataService.getDailyNutritionSummary.and.returnValue(of(dashboardData.nutrition));

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: FitSyncDataService, useValue: dataService }, provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
  });

  it('renders analytics dashboard streak and goal progress', () => {
    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Active streak');
    expect(text).toContain('7 days');
    expect(text).toContain('7 workouts - 300 min this week');
    expect(text).toContain('On track - 95% complete');
  });

  it('renders friendly empty states for new users without NaN', () => {
    const emptyNutrition = {
      ...dashboardData.nutrition,
      totalCalories: 0,
      targetCalories: null,
      totalProteinGrams: 0,
      targetProteinGrams: null
    };
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        nutrition: emptyNutrition,
        latestBodyMetric: null,
        goals: []
      })
    );
    dataService.getDailyNutritionSummary.and.returnValue(of(emptyNutrition));

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('No nutrition yet');
    expect(text).toContain('No protein yet');
    expect(text).toContain('No metric yet');
    expect(text).not.toContain('NaN');
  });

  it('renders the dashboard error state', () => {
    dataService.getDashboard.and.returnValue(throwError(() => new Error('Unable to load dashboard data.')));

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Dashboard unavailable');
    expect(text).toContain('Unable to load dashboard data.');
  });

  function pageText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});
