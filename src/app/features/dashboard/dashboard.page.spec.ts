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
  latestMeal: {
    mealId: 'meal-1',
    mealType: 'LUNCH',
    name: 'Chicken rice',
    totalCalories: 640,
    totalProteinGrams: 48,
    consumedAt: '2026-06-21T12:30:00Z',
    itemCount: 1
  },
  latestBodyMetric: {
    weightKg: 77,
    bodyFatRate: 18,
    bmi: 24.3,
    measuredAt: '2026-06-24T00:05:00.512709Z'
  },
  goals: [
    {
      goalId: 'goal-calories-old',
      goalType: 'CALORIES',
      targetValue: 2100,
      targetUnit: 'kcal',
      targetDate: '',
      status: 'ACTIVE',
      progressRatio: 0.5,
      onTrack: false,
      currentValue: 1050,
      lastEvaluatedAt: '2026-06-22T00:00:00Z'
    },
    {
      goalId: 'goal-calories',
      goalType: 'CALORIES',
      targetValue: 2000,
      targetUnit: 'kcal',
      targetDate: '',
      status: 'ACTIVE',
      progressRatio: 0.95,
      onTrack: true,
      currentValue: 1900,
      lastEvaluatedAt: '2026-06-24T00:05:00Z'
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

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-24T12:00:00+08:00'));

    fixture = TestBed.createComponent(DashboardPage);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('renders analytics dashboard streak, latest goal values, and humanized timestamps', () => {
    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Active streak');
    expect(text).toContain('7 days');
    expect(text).toContain('7 workouts · 300 min this week');
    expect(text).toContain('On track · 95% complete');
    expect(text).toContain('Today');
    expect(text).toContain('3 days ago');
    expect(text).not.toContain('2026-06-24T00:05:00.512709Z');
    expect(text).not.toContain('2026-06-21T12:30:00Z');
    expect(goalRowText().length).toBe(1);
    expect(goalRowText()[0]).toContain('Calories 1,900 / 2,000 kcal');
    expect(goalRowText()[0]).toContain('On track · 95% complete');
    expect(text).not.toContain('Complete setup');
  });

  it('leads with weekly workout totals when active streak is zero', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        workout: {
          todayWorkoutCount: 0,
          weekWorkoutCount: 5,
          weekWorkoutMinutes: 210,
          activeStreakDays: 0
        }
      })
    );

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('This week');
    expect(text).toContain('5 workouts · 210 min');
    expect(text).not.toContain('0 days');
  });

  it('renders a start workout empty state when the latest session has no completed work', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        latestWorkout: {
          name: 'Draft workout',
          workoutType: 'STRENGTH',
          status: 'COMPLETED',
          startedAt: '2026-06-24T10:00:00Z',
          durationMinutes: 0,
          caloriesBurned: 0,
          completedAt: '2026-06-24T10:00:00Z',
          exerciseCount: 0
        }
      })
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No completed workout yet');
    expect(compiled.querySelector<HTMLAnchorElement>('.empty-workout-state a')?.getAttribute('href')).toBe('/workout');
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
        profile: {
          ...dashboardData.profile,
          onboardingCompleted: false
        },
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
    expect(text).toContain('Complete setup');
    expect(text).not.toContain('NaN');
  });

  it('formats relative dates and fallback dates without exposing raw ISO timestamps', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.metricDateLabel(null)).toBe('');
    expect(component.metricDateLabel('2026-06-23T20:00:00+08:00')).toBe('Yesterday');
    expect(component.metricDateLabel('2026-06-20T08:00:00+08:00')).toBe('4 days ago');
    expect(component.metricDateLabel('2024-12-31T16:00:00Z')).toBe('1 Jan 2025');
    expect(component.metricDateLabel('not-a-date')).toBe('not-a-date');
    expect(component.metricDateLabel('2026-99-99T99:99:99Z')).toBe('Recently');
  });

  it('formats goal labels and target amounts for default units and missing targets', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.goalLabel({ ...dashboardData.goals[0], goalType: 'WORKOUT_FREQUENCY' })).toBe('Workout Frequency');
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'PROTEIN', targetUnit: '', currentValue: 130, targetValue: 140 })).toBe(
      '130 / 140 g'
    );
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'WEIGHT', targetUnit: '', currentValue: 77.25, targetValue: 75 })).toBe(
      '77.3 / 75 kg'
    );
    expect(
      component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'WORKOUT_FREQUENCY', targetUnit: '', currentValue: 3, targetValue: 4 })
    ).toBe('3 / 4 workouts/week');
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'STEPS', targetUnit: '', currentValue: null, targetValue: 0 })).toBe(
      'No target set'
    );
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'STEPS', targetUnit: '', currentValue: 2000, targetValue: 0 })).toBe(
      '2,000 / No target'
    );
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

  function goalRowText(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.goal-row')).map((row) =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
  }
});
