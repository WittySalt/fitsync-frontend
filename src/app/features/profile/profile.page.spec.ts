import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProfilePage } from './profile.page';
import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsWorkoutSummaryResponse } from '../../core/analytics.models';
import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';

const mockDashboard: DashboardData = {
  profile: {
    displayName: 'Wang Xu',
    firstName: 'Wang',
    lastName: 'Xu',
    gender: 'MALE',
    birthDate: '1996-01-01',
    heightCm: 178,
    activityLevel: 'MODERATELY_ACTIVE',
    timezone: 'Asia/Singapore',
    onboardingCompleted: true
  },
  nutrition: {
    totalCalories: 0,
    targetCalories: 0,
    totalProteinGrams: 0,
    targetProteinGrams: 0,
    totalCarbsGrams: 0,
    targetCarbsGrams: 0,
    totalFatGrams: 0,
    targetFatGrams: 0,
    mealCount: 0,
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
  latestWorkout: {
    name: 'Upper body strength',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-06-18T08:08:00Z',
    durationMinutes: 52,
    caloriesBurned: 320,
    completedAt: '2026-06-18T09:00:00Z',
    exerciseCount: 6
  },
  latestMeal: null,
  latestBodyMetric: { weightKg: 70.3, bodyFatRate: 18, bmi: 22.2, measuredAt: '2026-06-19T01:00:00Z' },
  goals: [
    { goalType: 'WEIGHT', targetValue: 68, targetUnit: 'kg', targetDate: '2026-09-12', status: 'ACTIVE', progressRatio: 0.42 }
  ]
};

const mockWorkoutSummary: AnalyticsWorkoutSummaryResponse = {
  from: '2025-06-25',
  to: '2026-06-25',
  totalWorkoutCount: 82,
  totalWorkoutMinutes: 3690,
  totalCaloriesBurned: 24000,
  totalExerciseCount: 420,
  averageDuration: 45,
  activeStreakDays: 7
};

describe('ProfilePage', () => {
  let component: ProfilePage;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getDashboard']);
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getWorkoutSummary']);
    dataService.getDashboard.and.returnValue(of(mockDashboard));
    analyticsApi.getWorkoutSummary.and.returnValue(of(mockWorkoutSummary));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AnalyticsApiService, useValue: analyticsApi }
      ]
    });
    component = TestBed.createComponent(ProfilePage).componentInstance;
    component.data.set(mockDashboard);
    component.workoutSummary.set(mockWorkoutSummary);
  });

  it('derives initials from the display name', () => {
    expect(component.initials()).toBe('WX');
  });

  it('computes age from the birth date', () => {
    expect(component.age()).toBeGreaterThanOrEqual(30);
  });

  it('selects the active goal and rounds its progress', () => {
    expect(component.activeGoal()?.goalType).toBe('WEIGHT');
    expect(component.goalProgress()).toBe(42);
  });

  it('formats the active target value and deadline without fake zero labels', () => {
    const goal = mockDashboard.goals[0];

    expect(component.goalTargetLabel(goal)).toBe('68 kg');
    expect(component.goalTargetDateLabel(goal)).toBe('by 12 Sept 2026');
    expect(component.goalTargetLabel({ ...goal, targetValue: 0 })).toBe('No target set');
    expect(component.goalTargetDateLabel({ ...goal, targetDate: '' })).toBe('No target date');
  });

  it('builds recent activity from the latest workout and body metric', () => {
    const activity = component.recentActivity();
    expect(activity.length).toBe(2);
    expect(activity[0].title).toBe('Upper body strength');
    expect(activity[1].icon).toBe('scale');
  });

  it('renders missing latest workout duration without fake zeroes in recent activity', () => {
    component.data.set({
      ...mockDashboard,
      latestWorkout: {
        ...mockDashboard.latestWorkout!,
        startedAt: '2026-06-18T08:08:00Z',
        completedAt: '',
        durationMinutes: null,
        caloriesBurned: null
      },
      latestBodyMetric: null
    });

    expect(component.recentActivity()).toEqual([
      jasmine.objectContaining({
        icon: 'dumbbell',
        detail: 'Strength · —'
      })
    ]);
  });

  it('uses analytics workout summary for training history and streak labels', () => {
    expect(component.hasTrainingHistory(mockWorkoutSummary)).toBeTrue();
    expect(component.totalTrainingHours(mockWorkoutSummary)).toBe('61.5');
    expect(component.streakLabel(mockWorkoutSummary.activeStreakDays)).toBe('7 days');
    expect(component.streakLabel(1)).toBe('1 day');
    expect(component.hasTrainingHistory({ ...mockWorkoutSummary, totalWorkoutCount: 0, totalWorkoutMinutes: 0 })).toBeFalse();
  });

  it('hides non-completed latest workouts from recent activity', () => {
    component.data.set({
      ...mockDashboard,
      latestWorkout: {
        ...mockDashboard.latestWorkout!,
        name: 'Cancelled workout',
        status: 'CANCELLED'
      },
      latestMeal: null,
      latestBodyMetric: null
    });

    expect(component.recentActivity()).toEqual([]);
  });

  it('uses initials fallbacks for missing, blank, and single-word names', () => {
    component.data.set(null);
    expect(component.initials()).toBe('FS');

    component.data.set({ ...mockDashboard, profile: { ...mockDashboard.profile, displayName: '   ' } });
    expect(component.initials()).toBe('FS');

    component.data.set({ ...mockDashboard, profile: { ...mockDashboard.profile, displayName: 'Madonna' } });
    expect(component.initials()).toBe('M');

    component.data.set({ ...mockDashboard, profile: { ...mockDashboard.profile, displayName: 'Alice Bee Tan' } });
    expect(component.initials()).toBe('AT');
  });

  it('returns null age for missing or invalid birth dates', () => {
    component.data.set({ ...mockDashboard, profile: { ...mockDashboard.profile, birthDate: undefined } });
    expect(component.age()).toBeNull();

    component.data.set({ ...mockDashboard, profile: { ...mockDashboard.profile, birthDate: 'not-a-date' } });
    expect(component.age()).toBeNull();
  });

  it('falls back to the first goal and clamps goal progress', () => {
    component.data.set({
      ...mockDashboard,
      goals: [
        { goalType: 'CALORIES', targetValue: 2200, targetUnit: 'kcal', targetDate: '2026-09-12', status: 'PAUSED', progressRatio: 2 },
        { goalType: 'PROTEIN', targetValue: 120, targetUnit: 'g', targetDate: '2026-09-12', status: 'COMPLETED', progressRatio: -1 }
      ]
    });

    expect(component.activeGoal()?.goalType).toBe('CALORIES');
    expect(component.goalProgress()).toBe(100);

    component.data.set({
      ...mockDashboard,
      goals: [{ goalType: 'PROTEIN', targetValue: 120, targetUnit: 'g', targetDate: '2026-09-12', status: 'ACTIVE', progressRatio: -1 }]
    });
    expect(component.goalProgress()).toBe(0);

    component.data.set({ ...mockDashboard, goals: [] });
    expect(component.activeGoal()).toBeNull();
    expect(component.goalProgress()).toBe(0);
  });

  it('builds recent activity from meals and handles missing dashboard data', () => {
    component.data.set(null);
    expect(component.recentActivity()).toEqual([]);

    component.data.set({
      ...mockDashboard,
      latestWorkout: null,
      latestMeal: {
        mealId: 'meal-1',
        name: 'Recovery breakfast',
        mealType: 'POST_WORKOUT',
        consumedAt: '2026-06-21T01:00:00Z',
        totalCalories: 480,
        totalProteinGrams: 35,
        itemCount: 3
      },
      latestBodyMetric: null
    });

    expect(component.recentActivity()).toEqual([
      jasmine.objectContaining({
        icon: 'utensils',
        title: 'Recovery breakfast',
        detail: jasmine.stringMatching(/Post Workout/)
      })
    ]);
  });

  it('loads dashboard data and stores load errors', () => {
    const fresh = TestBed.createComponent(ProfilePage).componentInstance;
    dataService.getDashboard.and.returnValue(of({ ...mockDashboard, profile: { ...mockDashboard.profile, displayName: 'Loaded User' } }));
    analyticsApi.getWorkoutSummary.and.returnValue(of({ ...mockWorkoutSummary, totalWorkoutCount: 10 }));

    fresh.load();

    expect(fresh.loading()).toBeFalse();
    expect(fresh.error()).toBeNull();
    expect(fresh.data()?.profile.displayName).toBe('Loaded User');
    expect(fresh.workoutSummary()?.totalWorkoutCount).toBe(10);
    expect(analyticsApi.getWorkoutSummary).toHaveBeenCalledWith(jasmine.stringMatching(/^\d{4}-\d{2}-\d{2}$/), jasmine.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    dataService.getDashboard.and.returnValue(throwError(() => new Error('Profile unavailable')));
    fresh.load();

    expect(fresh.loading()).toBeFalse();
    expect(fresh.error()).toBe('Profile unavailable');
  });

  it('formats labels and date guard values', () => {
    expect(component.label(null)).toBe('');
    expect(component.label('BODY_WEIGHT')).toBe('Body Weight');
    expect(component.formatDate(null)).toBe('');
    expect(component.formatDate('not-a-date')).toBe('not-a-date');
    expect(component.formatDate('2026-06-21T08:00:00Z')).toMatch(/\d{1,2} [A-Z][a-z]{2}/);
  });
});
