import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { ProfilePage } from './profile.page';
import { DashboardData } from '../../core/fitsync-data.service';

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

describe('ProfilePage', () => {
  let component: ProfilePage;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    component = TestBed.createComponent(ProfilePage).componentInstance;
    component.data.set(mockDashboard);
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

  it('builds recent activity from the latest workout and body metric', () => {
    const activity = component.recentActivity();
    expect(activity.length).toBe(2);
    expect(activity[0].title).toBe('Upper body strength');
    expect(activity[1].icon).toBe('scale');
  });
});
