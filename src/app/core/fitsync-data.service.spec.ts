import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FitSyncDataService, ProgressData } from './fitsync-data.service';
import { OnboardingFormValue, OnboardingSeed } from './fitsync.models';

const baseOnboarding: OnboardingFormValue = {
  primaryGoal: 'LOSE_FAT',
  displayName: 'Wang Xu',
  gender: 'MALE',
  birthDate: '1996-01-01',
  preferredUnits: 'METRIC',
  heightCm: 178,
  heightFt: null,
  heightIn: null,
  currentWeightKg: 85,
  currentWeightLb: null,
  targetWeightKg: 70,
  targetWeightLb: null,
  weeklyPaceKg: 0.5,
  activityLevel: 'MODERATELY_ACTIVE',
  weeklyWorkoutDays: 4,
  dietaryPattern: 'NONE',
  calorieTrackingMode: 'FLEXIBLE',
  targetCalories: 2417,
  targetProteinGrams: 153,
  targetCarbsGrams: 240,
  targetFatGrams: 70,
  projectedTargetDate: '2026-09-12',
  workoutReminderEnabled: true,
  mealReminderEnabled: true
};

describe('FitSyncDataService', () => {
  let service: FitSyncDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FitSyncDataService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(FitSyncDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads progress data from body metrics, trend, and goals endpoints', () => {
    let result: ProgressData | undefined;
    service.getProgressData({ startDate: '2026-06-01', endDate: '2026-06-18' }).subscribe((data) => {
      result = data;
    });

    const metricsRequest = httpTesting.expectOne(
      (request) =>
        request.url === '/api/v1/users/me/body-metrics' &&
        request.params.get('startDate') === '2026-06-01' &&
        request.params.get('endDate') === '2026-06-18'
    );
    metricsRequest.flush({
      content: [
        {
          weightKg: 71.8,
          bmi: 24.9,
          bodyFatRate: 20.4,
          waistCm: 82,
          measuredAt: '2026-06-17T07:00:00Z'
        }
      ]
    });

    const trendsRequest = httpTesting.expectOne('/api/v1/users/me/body-metrics/trends?startDate=2026-06-01&endDate=2026-06-18');
    trendsRequest.flush({
      points: [
        {
          weightKg: 72.6,
          bmi: 25.2,
          bodyFatRate: 21.1,
          waistCm: 83,
          date: '2026-06-01'
        }
      ]
    });

    const goalsRequest = httpTesting.expectOne('/api/v1/users/me/goals?status=ACTIVE');
    goalsRequest.flush([
      {
        goalType: 'WEIGHT',
        targetValue: 68,
        targetUnit: 'kg',
        targetDate: '2026-09-30',
        status: 'ACTIVE',
        progressRatio: 0.55
      }
    ]);

    expect(result?.latestBodyMetric?.weightKg).toBe(71.8);
    expect(result?.trendPoints[0].measuredAt).toBe('2026-06-01');
    expect(result?.goals[0].progressRatio).toBe(0.55);
  });

  it('saves goal-driven onboarding to the single onboarding endpoint with a local timezone', () => {
    service.saveOnboarding(baseOnboarding).subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.primaryGoal).toBe('LOSE_FAT');
    expect(request.request.body.heightCm).toBe(178);
    expect(request.request.body.currentWeightKg).toBe(85);
    expect(request.request.body.targetWeightKg).toBe(70);
    expect(request.request.body.targetCalories).toBe(2417);
    expect(request.request.body.targetProteinGrams).toBe(153);
    expect(request.request.body.targetDate).toBe('2026-09-12');
    expect(typeof request.request.body.timezone).toBe('string');
    request.flush({});
  });

  it('converts imperial onboarding height and weight to metric before saving', () => {
    service
      .saveOnboarding({
        ...baseOnboarding,
        preferredUnits: 'IMPERIAL',
        heightCm: null,
        heightFt: 5,
        heightIn: 6,
        currentWeightKg: null,
        currentWeightLb: 154,
        targetWeightKg: null,
        targetWeightLb: 160,
        projectedTargetDate: null
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(request.request.body.heightCm).toBe(168);
    expect(request.request.body.currentWeightKg).toBe(69.9);
    expect(request.request.body.targetWeightKg).toBe(72.6);
    request.flush({});
  });

  it('builds an onboarding seed that normalizes backend enum codes and existing goals', () => {
    let seed: OnboardingSeed | undefined;
    service.getOnboardingSeed().subscribe((value) => (seed = value));

    httpTesting.expectOne('/api/v1/users/me').flush({
      profile: {
        displayName: 'Wang Xu',
        gender: 'MALE',
        birthDate: '1996-01-01',
        heightCm: 178,
        activityLevel: 'MODERATELY_ACTIVE',
        onboardingCompleted: true
      },
      preferences: {
        app: { preferredUnits: '100002' },
        nutrition: { dietaryPattern: '300004', calorieTrackingMode: '310003' },
        training: { weeklyWorkoutDays: 5 },
        notifications: { workoutReminderEnabled: false }
      },
      activeGoals: [
        { goalType: 'WEIGHT', targetValue: 70 },
        { goalType: 'CALORIES', targetValue: 2200 },
        { goalType: 'PROTEIN', targetValue: 150 }
      ],
      latestBodyMetrics: { weightKg: 85 }
    });

    expect(seed?.value.preferredUnits).toBe('IMPERIAL');
    expect(seed?.value.dietaryPattern).toBe('VEGAN');
    expect(seed?.value.calorieTrackingMode).toBe('STRICT');
    expect(seed?.value.currentWeightKg).toBe(85);
    expect(seed?.value.targetWeightKg).toBe(70);
    expect(seed?.value.targetCalories).toBe(2200);
    expect(seed?.value.targetProteinGrams).toBe(150);
    expect(seed?.value.workoutReminderEnabled).toBeFalse();
    expect(seed?.hasExistingBodyBaseline).toBeTrue();
    expect(seed?.hasExistingNutritionBaseline).toBeTrue();
  });
});
