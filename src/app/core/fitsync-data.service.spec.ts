import { provideHttpClient } from '@angular/common/http';
import { HttpEventType } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsDashboardResponse } from './analytics.models';
import { DashboardData, FitSyncDataService, ProgressData, normalizeFocusAreas } from './fitsync-data.service';
import { DayMeal, Exercise, ExerciseDetail, ExerciseMetadata, ExerciseRecords, FoodCategory, FoodDetail, FoodSearchResult, GoalType, ImportResult, LoggedFood, Meal, MealTemplate, NutritionInsightsPage, OnboardingFormValue, OnboardingSeed, ProgressInsight, UpsertGoalRequest, UpsertWorkoutSessionRequest, UserGoal, WeeklyTrainingInsight, WorkoutExport, WorkoutPlan, WorkoutSession, WorkoutSessionDetail, UsualMeal, Leftover } from './fitsync.models';
import { MonthlyTrainingInsight } from './fitsync.models';
import { UserTimezoneService } from './user-timezone.service';

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
  fitnessLevel: 'INTERMEDIATE',
  trainingLocation: 'GYM',
  preferredDurationMinutes: 50,
  preferredWorkoutTime: '18:30',
  intensityPreference: 'HIGH',
  equipmentInventory: ['DUMBBELLS', 'BANDS'],
  focusAreas: ['FULL_BODY', 'CORE'],
  parqHeartCondition: false,
  parqChestPainActivity: false,
  parqDizziness: false,
  parqBoneJointIssue: false,
  parqBpOrHeartMeds: false,
  parqOtherReason: false,
  injuryAreas: [],
  parqAcknowledged: false,
  parqAcknowledgedAt: null,
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

const dashboardAnalytics: AnalyticsDashboardResponse = {
  generatedAt: '2026-06-22T00:00:00Z',
  timezone: 'UTC',
  body: {
    latestWeightKg: 77,
    latestBodyFatRate: 18,
    bmi: 24.3,
    weightChange30d: -2.4,
    measuredOn: '2026-06-21',
    latestWaistCm: 84.5,
    waistMeasuredAt: '2026-06-19'
  },
  workout: {
    todayWorkoutCount: 1,
    weekWorkoutCount: 7,
    weekWorkoutMinutes: 300,
    activeStreakDays: 7
  },
  nutrition: {
    todayCaloriesConsumed: 1850,
    todayCaloriesTarget: 2200,
    todayProteinGrams: 120,
    todayProteinTargetGrams: 150
  },
  goals: [
    {
      goalId: 'goal-calories-old',
      goalType: 'CALORIES',
      targetValue: 2100,
      targetUnit: 'kcal',
      currentValue: 1050,
      progressRatio: 0.5,
      onTrack: false,
      lastEvaluatedAt: '2026-06-21T00:00:00Z'
    },
    {
      goalId: 'goal-calories',
      goalType: 'CALORIES',
      targetValue: 2000,
      targetUnit: 'kcal',
      currentValue: 1900,
      progressRatio: 0.95,
      onTrack: true,
      lastEvaluatedAt: '2026-06-22T00:00:00Z'
    }
  ]
};

const activeGoalProgress = {
  goals: [
    {
      goalId: 'goal-calories-old',
      goalType: 'CALORIES',
      goalStatus: 'ACTIVE' as const,
      targetValue: 2100,
      targetUnit: 'kcal',
      targetDate: '2026-08-31',
      currentValue: 1050,
      progressRatio: 0.5,
      daysRemaining: 68,
      onTrack: false,
      lastEvaluatedAt: '2026-06-21T00:00:00Z'
    },
    {
      goalId: 'goal-calories',
      goalType: 'CALORIES',
      goalStatus: 'ACTIVE' as const,
      targetValue: 2000,
      targetUnit: 'kcal',
      targetDate: '2026-08-31',
      currentValue: 1900,
      progressRatio: 0.95,
      daysRemaining: 67,
      onTrack: true,
      lastEvaluatedAt: '2026-06-22T00:00:00Z'
    }
  ]
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

  it('loads progress data from analytics body trends and goal progress endpoints', () => {
    let result: ProgressData | undefined;
    service.getProgressData({ startDate: '2026-06-01', endDate: '2026-06-18' }, 'WEEK').subscribe((data) => {
      result = data;
    });

    const trendsRequest = httpTesting.expectOne(
      (request) =>
        request.url === '/api/v1/analytics/body/trends' &&
        request.params.get('from') === '2026-06-01' &&
        request.params.get('to') === '2026-06-18' &&
        request.params.get('bucket') === 'WEEK'
    );
    trendsRequest.flush({
      from: '2026-06-01',
      to: '2026-06-18',
      bucket: 'WEEK',
      points: [
        {
          date: '2026-06-01',
          weightKg: 72.6,
          bmi: 25.2,
          bodyFatRate: 21.1,
          waistCm: 83,
          weightDeltaFromStart: 0,
          weightDeltaFromPrevious: 0
        },
        {
          date: '2026-06-17',
          weightKg: 71.8,
          bmi: 24.9,
          bodyFatRate: 20.4,
          waistCm: 82,
          weightDeltaFromStart: -0.8,
          weightDeltaFromPrevious: -0.8
        }
      ]
    });

    const goalsRequest = httpTesting.expectOne(
      (request) => request.url === '/api/v1/analytics/goals/progress' && request.params.get('status') === 'ACTIVE'
    );
    goalsRequest.flush({
      goals: [
        {
          goalId: 'goal-weight',
          goalType: 'WEIGHT',
          goalStatus: 'ACTIVE',
          targetValue: 68,
          targetUnit: 'kg',
          targetDate: '2026-09-30',
          currentValue: 71.8,
          progressRatio: 0.55,
          daysRemaining: 100,
          onTrack: true,
          lastEvaluatedAt: '2026-06-17T07:00:00Z'
        }
      ]
    });

    expect(result?.latestBodyMetric?.weightKg).toBe(71.8);
    expect(result?.trendPoints[0].measuredAt).toBe('2026-06-01');
    expect(result?.goals[0].progressRatio).toBe(0.55);
    expect(result?.goals[0].daysRemaining).toBe(100);
  });

  it('loads user goals and ignores goal types outside the frontend lifecycle scope', () => {
    let result: UserGoal[] | undefined;
    service.getGoals().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/users/me/goals');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        goalId: 'goal-1',
        goalType: 'WEIGHT',
        targetValue: '75.5',
        targetUnit: 'kg',
        targetDate: '2026-12-31',
        status: 'ACTIVE',
        notes: 'Cut slowly'
      },
      {
        goalId: 'goal-2',
        goalType: 'STEPS',
        targetValue: 10000,
        targetUnit: 'steps',
        targetDate: null,
        status: 'ACTIVE',
        notes: null
      }
    ]);

    expect(result?.length).toBe(1);
    expect(result?.[0]).toEqual(
      jasmine.objectContaining({
        goalType: 'WEIGHT',
        targetValue: 75.5,
        targetUnit: 'kg'
      })
    );
  });

  it('upserts a user goal by goal type with the backend request body', () => {
    const goalType: GoalType = 'CALORIES';
    const payload: UpsertGoalRequest = {
      targetValue: 2200,
      targetUnit: 'kcal',
      targetDate: '2026-12-31',
      status: 'PAUSED',
      notes: 'Maintenance break'
    };

    let result: UserGoal | undefined;
    service.upsertGoal(goalType, payload).subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/users/me/goals/CALORIES');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ goalId: 'goal-calories', goalType, ...payload });

    expect(result?.goalType).toBe('CALORIES');
    expect(result?.status).toBe('PAUSED');
  });

  it('deletes a user goal by goal type', () => {
    const goalType: GoalType = 'WEIGHT';
    let completed = false;
    service.deleteGoal(goalType).subscribe({ complete: () => (completed = true) });

    const request = httpTesting.expectOne('/api/v1/users/me/goals/WEIGHT');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBeTrue();
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
    expect(request.request.body.fitnessLevel).toBe('INTERMEDIATE');
    expect(request.request.body.trainingLocation).toBe('GYM');
    expect(request.request.body.preferredDurationMinutes).toBe(50);
    expect(request.request.body.preferredWorkoutTime).toBe('18:30:00');
    expect(request.request.body.intensityPreference).toBe('HIGH');
    expect(request.request.body.equipmentInventory).toEqual(['DUMBBELLS', 'BANDS']);
    expect(request.request.body.focusAreas).toEqual(['FULL_BODY', 'CORE']);
    expect(request.request.body.healthReadiness).toBeUndefined();
    expect(typeof request.request.body.timezone).toBe('string');
    request.flush({});
  });

  it('sends health readiness only after the PAR-Q disclaimer is acknowledged', () => {
    service
      .saveOnboarding({
        ...baseOnboarding,
        parqHeartCondition: true,
        injuryAreas: ['LOWER_BACK'],
        parqAcknowledged: true,
        parqAcknowledgedAt: '2026-06-20T10:00:00.000Z'
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(request.request.body.healthReadiness).toEqual({
      heartCondition: true,
      chestPainActivity: false,
      dizziness: false,
      boneJointIssue: false,
      bpOrHeartMeds: false,
      otherReason: false,
      injuryAreas: ['LOWER_BACK'],
      acknowledgedDisclaimerAt: '2026-06-20T10:00:00.000Z'
    });
    request.flush({});
  });

  it('omits health readiness when the PAR-Q disclaimer is not acknowledged', () => {
    service
      .saveOnboarding({
        ...baseOnboarding,
        parqHeartCondition: true,
        injuryAreas: ['LOWER_BACK'],
        parqAcknowledged: false,
        parqAcknowledgedAt: null
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(request.request.body.healthReadiness).toBeUndefined();
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

  it('sends the current weight as the target when the goal asks for no target', () => {
    service
      .saveOnboarding({
        ...baseOnboarding,
        primaryGoal: 'MAINTAIN',
        currentWeightKg: 71.5,
        targetWeightKg: null,
        targetWeightLb: null
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(request.request.body.currentWeightKg).toBe(71.5);
    expect(request.request.body.targetWeightKg).toBe(71.5);
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
        training: {
          weeklyWorkoutDays: 5,
          fitnessLevel: '200002',
          trainingLocation: '210001',
          preferredDurationMinutes: 55,
          preferredWorkoutTime: '06:30:00',
          intensityPreference: '220003',
          equipmentInventory: ['230002', '230004'],
          focusAreas: ['240001', '240005']
        },
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
    expect(seed?.value.weeklyWorkoutDays).toBe(5);
    expect(seed?.value.fitnessLevel).toBe('INTERMEDIATE');
    expect(seed?.value.trainingLocation).toBe('HOME');
    expect(seed?.value.preferredDurationMinutes).toBe(55);
    expect(seed?.value.preferredWorkoutTime).toBe('06:30');
    expect(seed?.value.intensityPreference).toBe('HIGH');
    expect(seed?.value.equipmentInventory).toEqual(['DUMBBELLS', 'BANDS']);
    expect(seed?.value.focusAreas).toEqual(['FULL_BODY', 'MOBILITY']);
    expect(seed?.hasExistingBodyBaseline).toBeTrue();
    expect(seed?.hasExistingNutritionBaseline).toBeTrue();
  });

  it('sends the weekly workout days, or null when the user decides later', () => {
    service.saveOnboarding(baseOnboarding).subscribe();
    const counted = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(counted.request.body.weeklyWorkoutDays).toBe(4);
    counted.flush({});

    service.saveOnboarding({ ...baseOnboarding, weeklyWorkoutDays: null }).subscribe();
    const later = httpTesting.expectOne('/api/v1/users/me/onboarding');
    expect(later.request.body.weeklyWorkoutDays).toBeNull();
    later.flush({});
  });

  it('seeds the weekly workout days as null for a user who decided later, and leaves the default for a new one', () => {
    let seed: OnboardingSeed | undefined;
    service.getOnboardingSeed().subscribe((value) => (seed = value));
    httpTesting.expectOne('/api/v1/users/me').flush({
      profile: { displayName: 'Wang Xu', onboardingCompleted: true },
      preferences: { training: { weeklyWorkoutDays: null, fitnessLevel: '200002' } }
    });
    expect(seed?.value.weeklyWorkoutDays).toBeNull();

    service.getOnboardingSeed().subscribe((value) => (seed = value));
    httpTesting.expectOne('/api/v1/users/me').flush({
      profile: { displayName: 'New User', onboardingCompleted: false },
      preferences: { training: { weeklyWorkoutDays: null } }
    });
    expect('weeklyWorkoutDays' in (seed?.value ?? {})).toBeFalse();
  });

  it('maps dashboard data from the analytics dashboard endpoint', () => {
    let result: unknown;
    service.getDashboard().subscribe((value) => {
      result = value;
    });

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush(dashboardAnalytics);
    httpTesting
      .expectOne((req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE')
      .flush(activeGoalProgress);
    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu' }, activeGoals: [] });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({});
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});
    httpTesting.expectNone((req) => req.url.startsWith('/api/v1/nutrition/summary/daily'));

    expect(result).toEqual(
      jasmine.objectContaining({
        nutrition: jasmine.objectContaining({
          totalCalories: 1850,
          targetCalories: 2200,
          totalProteinGrams: 120,
          targetProteinGrams: 150
        }),
        workout: jasmine.objectContaining({
          activeStreakDays: 7,
          weekWorkoutMinutes: 300
        }),
        latestBodyMetric: jasmine.objectContaining({
          weightKg: 77,
          bodyFatRate: 18,
          bmi: 24.3,
          waistCm: 84.5
        }),
        goals: [
          jasmine.objectContaining({
            goalId: 'goal-calories',
            goalType: 'CALORIES',
            targetValue: 2000,
            targetUnit: 'kcal',
            targetDate: '2026-08-31',
            currentValue: 1900,
            onTrack: true,
            daysRemaining: 67,
            lastEvaluatedAt: '2026-06-22T00:00:00Z'
          })
        ]
      })
    );
  });

  it('carries the focus areas of the user preferences onto the dashboard profile', () => {
    let result: DashboardData | undefined;
    service.getDashboard().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush(dashboardAnalytics);
    httpTesting.expectOne((req) => req.url === '/api/v1/analytics/goals/progress').flush(activeGoalProgress);
    httpTesting.expectOne('/api/v1/users/me').flush({
      profile: { displayName: 'Wang Xu' },
      preferences: { training: { focusAreas: ['UPPER', '240003'] } },
      activeGoals: []
    });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({});
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});

    expect(result?.profile.focusAreas).toEqual(['UPPER', 'CORE']);
  });

  it('maps empty analytics dashboard fields to friendly empty dashboard data', () => {
    let result: unknown;
    service.getDashboard().subscribe((value) => {
      result = value;
    });

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush({
      ...dashboardAnalytics,
      body: { latestWeightKg: null, latestBodyFatRate: null, bmi: null, weightChange30d: null },
      nutrition: {
        todayCaloriesConsumed: null,
        todayCaloriesTarget: null,
        todayProteinGrams: null,
        todayProteinTargetGrams: null
      },
      goals: []
    });
    httpTesting
      .expectOne((req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE')
      .flush({ goals: [] });
    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu' }, activeGoals: [] });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({});
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});

    expect(result).toEqual(
      jasmine.objectContaining({
        nutrition: jasmine.objectContaining({
          totalCalories: 0,
          targetCalories: null,
          totalProteinGrams: 0,
          targetProteinGrams: null
        }),
        latestBodyMetric: null,
        goals: []
      })
    );
  });

  it('hides non-completed latest workout sessions from dashboard data', () => {
    let result: DashboardData | undefined;
    service.getDashboard().subscribe((value) => {
      result = value;
    });

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush(dashboardAnalytics);
    httpTesting
      .expectOne((req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE')
      .flush(activeGoalProgress);
    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu' }, activeGoals: [] });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({
      sessionId: 'cancelled-session',
      name: 'Cancelled workout',
      workoutType: 'STRENGTH',
      status: 'CANCELLED',
      startedAt: '2026-06-24T10:00:00Z',
      completedAt: null,
      durationMinutes: null,
      caloriesBurned: null,
      exerciseCount: 4
    });
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});

    expect(result?.latestWorkout).toBeNull();
  });

  it('keeps completed latest workout sessions in dashboard data', () => {
    let result: DashboardData | undefined;
    service.getDashboard().subscribe((value) => {
      result = value;
    });

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush(dashboardAnalytics);
    httpTesting
      .expectOne((req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE')
      .flush(activeGoalProgress);
    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu' }, activeGoals: [] });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({
      sessionId: 'completed-session',
      name: 'Completed workout',
      workoutType: 'STRENGTH',
      status: 'COMPLETED',
      startedAt: '2026-06-24T10:00:00Z',
      completedAt: '2026-06-24T10:45:00Z',
      durationMinutes: 45,
      caloriesBurned: 320,
      exerciseCount: 4
    });
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});

    expect(result?.latestWorkout).toEqual(jasmine.objectContaining({ sessionId: 'completed-session', status: 'COMPLETED' }));
  });

  it('loads daily nutrition summary with the date and no timezone param', () => {
    let result: unknown;
    service.getDailyNutritionSummary(new Date(2026, 5, 24)).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/nutrition/summary/daily' &&
        req.params.get('date') === '2026-06-24' &&
        !req.params.has('timezone')
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      totalCalories: 900,
      targetCalories: 2100,
      totalProteinGrams: '66.5',
      targetProteinGrams: '150',
      totalCarbsGrams: '110',
      targetCarbsGrams: '240',
      totalFatGrams: '25',
      targetFatGrams: '70',
      mealCount: 2,
      totalFiberGrams: '12',
      fiberTargetGrams: '30',
      fiberTargetMet: false
    });

    expect(result).toEqual(
      jasmine.objectContaining({
        totalCalories: 900,
        targetCalories: 2100,
        totalProteinGrams: 66.5,
        targetProteinGrams: 150,
        totalCarbsGrams: 110,
        targetCarbsGrams: 240,
        totalFatGrams: 25,
        targetFatGrams: 70,
        mealCount: 2,
        totalFiberGrams: 12,
        fiberTargetGrams: 30,
        fiberTargetMet: false
      })
    );
  });

  it('searches foods by query and maps Spring Page content calories + basis', () => {
    let result: FoodSearchResult[] | undefined;
    service.searchFoods('chicken').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/foods/search' && req.params.get('q') === 'chicken'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      content: [
        { foodId: 'f1', displayName: 'Grilled chicken breast', brandName: 'Generic', categoryName: 'Protein', calories: 165, basisLabel: '100 g', verified: true }
      ],
      number: 0,
      size: 20,
      totalPages: 1,
      totalElements: 1
    });

    expect(result?.length).toBe(1);
    expect(result?.[0].foodId).toBe('f1');
    expect(result?.[0].calories).toBe(165);
    expect(result?.[0].basisUnit).toBe('100 g');
    expect(result?.[0].categoryName).toBe('Protein');
    expect(result?.[0].verified).toBeTrue();
    expect(result?.[0].proteinGrams).toBe(0);
  });

  it('loads a paged food search with Spring Page metadata', () => {
    let result: unknown;
    service.searchFoodsPage('rice', { page: 2, size: 20 }).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/nutrition/foods/search' &&
        req.params.get('q') === 'rice' &&
        req.params.get('page') === '2' &&
        req.params.get('size') === '20'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      content: [{ foodId: 'f2', displayName: 'Brown rice', brandName: 'Generic', calories: 112, basisLabel: '100 g' }],
      number: 2,
      size: 20,
      totalPages: 5,
      totalElements: 94
    });

    expect(result).toEqual(
      jasmine.objectContaining({
        page: 2,
        size: 20,
        totalPages: 5,
        totalElements: 94,
        items: [jasmine.objectContaining({ foodId: 'f2', displayName: 'Brown rice' })]
      })
    );
  });

  it('lists favorite foods from the favorites endpoint', () => {
    let result: FoodSearchResult[] | undefined;
    service.getFavoriteFoods().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/favorites');
    expect(request.request.method).toBe('GET');
    request.flush([
      { foodId: 'f1', displayName: 'Greek yogurt', brandName: 'Generic', categoryName: 'Dairy', calories: 96, basisLabel: '100 g', verified: true }
    ]);

    expect(result?.[0].foodId).toBe('f1');
    expect(result?.[0].displayName).toBe('Greek yogurt');
    expect(result?.[0].categoryName).toBe('Dairy');
  });

  it('adds and removes a favorite food through the favorite endpoints', () => {
    service.addFavoriteFood('f1').subscribe();
    const addRequest = httpTesting.expectOne('/api/v1/nutrition/foods/f1/favorite');
    expect(addRequest.request.method).toBe('POST');
    addRequest.flush(null);

    service.removeFavoriteFood('f1').subscribe();
    const removeRequest = httpTesting.expectOne('/api/v1/nutrition/foods/f1/favorite');
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null);
  });

  it('searches foods by category with includeSubcategories when a category is selected', () => {
    let result: FoodSearchResult[] | undefined;
    service
      .searchFoods('rice', { categoryId: 'cat-grains', includeSubcategories: true })
      .subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/nutrition/foods/search' &&
        req.params.get('q') === 'rice' &&
        req.params.get('categoryId') === 'cat-grains' &&
        req.params.get('includeSubcategories') === 'true'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      content: [{ foodId: 'f2', displayName: 'Brown rice', brandName: 'Generic', calories: 112, basisLabel: '100 g' }],
      number: 0,
      size: 20,
      totalPages: 1,
      totalElements: 1
    });

    expect(result?.[0].displayName).toBe('Brown rice');
  });

  it('passes verified filter, page, and size params to the food search', () => {
    service.searchFoods('oat', { verified: true, page: 2, size: 20 }).subscribe();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/nutrition/foods/search' &&
        req.params.get('verified') === 'true' &&
        req.params.get('page') === '2' &&
        req.params.get('size') === '20'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], number: 2, size: 20, totalPages: 0, totalElements: 0 });
  });

  it('lists meal templates with items and logs a meal from a template', () => {
    let templates: MealTemplate[] | undefined;
    service.getMealTemplates().subscribe((value) => (templates = value));
    httpTesting.expectOne('/api/v1/nutrition/meal-templates').flush([
      {
        templateId: 't1',
        name: 'Protein breakfast',
        mealType: 'BREAKFAST',
        note: '',
        totalCalories: 520,
        items: [{
          templateItemId: 'ti1',
          foodCatalogItemId: 'f1',
          foodName: 'Greek yogurt',
          quantity: '1',
          unit: 'serving',
          snapshotServingLabel: '170 g',
          calories: 120,
          proteinGrams: '18',
          carbsGrams: '6',
          fatGrams: '0'
        }]
      }
    ]);
    expect(templates?.[0].name).toBe('Protein breakfast');
    expect(templates?.[0].totalCalories).toBe(520);
    expect(templates?.[0].items[0].proteinGrams).toBe(18);

    let ok = false;
    service.logMealFromTemplate('t1').subscribe(() => (ok = true));
    const request = httpTesting.expectOne('/api/v1/nutrition/meals/from-template/t1');
    expect(request.request.method).toBe('POST');
    request.flush({});
    expect(ok).toBeTrue();
  });

  it('loads a meal template detail and creates a template from item drafts', () => {
    let template: MealTemplate | null | undefined;
    service.getMealTemplate('t1').subscribe((value) => (template = value));
    const detailRequest = httpTesting.expectOne('/api/v1/nutrition/meal-templates/t1');
    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush({
      templateId: 't1',
      name: 'Protein breakfast',
      mealType: 'BREAKFAST',
      note: '',
      totalCalories: 520,
      items: [{ templateItemId: 'ti1', foodCatalogItemId: 'f1', foodName: 'Greek yogurt', quantity: 1, unit: 'serving', calories: 120 }]
    });
    expect(template?.items.length).toBe(1);

    let created: MealTemplate | undefined;
    service.createMealTemplate({
      name: 'Lunch set',
      mealType: 'LUNCH',
      note: '',
      items: [{
        foodCatalogItemId: 'f1',
        customFoodId: null,
        foodServingId: 's1',
        foodName: 'Chicken rice',
        brandName: 'Hawker',
        quantity: 1,
        unit: 'serving',
        servingSize: 150,
        servingUnit: 'g',
        snapshotServingLabel: '1 bowl',
        calories: 450,
        proteinGrams: 35,
        carbsGrams: 50,
        fatGrams: 12,
        fiberGrams: null,
        sugarGrams: null,
        sodiumMg: null
      }]
    }).subscribe((value) => (created = value));

    const createRequest = httpTesting.expectOne('/api/v1/nutrition/meal-templates');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body.items[0]).toEqual(jasmine.objectContaining({ foodCatalogItemId: 'f1', calories: 450 }));
    createRequest.flush({ templateId: 't2', name: 'Lunch set', mealType: 'LUNCH', note: '', totalCalories: 450, items: [] });
    expect(created?.templateId).toBe('t2');
  });

  it('copies a meal to now via POST /meals/{id}/copy', () => {
    let ok = false;
    service.copyMeal('m1', 'LUNCH').subscribe(() => (ok = true));

    const request = httpTesting.expectOne('/api/v1/nutrition/meals/m1/copy');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.mealType).toBe('LUNCH');
    expect(typeof request.request.body.consumedAt).toBe('string');
    request.flush({});
    expect(ok).toBeTrue();
  });

  it('copies a meal at a chosen instant when one is given', () => {
    service.copyMeal('m1', 'BREAKFAST', '2026-10-01T23:30:00.000Z').subscribe();

    const request = httpTesting.expectOne('/api/v1/nutrition/meals/m1/copy');
    expect(request.request.body).toEqual({ mealType: 'BREAKFAST', consumedAt: '2026-10-01T23:30:00.000Z' });
    request.flush({});
  });

  it('reads the leftovers and leaves out a row without a cook id or a count', () => {
    let result: Leftover[] | undefined;
    service.getLeftovers().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/nutrition/recipes/cooks/leftovers').flush([
      { cookId: 'c1', recipeId: 'r1', name: 'Beef stew', imageUrl: null, cookedAt: '2026-10-05T11:00:00Z', servingsLeft: 3, kcalPerServing: 540 },
      { recipeId: 'r2', name: 'No cook id', servingsLeft: 1 },
      { cookId: 'c3', servingsLeft: 'many' }
    ]);

    expect(result).toEqual([{ cookId: 'c1', recipeId: 'r1', name: 'Beef stew', imageUrl: null, cookedAt: '2026-10-05T11:00:00Z', servingsLeft: 3, kcalPerServing: 540 }]);
  });

  it('patches the servings a cook logged and returns the servings left', () => {
    let left: number | null | undefined;
    service.patchCookServings('c 1', 1).subscribe((value) => (left = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/recipes/cooks/c%201');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ servingsLogged: 1 });
    request.flush({ cookId: 'c 1', servingsLeft: 3 });

    expect(left).toBe(3);
  });

  it('eats one serving of a leftover and returns the updated row', () => {
    let result: { cookId: string; servingsLeft: number } | null | undefined;
    service.eatLeftover('c 1', { mealType: 'DINNER', servings: 1 }).subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/recipes/cooks/c%201/leftover');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ mealType: 'DINNER', servings: 1 });
    request.flush({ cookId: 'c 1', servingsLeft: 2, meal: { mealId: 'm1' } });

    expect(result?.servingsLeft).toBe(2);
  });

  it('fetches the usual meals and maps them defensively', () => {
    let result: UsualMeal[] | undefined;
    service.getUsualMeals().subscribe((value) => (result = value));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/meals/usual');
    expect(request.request.params.has('timezone')).toBeFalse();
    request.flush({
      timezone: 'Asia/Singapore',
      windowDays: 14,
      meals: [
        {
          mealType: 'BREAKFAST',
          label: 'Breakfast',
          usualTime: '07:30',
          mealsInWindow: 5,
          occurrences: 4,
          sourceMealId: 'm9',
          totalCalories: 499,
          totalProteinGrams: 30,
          totalCarbsGrams: 60,
          totalFatGrams: 14,
          items: [{ name: 'Oats', calories: 228, proteinGrams: 8, categoryCode: 'GRAINS' }, { calories: 10 }]
        },
        { mealType: 'LUNCH', label: 'Lunch', usualTime: '25:99', sourceMealId: null, totalCalories: null, items: [] },
        { mealType: 'DINNER', usualTime: 'soon' }
      ]
    });

    expect(result?.length).toBe(3);
    expect(result?.[0]).toEqual({
      mealType: 'BREAKFAST',
      label: 'Breakfast',
      usualTime: '07:30',
      sourceMealId: 'm9',
      totalCalories: 499,
      totalProteinGrams: 30,
      totalCarbsGrams: 60,
      totalFatGrams: 14,
      items: [
        { name: 'Oats', calories: 228, proteinGrams: 8, categoryCode: 'GRAINS' },
        { name: '', calories: 10, proteinGrams: null, categoryCode: null }
      ]
    });
    expect(result?.[1].usualTime).toBeNull();
    expect(result?.[1].sourceMealId).toBeNull();
    expect(result?.[2]).toEqual(jasmine.objectContaining({ usualTime: null, totalCalories: null, items: [] }));
  });

  it('reads a missing list of usual meals as empty', () => {
    let result: UsualMeal[] | undefined;
    service.getUsualMeals().subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/meals/usual').flush({});

    expect(result).toEqual([]);
  });

  it('looks up a food by barcode and maps full macros', () => {
    let food: LoggedFood | null | undefined;
    service.getFoodByBarcode('123456').subscribe((value) => (food = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/barcodes/123456');
    expect(request.request.method).toBe('GET');
    request.flush({ foodId: 'f9', displayName: 'Oat bar', brandName: 'Acme', calories: 180, proteinGrams: 5, carbsGrams: 28, fatGrams: 6, basisUnit: 'bar' });

    expect(food?.foodName).toBe('Oat bar');
    expect(food?.proteinGrams).toBe(5);
  });

  it('returns null when a barcode lookup fails', () => {
    let food: LoggedFood | null | undefined = undefined;
    service.getFoodByBarcode('000').subscribe((value) => (food = value));

    httpTesting.expectOne('/api/v1/nutrition/barcodes/000').flush('not found', { status: 404, statusText: 'Not Found' });

    expect(food).toBeNull();
  });

  it('loads food detail with servings and full nutrition', () => {
    let detail: FoodDetail | null | undefined;
    service.getFoodDetail('food-1').subscribe((value) => (detail = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/foods/food-1');
    expect(request.request.method).toBe('GET');
    request.flush({
      foodId: 'food-1',
      displayName: 'Greek yogurt',
      brandName: 'Generic',
      scope: 'CATALOG',
      calories: 96,
      proteinGrams: '10.2',
      carbsGrams: '3.8',
      fatGrams: '0.4',
      fiberGrams: '0',
      sugarGrams: '3.6',
      sodiumMg: '36',
      basisQuantity: '100',
      basisUnit: 'g',
      servings: [
        {
          servingId: 'serving-1',
          label: '1 cup',
          quantity: '170',
          unit: 'g',
          gramsEquivalent: '170',
          sortOrder: 1,
          defaultServing: true
        }
      ]
    });

    expect(detail?.displayName).toBe('Greek yogurt');
    expect(detail?.proteinGrams).toBe(10.2);
    expect(detail?.servings[0].gramsEquivalent).toBe(170);
  });

  it('creates a meal with multiple item snapshots', () => {
    let meal: Meal | undefined;
    service
      .createMeal({
        mealType: 'LUNCH',
        name: 'Chicken lunch',
        note: 'Post workout',
        consumedAt: '2026-06-20T04:00:00.000Z',
        items: [
          {
            foodCatalogItemId: 'food-catalog',
            customFoodId: null,
            foodServingId: 'serving-1',
            foodName: 'Chicken rice',
            brandName: 'Hawker',
            quantity: 1.5,
            unit: 'serving',
            servingSize: 150,
            servingUnit: 'g',
            snapshotServingLabel: '1 bowl',
            calories: 450,
            proteinGrams: 38,
            carbsGrams: 55,
            fatGrams: 12,
            fiberGrams: 3,
            sugarGrams: 4,
            sodiumMg: 650
          },
          {
            foodCatalogItemId: null,
            customFoodId: 'custom-food',
            foodServingId: 'serving-2',
            foodName: 'Home sauce',
            brandName: null,
            quantity: 1,
            unit: 'serving',
            servingSize: 20,
            servingUnit: 'g',
            snapshotServingLabel: '1 tbsp',
            calories: 40,
            proteinGrams: 1,
            carbsGrams: 5,
            fatGrams: 2,
            fiberGrams: null,
            sugarGrams: null,
            sodiumMg: null
          }
        ]
      })
      .subscribe((value) => (meal = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/meals');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.mealType).toBe('LUNCH');
    expect(request.request.body.source).toBe('MANUAL');
    expect(request.request.body.items.length).toBe(2);
    expect(request.request.body.items[0]).toEqual(
      jasmine.objectContaining({
        foodCatalogItemId: 'food-catalog',
        foodServingId: 'serving-1',
        quantity: 1.5,
        calories: 450,
        proteinGrams: 38
      })
    );
    expect(request.request.body.items[1].customFoodId).toBe('custom-food');
    request.flush({
      mealId: 'meal-1',
      mealType: 'LUNCH',
      name: 'Chicken lunch',
      totalCalories: 490,
      totalProteinGrams: '39',
      consumedAt: '2026-06-20T04:00:00.000Z',
      itemCount: 2
    });

    expect(meal?.itemCount).toBe(2);
    expect(meal?.totalCalories).toBe(490);
  });

  it('quick-adds a manual meal through the quick-add endpoint', () => {
    service
      .quickAddMeal({
        mealType: 'SNACK',
        name: 'Manual shake',
        consumedAt: '2026-06-20T04:00:00.000Z',
        calories: 220,
        proteinGrams: 30,
        carbsGrams: 12,
        fatGrams: 4
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/nutrition/meals/quick-add');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        mealType: 'SNACK',
        name: 'Manual shake',
        calories: 220,
        proteinGrams: 30,
        carbsGrams: 12,
        fatGrams: 4
      })
    );
    request.flush({
      mealId: 'meal-quick',
      mealType: 'SNACK',
      name: 'Manual shake',
      totalCalories: 220,
      totalProteinGrams: '30',
      consumedAt: '2026-06-20T04:00:00.000Z',
      itemCount: 0
    });
  });

  it('maps nutrition category trees for category browsing', () => {
    let result: FoodCategory[] | undefined;
    service.getFoodCategories().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/categories');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        categoryId: 'cat-protein',
        parentId: null,
        code: 'PROTEIN',
        displayName: 'Protein',
        slug: 'protein',
        sortOrder: 10,
        children: [
          {
            categoryId: 'cat-poultry',
            parentId: 'cat-protein',
            code: 'POULTRY',
            displayName: 'Poultry',
            slug: 'poultry',
            sortOrder: 11,
            children: []
          }
        ]
      }
    ]);

    expect(result?.[0].displayName).toBe('Protein');
    expect(result?.[0].children[0].parentId).toBe('cat-protein');
    expect(result?.[0].children[0].displayName).toBe('Poultry');
  });

  it('maps recent foods with full macros for one-tap re-logging', () => {
    let result: LoggedFood[] | undefined;
    service.getRecentFoods(5).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/foods/recent' && req.params.get('limit') === '5'
    );
    request.flush([
      { foodName: 'Greek yogurt', brandName: 'Generic', snapshotServingLabel: '170 g', calories: 100, proteinGrams: 17, carbsGrams: 6, fatGrams: 0, timesLogged: 4, lastLoggedAt: '2026-06-20T04:00:00Z' }
    ]);

    expect(result?.[0].proteinGrams).toBe(17);
    expect(result?.[0].servingLabel).toBe('170 g');
    expect(result?.[0].timesLogged).toBe(4);
    expect(result?.[0].lastLoggedAt).toBe('2026-06-20T04:00:00Z');
  });

  it('maps frequent foods with full macros for one-tap re-logging', () => {
    let result: LoggedFood[] | undefined;
    service.getFrequentFoods(6).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/foods/frequent' && req.params.get('limit') === '6'
    );
    request.flush([
      { foodName: 'Chicken rice', brandName: 'Hawker', snapshotServingLabel: '1 plate', calories: 620, proteinGrams: '38', carbsGrams: '72', fatGrams: '18', timesLogged: '9', lastLoggedAt: '2026-06-19T04:00:00Z' }
    ]);

    expect(result?.[0].foodName).toBe('Chicken rice');
    expect(result?.[0].proteinGrams).toBe(38);
    expect(result?.[0].timesLogged).toBe(9);
    expect(result?.[0].lastLoggedAt).toBe('2026-06-19T04:00:00Z');
  });

  it('fetches today meals within a from/to day window and no timezone param', () => {
    let result: Meal[] | undefined;
    service.getTodayMeals().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/nutrition/meals' &&
        req.params.has('from') &&
        req.params.has('to') &&
        !req.params.has('timezone')
    );
    request.flush([
      { mealType: 'LUNCH', name: 'Chicken rice', totalCalories: 640, totalProteinGrams: 48, consumedAt: '2026-06-19T04:30:00Z', itemCount: 1 }
    ]);

    expect(result?.length).toBe(1);
    expect(result?.[0].mealType).toBe('LUNCH');
    expect(result?.[0].totalCalories).toBe(640);
  });

  it('fetches the meals of one local day with their macros and foods, to the end of the day', () => {
    let result: DayMeal[] | undefined;
    service.getMealsForDay(new Date(2026, 8, 30, 14, 5)).subscribe((value) => (result = value));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/meals');
    expect(new Date(request.request.params.get('from') ?? '').getTime()).toBe(new Date(2026, 8, 30, 0, 0, 0, 0).getTime());
    expect(new Date(request.request.params.get('to') ?? '').getTime()).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).getTime() - 1);
    request.flush([
      {
        mealId: 'm1',
        mealType: 'BREAKFAST',
        consumedAt: '2026-09-30T00:10:00Z',
        totalCalories: 453,
        totalProteinGrams: 27.5,
        totalCarbsGrams: 60,
        totalFatGrams: 12,
        items: [{ foodName: 'Oats', calories: 228, proteinGrams: 8 }, { calories: 10 }]
      }
    ]);

    expect(result).toEqual([
      {
        mealId: 'm1',
        mealType: 'BREAKFAST',
        consumedAt: '2026-09-30T00:10:00Z',
        totalCalories: 453,
        totalProteinGrams: 27.5,
        totalCarbsGrams: 60,
        totalFatGrams: 12,
        items: [
          { name: 'Oats', calories: 228, proteinGrams: 8 },
          { name: '', calories: 10, proteinGrams: 0 }
        ]
      }
    ]);
  });

  it('reads the Home dashboard from three requests, with no latest meal or workout', () => {
    let result: unknown;
    service.getHomeDashboard().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush({
      ...dashboardAnalytics,
      workout: { ...dashboardAnalytics.workout, currentStreakDays: 4, minutesThisWeek: 135 }
    });
    httpTesting
      .expectOne((req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE')
      .flush(activeGoalProgress);
    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu', timezone: 'Europe/London' }, activeGoals: [] });
    httpTesting.expectNone('/api/v1/workouts/sessions/latest');
    httpTesting.expectNone('/api/v1/nutrition/meals/latest');

    const home = result as { profile: { timezone: string }; workout: { currentStreakDays: number; minutesThisWeek: number } };
    expect(home.profile.timezone).toBe('Europe/London');
    expect(home.workout.currentStreakDays).toBe(4);
    expect(home.workout.minutesThisWeek).toBe(135);
    expect(result).not.toEqual(jasmine.objectContaining({ nutrition: jasmine.anything() }));
  });

  it('fails the Home dashboard with one message when a request fails', () => {
    let message = '';
    service.getHomeDashboard().subscribe({ error: (error: Error) => (message = error.message) });

    httpTesting.expectOne('/api/v1/analytics/dashboard').flush('nope', { status: 500, statusText: 'Server Error' });
    // The requests that were still open when the first one failed are answered or already cancelled.
    httpTesting.match(() => true).forEach((request) => (request.cancelled ? undefined : request.flush({ profile: {}, goals: [] })));

    expect(message).toBe('Unable to load dashboard data. Please retry.');
  });

  it('passes a failed daily summary on as an error when the caller asks to see it', () => {
    let failed = false;
    service.loadDailyNutritionSummary('2026-06-24').subscribe({ error: () => (failed = true) });

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/summary/daily' && req.params.get('date') === '2026-06-24' && !req.params.has('timezone')
    );
    request.flush('nope', { status: 500, statusText: 'Server Error' });

    expect(failed).toBeTrue();
  });

  it('still turns a failed daily summary into an empty one for the other callers', () => {
    let result: { totalCalories: number } | undefined;
    service.getDailyNutritionSummary(new Date(2026, 5, 24)).subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/summary/daily').flush('nope', { status: 500, statusText: 'Server Error' });

    expect(result?.totalCalories).toBe(0);
  });

  it('fetches the meals of the day the profile zone is in, from its midnight to its last millisecond', () => {
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    service.getMealsForDay(new Date('2026-10-02T17:30:00Z')).subscribe();

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/meals');
    // 01:30 on 3 October in Singapore, so the day is the 3rd there and began at 16:00 UTC on the 2nd.
    expect(request.request.params.get('from')).toBe('2026-10-02T16:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-10-03T15:59:59.999Z');
    request.flush([]);
  });

  it('asks for the daily summary of the day an instant falls on in the profile zone', () => {
    const userTimezone = TestBed.inject(UserTimezoneService);
    // 11:30 UTC on 2 October is 00:30 on the 3rd in Auckland and 04:30 on the 2nd in Los Angeles.
    const instant = new Date('2026-10-02T11:30:00Z');

    userTimezone.setProfileZone('Pacific/Auckland');
    service.getDailyNutritionSummary(instant).subscribe();
    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/summary/daily' && req.params.get('date') === '2026-10-03').flush({});

    userTimezone.setProfileZone('America/Los_Angeles');
    service.loadDailyNutritionSummary(instant).subscribe();
    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/summary/daily' && req.params.get('date') === '2026-10-02').flush({});
  });

  it('lets a failed day-meals request through so the card can offer a retry', () => {
    let failed = false;
    service.getMealsForDay().subscribe({ error: () => (failed = true) });

    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/meals').flush('nope', { status: 500, statusText: 'Server Error' });

    expect(failed).toBeTrue();
  });

  it('answers whether any meal was ever logged from the latest meal alone, and lets a failure through', () => {
    const answers: boolean[] = [];
    let failed = false;
    service.hasLoggedMeal().subscribe((value) => answers.push(value));
    service.hasLoggedMeal().subscribe((value) => answers.push(value));
    service.hasLoggedMeal().subscribe((value) => answers.push(value));
    service.hasLoggedMeal().subscribe({ error: () => (failed = true) });

    const requests = httpTesting.match((req) => req.url === '/api/v1/nutrition/meals/latest');
    expect(requests.length).toBe(4);
    expect(requests.every((request) => request.request.method === 'GET' && request.request.params.keys().length === 0)).toBeTrue();
    httpTesting.expectNone((req) => req.url === '/api/v1/nutrition/meals');
    requests[0].flush({ mealId: 'm1', mealType: 'BREAKFAST' });
    requests[1].flush(null);
    requests[2].flush({});
    requests[3].flush('nope', { status: 503, statusText: 'Service Unavailable' });

    expect(answers).toEqual([true, false, false]);
    expect(failed).toBeTrue();
  });

  it('lists workout sessions from the paginated sessions endpoint', () => {
    let result: WorkoutSession[] | undefined;
    service.getWorkoutSessions().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/sessions' && req.params.get('size') === '10'
    );
    request.flush({
      content: [
        { name: 'Lower body', workoutType: 'STRENGTH', status: 'COMPLETED', startedAt: '2026-06-18T10:00:00Z', completedAt: '2026-06-18T11:00:00Z', durationMinutes: 54, caloriesBurned: 400, exerciseCount: 6 }
      ]
    });

    expect(result?.length).toBe(1);
    expect(result?.[0].status).toBe('COMPLETED');
    expect(result?.[0].durationMinutes).toBe(54);
  });

  it('preserves workout session totalElements and caps page size at the backend maximum', () => {
    let result: { sessions: WorkoutSession[]; total: number } | undefined;
    service.getWorkoutSessionPage(200).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/sessions' && Number(req.params.get('size')) <= 100
    );
    expect(request.request.params.get('size')).toBe('100');
    request.flush({
      totalElements: 123,
      content: [
        {
          name: 'Lower body',
          workoutType: 'STRENGTH',
          status: 'COMPLETED',
          startedAt: '2026-06-18T10:00:00Z',
          completedAt: '2026-06-18T11:00:00Z',
          durationMinutes: 54,
          caloriesBurned: 400,
          exerciseCount: 6
        }
      ]
    });

    expect(result?.total).toBe(123);
    expect(result?.sessions.length).toBe(1);
  });

  it('carries the kind, sport and distance of a listed session', () => {
    let result: { sessions: WorkoutSession[] } | undefined;
    service.getWorkoutSessionPage(20).subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/sessions').flush({
      content: [
        { name: 'Cycling', workoutType: 'SPORTS', status: 'COMPLETED', kind: 'SPORT', sportActivity: 'CYCLING', sportLabel: 'Cycling', distanceKm: '24.5' },
        { name: 'Lower body', workoutType: 'STRENGTH', status: 'COMPLETED' }
      ]
    });

    expect(result?.sessions[0]).toEqual(jasmine.objectContaining({ kind: 'SPORT', sportActivity: 'CYCLING', sportLabel: 'Cycling', distanceKm: 24.5 }));
    expect(result?.sessions[1]).toEqual(jasmine.objectContaining({ kind: null, sportLabel: null, distanceKm: null }));
  });

  it('lists workout sessions in a from/to range with the backend-safe page size', () => {
    let result: WorkoutSession[] | undefined;
    service
      .getWorkoutSessionsInRange('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z')
      .subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/sessions' &&
        req.params.get('from') === '2026-06-01T00:00:00.000Z' &&
        req.params.get('to') === '2026-06-30T23:59:59.999Z' &&
        req.params.get('size') === '100'
    );
    request.flush({
      content: [
        {
          sessionId: 'session-1',
          workoutType: 'CARDIO',
          status: 'COMPLETED',
          startedAt: '2026-06-18T10:00:00Z',
          completedAt: '2026-06-18T11:00:00Z',
          durationMinutes: 60
        }
      ]
    });

    expect(result?.length).toBe(1);
    expect(result?.[0].sessionId).toBe('session-1');
    expect(result?.[0].name).toBe('Cardio');
    expect(result?.[0].workoutType).toBe('CARDIO');
    expect(result?.[0].durationMinutes).toBe(60);
  });

  it('requests the nutrition insight page without a timezone param and keeps the protein by meal in order', () => {
    let result: NutritionInsightsPage | undefined;
    service.getNutritionInsightsPage().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/insights/page' && !req.params.has('timezone')
    );
    request.flush({
      period: 'PREVIOUS_WEEK',
      periodStart: '2026-09-21',
      periodEnd: '2026-09-27',
      daysLogged: 6,
      proteinPerDayGrams: 159,
      proteinTargetGrams: 155,
      proteinByMeal: [
        { mealType: 'BREAKFAST', label: 'Breakfast', gramsPerDay: 27.4 },
        { mealType: 'LUNCH', label: 'Lunch', gramsPerDay: 54 }
      ]
    });

    expect(result?.daysLogged).toBe(6);
    expect(result?.proteinByMeal.map((meal) => meal.label)).toEqual(['Breakfast', 'Lunch']);
    expect(result?.proteinByMeal[0].gramsPerDay).toBe(27.4);
  });

  it('maps a nutrition insight page with missing fields to an empty list and null numbers', () => {
    let result: NutritionInsightsPage | undefined;
    service.getNutritionInsightsPage().subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/insights/page').flush({
      proteinByMeal: [{ mealType: 'LUNCH', label: 'Lunch' }, null]
    });

    expect(result?.proteinByMeal).toEqual([]);
    expect(result?.daysLogged).toBeNull();
    expect(result?.proteinTargetGrams).toBeNull();
    expect(result?.periodStart).toBeNull();
  });

  it('lets a failed nutrition insight request propagate', () => {
    let failed = false;
    service.getNutritionInsightsPage().subscribe({ error: () => (failed = true) });
    httpTesting.expectOne((req) => req.url === '/api/v1/nutrition/insights/page').flush('no', { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
  });

  it('requests the progress insight without a timezone param and keeps the weight series', () => {
    let result: ProgressInsight | undefined;
    service.getProgressInsight().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/users/me/insights/progress' && !req.params.has('timezone')
    );
    request.flush({
      referenceDate: '2026-10-01',
      weightKg: 71.1,
      measuredOn: '2026-10-01',
      weeklyRateKg: -0.4,
      goalWeightKg: 68,
      goalDate: '2026-11-25',
      projectedDate: '2026-10-25',
      series: [
        { date: '2026-09-13', weightKg: 72.5 },
        { date: '2026-10-01', weightKg: 71.1 }
      ]
    });

    expect(result?.goalWeightKg).toBe(68);
    expect(result?.projectedDate).toBe('2026-10-25');
    expect(result?.series.length).toBe(2);
  });

  it('maps a progress insight with missing fields to an empty series and null numbers', () => {
    let result: ProgressInsight | undefined;
    service.getProgressInsight().subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/users/me/insights/progress').flush({
      series: [{ date: '2026-09-13' }, { weightKg: 70 }, { date: '2026-09-14', weightKg: 'heavy' }]
    });

    expect(result?.series).toEqual([]);
    expect(result?.weightKg).toBeNull();
    expect(result?.goalWeightKg).toBeNull();
    expect(result?.projectedDate).toBeNull();
  });

  it('keeps the window of days the weekly rate was measured over, and null when it is absent', () => {
    const results: ProgressInsight[] = [];
    service.getProgressInsight().subscribe((value) => results.push(value));
    httpTesting.expectOne((req) => req.url === '/api/v1/users/me/insights/progress').flush({ weeklyRateKg: -0.41, rateWindowDays: 28, series: [] });
    service.getProgressInsight().subscribe((value) => results.push(value));
    httpTesting.expectOne((req) => req.url === '/api/v1/users/me/insights/progress').flush({ series: [] });

    expect(results.map((value) => value.rateWindowDays)).toEqual([28, null]);
  });

  it('requests the weekly training insight with the date when given', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight('2026-09-27').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/insights/weekly' &&
        !req.params.has('timezone') &&
        req.params.get('date') === '2026-09-27'
    );
    request.flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 4,
      totalMinutes: 170,
      previousWeekCompletedSessions: 3,
      previousWeekTotalMinutes: 120,
      muscleGroups: [],
      volume: {
        thisWeekKg: 3846,
        previousWeekKg: 1716,
        weekBeforePreviousKg: 1716,
        thisWeekSessionsWithVolume: 2,
        previousWeekSessionsWithVolume: 1
      }
    });

    expect(result?.completedSessions).toBe(4);
    expect(result?.weekStart).toBe('2026-09-21');
    expect(result?.volume.thisWeekKg).toBe(3846);
  });

  it('keeps the lifts of the weekly insight and tolerates a response without them or with bad rows', () => {
    const results: WeeklyTrainingInsight[] = [];
    service.getWeeklyTrainingInsight().subscribe((value) => results.push(value));
    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
      lifts: [
        { exerciseId: 'e1', name: 'Deadlift', e1rmStart: 81.7, e1rmNow: 93.3, changePct: 14 },
        { exerciseId: 'e2', name: 'Row', e1rmStart: 'x', e1rmNow: 50 },
        { exerciseId: 'e3', e1rmStart: 10, e1rmNow: 12 },
        null
      ]
    });
    service.getWeeklyTrainingInsight().subscribe((value) => results.push(value));
    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({});

    expect(results[0].lifts).toEqual([
      { exerciseId: 'e1', name: 'Deadlift', e1rmStart: 81.7, e1rmNow: 93.3, changePct: 14 },
      { exerciseId: 'e2', name: 'Row', e1rmStart: 0, e1rmNow: 50, changePct: null }
    ]);
    expect(results[1].lifts).toEqual([]);
  });

  it('omits the date param from the weekly training insight request when none is given', () => {
    service.getWeeklyTrainingInsight().subscribe();

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/insights/weekly' && !req.params.has('timezone')
    );
    expect(request.request.params.has('date')).toBe(false);
    request.flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 }
    });
  });

  it('defensively maps a weekly training insight with missing and invalid fields', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/insights/weekly'
    );
    request.flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: null,
      totalMinutes: undefined,
      previousWeekCompletedSessions: Number.NaN,
      previousWeekTotalMinutes: 120,
      muscleGroups: [
        { muscleGroup: 'CORE', sessionsThisWeek: 4, inActivePlan: true, trainedYesterday: true, lastTrainedOn: '2026-09-26', consecutiveSessions: 8, exerciseNames: ['Plank'] },
        { muscleGroup: 'UNKNOWN_CODE', sessionsThisWeek: 1, inActivePlan: true, trainedYesterday: false, lastTrainedOn: null, consecutiveSessions: 0, exerciseNames: [] },
        { muscleGroup: 'CARDIO', sessionsThisWeek: null, inActivePlan: false, trainedYesterday: true, lastTrainedOn: undefined, consecutiveSessions: undefined, exerciseNames: undefined }
      ],
      volume: null
    });

    expect(result?.completedSessions).toBe(0);
    expect(result?.totalMinutes).toBe(0);
    expect(result?.previousWeekCompletedSessions).toBe(0);
    expect(result?.previousWeekTotalMinutes).toBe(120);
    expect(result?.muscleGroups.length).toBe(2);
    expect(result?.muscleGroups.map((group) => group.muscleGroup)).toEqual(['CORE', 'CARDIO']);
    expect(result?.muscleGroups[1].sessionsThisWeek).toBe(0);
    expect(result?.muscleGroups[1].lastTrainedOn).toBeNull();
    expect(result?.muscleGroups[1].exerciseNames).toEqual([]);
    expect(result?.volume.thisWeekKg).toBe(0);
    expect(result?.volume.previousWeekKg).toBe(0);
  });

  it('lets a weekly training insight request error propagate to the caller', () => {
    let error: unknown;
    service.getWeeklyTrainingInsight().subscribe({
      next: () => fail('expected an error, not a value'),
      error: (err) => (error = err)
    });

    httpTesting
      .expectOne((req) => req.url === '/api/v1/workouts/insights/weekly')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    expect(error).toBeTruthy();
  });

  describe('usualStartTime', () => {
    function insightWith(extra: Record<string, unknown>): WeeklyTrainingInsight | undefined {
      let result: WeeklyTrainingInsight | undefined;
      service.getWeeklyTrainingInsight().subscribe((value) => (result = value));
      httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
        timezone: 'Asia/Singapore',
        muscleGroups: [],
        volume: {},
        ...extra
      });
      return result;
    }

    it('maps a time sent as HH:mm', () => {
      expect(insightWith({ usualStartTime: '18:30' })?.usualStartTime).toBe('18:30');
      expect(insightWith({ usualStartTime: '06:05' })?.usualStartTime).toBe('06:05');
    });

    it('is null when absent or null', () => {
      expect(insightWith({})?.usualStartTime).toBeNull();
      expect(insightWith({ usualStartTime: null })?.usualStartTime).toBeNull();
    });

    it('is null when malformed', () => {
      for (const bad of ['18:30:00', '6:30', '24:00', '18:61', 'evening', '', 1830, {}, ['18:30']]) {
        expect(insightWith({ usualStartTime: bad })?.usualStartTime).withContext(JSON.stringify(bad)).toBeNull();
      }
    });
  });

  describe('last week up to the same weekday', () => {
    function insightWith(extra: Record<string, unknown>): WeeklyTrainingInsight | undefined {
      let result: WeeklyTrainingInsight | undefined;
      service.getWeeklyTrainingInsight().subscribe((value) => (result = value));
      httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({ muscleGroups: [], volume: {}, ...extra });
      return result;
    }

    it('maps the same-day figures of the volume and the week', () => {
      const result = insightWith({
        volume: { previousWeekSameDaysKg: 1900, previousWeekSameDaysSessionsWithVolume: 1 },
        previousWeekSameDaysCompletedSessions: 2,
        previousWeekSameDaysTotalMinutes: 80
      });
      expect(result?.volume.previousWeekSameDaysKg).toBe(1900);
      expect(result?.volume.previousWeekSameDaysSessionsWithVolume).toBe(1);
      expect(result?.previousWeekSameDaysCompletedSessions).toBe(2);
      expect(result?.previousWeekSameDaysTotalMinutes).toBe(80);
    });

    it('turns missing or malformed figures into zero', () => {
      const result = insightWith({ volume: { previousWeekSameDaysKg: 'x' } });
      expect(result?.volume.previousWeekSameDaysKg).toBe(0);
      expect(result?.previousWeekSameDaysTotalMinutes).toBe(0);
    });
  });

  describe('normalizeFocusAreas', () => {
    it('keeps the names onboarding uses, once each', () => {
      expect(normalizeFocusAreas(['UPPER', 'CORE', 'UPPER'])).toEqual(['UPPER', 'CORE']);
    });

    it('reads the numeric codes and lower-case names', () => {
      expect(normalizeFocusAreas(['240002', '240004', 'cardio'])).toEqual(['UPPER', 'LOWER', 'CARDIO']);
    });

    it('drops what is not a name and treats a non-list as empty', () => {
      expect(normalizeFocusAreas(['UPPER', null, 7, ' '])).toEqual(['UPPER']);
      expect(normalizeFocusAreas(null)).toEqual([]);
      expect(normalizeFocusAreas('UPPER')).toEqual([]);
    });
  });

  it('leaves days, today and nextTraining null when the response has none of the day-kinds fields', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight().subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 }
    });

    expect(result?.days).toBeNull();
    expect(result?.today).toBeNull();
    expect(result?.nextTraining).toBeNull();
  });

  it('maps a full set of day-kinds fields, including a session, a planned day, and today\'s carried-over day', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight().subscribe((value) => (result = value));

    const oneDay = (date: string, overrides: Record<string, unknown> = {}) => ({
      date,
      dayOfWeek: 1,
      kind: 'STRENGTH',
      label: 'Strength',
      source: 'DONE',
      minutes: 50,
      sessions: [
        { sessionId: 's1', kind: 'STRENGTH', label: 'Strength', sportActivity: null, status: 'COMPLETED', minutes: 50, distanceKm: null, planDayId: 'pd-1' }
      ],
      planned: { planDayId: 'pd-1', kind: 'STRENGTH', title: 'Full body', sportActivity: null, estimatedMinutes: 50, moves: 4, fulfilled: true },
      ...overrides
    });

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
      days: [
        oneDay('2026-09-21'),
        oneDay('2026-09-22'),
        oneDay('2026-09-23'),
        oneDay('2026-09-24'),
        oneDay('2026-09-25'),
        oneDay('2026-09-26'),
        oneDay('2026-09-27', { kind: 'REST', label: 'Rest', source: 'PLAN', minutes: null, sessions: [], planned: null })
      ],
      today: {
        date: '2026-09-27',
        kind: 'REST',
        label: 'Rest',
        source: 'PLAN',
        planDayId: null,
        title: null,
        estimatedMinutes: null,
        moves: null,
        lastOfKind: null,
        carriedOver: [{ planDayId: 'pd-9', dayOfWeek: 1, kind: 'STRENGTH', title: 'Full body', estimatedMinutes: 50 }]
      },
      nextTraining: { date: '2026-10-01', kind: 'CARDIO', label: 'Cardio', title: 'Treadmill run', estimatedMinutes: 35 }
    });

    expect(result?.days?.length).toBe(7);
    expect(result?.days?.[0].sessions[0].sessionId).toBe('s1');
    expect(result?.days?.[0].planned?.fulfilled).toBe(true);
    expect(result?.today?.kind).toBe('REST');
    expect(result?.today?.carriedOver.length).toBe(1);
    expect(result?.today?.carriedOver[0].title).toBe('Full body');
    expect(result?.nextTraining?.title).toBe('Treadmill run');
  });

  it('maps the session and exercises behind the last session of the kind, defensively', () => {
    const insight = (lastOfKind: unknown) => {
      let result: WeeklyTrainingInsight | undefined;
      service.getWeeklyTrainingInsight().subscribe((value) => (result = value));
      httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
        timezone: 'Asia/Singapore',
        referenceDate: '2026-09-27',
        weekStart: '2026-09-21',
        weekEnd: '2026-09-27',
        today: { date: '2026-09-27', kind: 'CARDIO', label: 'Cardio', source: 'HABIT', planDayId: null, lastOfKind, carriedOver: [] }
      });
      return result?.today?.lastOfKind;
    };

    expect(insight({ date: '2026-09-24', minutes: 35, sessionId: 's-1', exerciseNames: ['Run', 7, '', 'Stretch'] })).toEqual(
      jasmine.objectContaining({ sessionId: 's-1', exerciseNames: ['Run', 'Stretch'] })
    );
    expect(insight({ date: '2026-09-24', minutes: 35 })).toEqual(jasmine.objectContaining({ sessionId: null, exerciseNames: [] }));
    expect(insight({ date: '2026-09-24', sessionId: null, exerciseNames: null })).toEqual(
      jasmine.objectContaining({ sessionId: null, exerciseNames: [] })
    );
    expect(insight({ date: '2026-09-24', exerciseNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })?.exerciseNames?.length).toBe(6);
  });

  it('drops a malformed days array (not exactly seven entries) to null', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight().subscribe((value) => (result = value));

    const shortDay = { date: '2026-09-21', dayOfWeek: 1, kind: 'STRENGTH', label: 'Strength', source: 'DONE', minutes: 50, sessions: [], planned: null };

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
      days: [shortDay, shortDay, shortDay, shortDay, shortDay, shortDay]
    });

    expect(result?.days).toBeNull();
  });

  it('falls back an unrecognised day kind to OPEN and an unrecognised source to NONE', () => {
    let result: WeeklyTrainingInsight | undefined;
    service.getWeeklyTrainingInsight().subscribe((value) => (result = value));

    const day = (overrides: Record<string, unknown>) => ({
      date: '2026-09-21',
      dayOfWeek: 1,
      kind: 'STRENGTH',
      label: 'Strength',
      source: 'DONE',
      minutes: 50,
      sessions: [],
      planned: null,
      ...overrides
    });

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/weekly').flush({
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
      days: [
        day({ date: '2026-09-21', kind: 'HIIT', source: 'DONE' }),
        day({ date: '2026-09-22', source: 'SOMETHING_NEW' }),
        day({ date: '2026-09-23' }),
        day({ date: '2026-09-24' }),
        day({ date: '2026-09-25' }),
        day({ date: '2026-09-26' }),
        day({ date: '2026-09-27' })
      ]
    });

    expect(result?.days?.[0].kind).toBe('OPEN');
    expect(result?.days?.[1].source).toBe('NONE');
  });

  it('starts a workout plan with the given plan day id as a query param', () => {
    service.startWorkoutPlan('plan-1', { planDayId: 'pd-2' }).subscribe();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/plans/plan-1/start' &&
        req.params.get('planDayId') === 'pd-2' &&
        !req.params.has('timezone')
    );
    expect(request.request.method).toBe('POST');
    request.flush({
      sessionId: 'session-1',
      planId: 'plan-1',
      name: 'Plan',
      workoutType: 'STRENGTH',
      status: 'IN_PROGRESS',
      startedAt: '2026-06-20T02:00:00Z',
      exerciseCount: 1,
      exercises: []
    });
  });

  it('lists exercises from the paginated catalog endpoint', () => {
    let result: Exercise[] | undefined;
    service.getExercises('squat').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/exercises' && req.params.get('q') === 'squat'
    );
    request.flush({
      content: [
        { exerciseId: 'e1', name: 'Back squat', primaryMuscleGroup: 'QUADS', equipment: 'BARBELL', difficulty: 'INTERMEDIATE', custom: false }
      ]
    });

    expect(result?.[0].name).toBe('Back squat');
    expect(result?.[0].exerciseId).toBe('e1');
  });

  it('filters exercises with metadata-driven query params', () => {
    service
      .getExercises({
        q: 'press',
        exerciseType: 'STRENGTH',
        primaryMuscleGroup: 'CHEST',
        equipment: 'BARBELL',
        difficulty: 'INTERMEDIATE',
        page: 1,
        size: 50
      })
      .subscribe();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/exercises' &&
        req.params.get('q') === 'press' &&
        req.params.get('exerciseType') === 'STRENGTH' &&
        req.params.get('primaryMuscleGroup') === 'CHEST' &&
        req.params.get('equipment') === 'BARBELL' &&
        req.params.get('difficulty') === 'INTERMEDIATE' &&
        req.params.get('page') === '1' &&
        req.params.get('size') === '50'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [] });
  });

  it('loads one exercise detail with media, instructions, and secondary muscles', () => {
    let result: ExerciseDetail | null | undefined;
    service.getExercise('exercise-1').subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1');
    expect(request.request.method).toBe('GET');
    request.flush({
      exerciseId: 'exercise-1',
      code: 'BACK_SQUAT',
      name: 'Back squat',
      description: 'Lower body compound lift',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      status: 'ACTIVE',
      custom: false,
      videoUrl: 'https://example.test/squat.mp4',
      animationUrl: 'https://example.test/squat.gif',
      images: [
        { position: 2, url: 'https://example.test/squat-2.jpg' },
        { position: 1, url: 'https://example.test/squat-1.jpg' }
      ],
      instructions: [
        { stepNumber: 2, text: 'Stand tall.' },
        { stepNumber: 1, text: 'Brace your core.' }
      ],
      secondaryMuscleGroups: ['GLUTES', 'HAMSTRINGS']
    });

    expect(result?.images.map((image) => image.url)).toEqual([
      'https://example.test/squat-1.jpg',
      'https://example.test/squat-2.jpg'
    ]);
    expect(result?.imageUrls).toEqual(['https://example.test/squat-1.jpg', 'https://example.test/squat-2.jpg']);
    expect(result?.instructions.map((step) => step.text)).toEqual(['Brace your core.', 'Stand tall.']);
    expect(result?.secondaryMuscleGroups).toEqual(['GLUTES', 'HAMSTRINGS']);
    expect(result?.shortSteps).toEqual([]);
  });

  it('maps the short steps of an exercise defensively', () => {
    let result: ExerciseDetail | null | undefined;
    service.getExercise('exercise-1').subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1').flush({
      exerciseId: 'exercise-1',
      name: 'Back squat',
      shortSteps: ['Brace your core.', '  ', 7, 'Stand tall.']
    });

    expect(result?.shortSteps).toEqual(['Brace your core.', 'Stand tall.']);
  });

  it('loads a paged exercise search with Spring Page metadata', () => {
    let result: unknown;
    service
      .searchExercisesPage({
        q: 'press',
        page: 2,
        size: 24
      })
      .subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/exercises' &&
        req.params.get('q') === 'press' &&
        req.params.get('page') === '2' &&
        req.params.get('size') === '24'
    );
    request.flush({
      content: [{ exerciseId: 'e1', name: 'Bench press', primaryMuscleGroup: 'CHEST', equipment: 'BARBELL' }],
      number: 2,
      size: 24,
      totalPages: 4,
      totalElements: 85,
      first: false,
      last: false
    });

    expect(result).toEqual(
      jasmine.objectContaining({
        page: 2,
        size: 24,
        totalPages: 4,
        totalElements: 85,
        items: [jasmine.objectContaining({ exerciseId: 'e1', name: 'Bench press' })]
      })
    );
  });

  it('loads exercise metadata for filters and forms', () => {
    let result: unknown;
    service.getExerciseMetadata().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/exercises/metadata');
    expect(request.request.method).toBe('GET');
    request.flush({
      exerciseTypes: ['STRENGTH'],
      muscleGroups: ['QUADS'],
      equipment: ['BARBELL'],
      difficulties: ['INTERMEDIATE'],
      workoutTypes: ['STRENGTH'],
      goalFocuses: ['STRENGTH']
    });

    expect(result).toEqual(
      jasmine.objectContaining({
        exerciseTypes: ['STRENGTH'],
        muscleGroups: ['QUADS'],
        equipment: ['BARBELL'],
        difficulties: ['INTERMEDIATE']
      })
    );
  });

  it('creates, updates, and archives custom exercises through workout exercise endpoints', () => {
    const createPayload = {
      code: 'CUSTOM_BACK_SQUAT',
      name: 'Back Squat',
      description: 'Barbell back squat',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      videoUrl: 'https://www.youtube.com/watch?v=abc123def45'
    };
    const updatePayload = {
      name: 'Back Squat',
      description: 'Updated',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'ADVANCED',
      videoUrl: 'https://vimeo.com/123456789'
    };

    service.createExercise(createPayload).subscribe();
    const createRequest = httpTesting.expectOne('/api/v1/workouts/exercises');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(createPayload);
    createRequest.flush({ exerciseId: 'exercise-1', ...createPayload, status: 'ACTIVE', custom: true });

    service.updateExercise('exercise-1', updatePayload).subscribe();
    const updateRequest = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(updatePayload);
    updateRequest.flush({ exerciseId: 'exercise-1', code: 'CUSTOM_BACK_SQUAT', ...updatePayload, status: 'ACTIVE', custom: true });

    service.archiveExercise('exercise-1').subscribe();
    const archiveRequest = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1');
    expect(archiveRequest.request.method).toBe('DELETE');
    archiveRequest.flush(null);
  });

  it('uploads an exercise video as multipart form data and preserves progress events', () => {
    const file = new Blob(['video'], { type: 'video/mp4' });
    const events: unknown[] = [];

    service.uploadExerciseVideo('exercise-1', file).subscribe((event) => events.push(event));

    const request = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1/video');
    expect(request.request.method).toBe('POST');
    expect(request.request.reportProgress).toBeTrue();
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    expect(request.request.body instanceof FormData).toBeTrue();
    const uploaded = (request.request.body as FormData).get('file') as File;
    expect(uploaded.type).toBe('video/mp4');
    expect(uploaded.size).toBe(file.size);

    request.event({ type: HttpEventType.UploadProgress, loaded: 15, total: 30 });
    request.flush({
      exerciseId: 'exercise-1',
      code: 'CUSTOM_BACK_SQUAT',
      name: 'Back Squat',
      description: 'Barbell back squat',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      status: 'ACTIVE',
      custom: true,
      videoUrl: 'https://media.example.test/exercise.mp4'
    });

    expect(events).toContain(jasmine.objectContaining({ type: HttpEventType.Sent }));
    expect(events).toContain(jasmine.objectContaining({ type: HttpEventType.UploadProgress, loaded: 15, total: 30 }));
    expect(events).toContain(
      jasmine.objectContaining({
        type: HttpEventType.Response,
        body: jasmine.objectContaining({
          exerciseId: 'exercise-1',
          videoUrl: 'https://media.example.test/exercise.mp4'
        })
      })
    );
  });

  it('uploads an exercise image as multipart form data and maps the exercise response', () => {
    const file = new Blob(['image'], { type: 'image/webp' });
    const events: unknown[] = [];

    service.uploadExerciseImage('exercise-1', file).subscribe((event) => events.push(event));

    const request = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1/image');
    expect(request.request.method).toBe('POST');
    expect(request.request.reportProgress).toBeTrue();
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    expect(request.request.body instanceof FormData).toBeTrue();
    const uploaded = (request.request.body as FormData).get('file') as File;
    expect(uploaded.type).toBe('image/webp');
    expect(uploaded.size).toBe(file.size);

    request.event({ type: HttpEventType.UploadProgress, loaded: 4, total: 8 });
    request.flush({
      exerciseId: 'exercise-1',
      code: 'CUSTOM_BACK_SQUAT',
      name: 'Back Squat',
      description: 'Barbell back squat',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      status: 'ACTIVE',
      custom: true,
      images: [{ position: 0, url: 'https://media.example.test/exercise.webp' }]
    });

    expect(events).toContain(jasmine.objectContaining({ type: HttpEventType.Sent }));
    expect(events).toContain(jasmine.objectContaining({ type: HttpEventType.UploadProgress, loaded: 4, total: 8 }));
    expect(events).toContain(
      jasmine.objectContaining({
        type: HttpEventType.Response,
        body: jasmine.objectContaining({
          exerciseId: 'exercise-1',
          imageUrls: ['https://media.example.test/exercise.webp']
        })
      })
    );
  });

  it('loads exercise records and preserves null personal records', () => {
    let result: ExerciseRecords | null | undefined;
    service.getExerciseRecords('exercise-1').subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1/records');
    expect(request.request.method).toBe('GET');
    request.flush({
      exerciseId: 'exercise-1',
      exerciseName: 'Back squat',
      maxWeightKg: { value: '125.5', sessionId: 'session-1', achievedAt: '2026-06-12T11:05:00Z' },
      maxReps: null,
      maxSingleSetVolumeKg: null,
      estimatedOneRepMaxKg: { value: 145.8, sessionId: 'session-1', achievedAt: '2026-06-12T11:05:00Z' },
      bestSessionVolumeKg: null
    });

    expect(result?.exerciseName).toBe('Back squat');
    expect(result?.maxWeightKg?.value).toBe(125.5);
    expect(result?.maxReps).toBeNull();
  });

  it('returns null when exercise records fail', () => {
    let result: unknown = 'pending';
    service.getExerciseRecords('exercise-1').subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/workouts/exercises/exercise-1/records').flush('nope', {
      status: 500,
      statusText: 'Server Error'
    });

    expect(result).toBeNull();
  });

  it('loads exercise history with default pagination and unwraps page content', () => {
    let result: unknown[] | undefined;
    service.getExerciseHistory('exercise-1').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/exercises/exercise-1/history' &&
        req.params.get('page') === '0' &&
        req.params.get('size') === '20' &&
        !req.params.has('from') &&
        !req.params.has('to')
    );
    request.flush({
      content: [
        {
          sessionId: 'session-1',
          exerciseLogId: 'log-1',
          setLogId: 'set-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Back squat',
          sessionName: 'Lower body',
          completedAt: '2026-06-12T11:05:00Z',
          setNumber: 2,
          reps: 5,
          weightKg: '100.5',
          distanceKm: null
        }
      ],
      page: 0,
      size: 20,
      totalElements: 1
    });

    expect(result?.[0]).toEqual(
      jasmine.objectContaining({
        sessionId: 'session-1',
        weightKg: 100.5,
        reps: 5
      })
    );
  });

  it('loads a workout session detail and maps nested exercises', () => {
    let result: WorkoutSessionDetail | null | undefined;
    service.getSession('session-1').subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/sessions/session-1');
    expect(request.request.method).toBe('GET');
    request.flush({
      sessionId: 'session-1',
      name: 'Push day',
      workoutType: 'STRENGTH',
      status: 'COMPLETED',
      source: 'MANUAL',
      startedAt: '2026-06-20T10:00:00Z',
      completedAt: '2026-06-20T11:00:00Z',
      durationMinutes: 60,
      caloriesBurned: 420,
      perceivedExertion: 8,
      notes: 'Solid work',
      exercises: [
        {
          exerciseLogId: 'log-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Bench press',
          sequence: 1,
          performedSets: 1,
          performedReps: 5,
          totalVolumeKg: '500.5',
          sets: [
            {
              setLogId: 'set-1',
              setNumber: 1,
              reps: 5,
              weightKg: '100.1',
              restSeconds: 180,
              logged: true,
              notes: 'Top set'
            }
          ]
        }
      ]
    });

    expect(result?.sessionId).toBe('session-1');
    expect(result?.exercises[0].totalVolumeKg).toBe(500.5);
    expect(result?.exercises[0].sets[0].weightKg).toBe(100.1);
  });

  it('returns null when workout session detail fails', () => {
    let result: unknown = 'pending';
    service.getSession('session-1').subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/workouts/sessions/session-1').flush('nope', {
      status: 500,
      statusText: 'Server Error'
    });

    expect(result).toBeNull();
  });

  it('updates, deletes, and repeats workout sessions through session endpoints', () => {
    const payload: UpsertWorkoutSessionRequest = {
      planId: null,
      name: 'Push day',
      workoutType: 'STRENGTH',
      status: 'COMPLETED',
      source: 'MANUAL',
      startedAt: '2026-06-20T10:00:00Z',
      completedAt: '2026-06-20T11:00:00Z',
      durationMinutes: 60,
      caloriesBurned: 420,
      perceivedExertion: 8,
      notes: 'Updated',
      exercises: []
    };

    service.updateSession('session-1', payload).subscribe();
    const updateRequest = httpTesting.expectOne('/api/v1/workouts/sessions/session-1');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(payload);
    updateRequest.flush({ sessionId: 'session-1', ...payload, exerciseCount: 0 });

    service.deleteSession('session-1').subscribe();
    const deleteRequest = httpTesting.expectOne('/api/v1/workouts/sessions/session-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);

    service.repeatSession('session-1').subscribe();
    const repeatRequest = httpTesting.expectOne('/api/v1/workouts/sessions/session-1/repeat');
    expect(repeatRequest.request.method).toBe('POST');
    repeatRequest.flush({ sessionId: 'session-2', name: 'Push day', workoutType: 'STRENGTH', status: 'IN_PROGRESS' });

    service.repeatLatestSession().subscribe();
    const repeatLatestRequest = httpTesting.expectOne('/api/v1/workouts/sessions/repeat-latest');
    expect(repeatLatestRequest.request.method).toBe('POST');
    repeatLatestRequest.flush({ sessionId: 'session-3', name: 'Latest repeat', workoutType: 'STRENGTH', status: 'IN_PROGRESS' });
  });

  it('exports workout data from the workout export endpoint', () => {
    let result: WorkoutExport | undefined;
    service.exportWorkoutData().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/export');
    expect(request.request.method).toBe('GET');
    request.flush({
      schemaVersion: 1,
      exportedAt: '2026-06-20T10:00:00Z',
      exercises: [],
      plans: [],
      sessions: []
    });

    expect(result?.schemaVersion).toBe(1);
    expect(result?.sessions).toEqual([]);
  });

  it('imports workout sessions through the batch import endpoint', () => {
    const response: ImportResult = {
      imported: 1,
      skippedDuplicate: 1,
      rejected: 1,
      results: [
        { rowIndex: 0, externalId: 'ext-1', source: 'IMPORTED', status: 'IMPORTED', sessionId: 'session-1', reason: null },
        { rowIndex: 1, externalId: 'ext-2', source: 'IMPORTED', status: 'SKIPPED_DUPLICATE', sessionId: null, reason: 'Duplicate' },
        { rowIndex: 2, externalId: 'ext-3', source: 'IMPORTED', status: 'REJECTED', sessionId: null, reason: 'Invalid row' }
      ]
    };
    const row = {
      externalId: 'ext-1',
      source: 'IMPORTED',
      planId: null,
      name: 'Morning run',
      workoutType: 'CARDIO',
      status: 'COMPLETED',
      startedAt: '2026-06-20T10:00:00Z',
      completedAt: '2026-06-20T10:32:00Z',
      durationMinutes: 32,
      caloriesBurned: 300,
      perceivedExertion: 6,
      notes: 'Imported',
      exercises: []
    };

    let result: ImportResult | undefined;
    service.importSessions([row]).subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/workouts/sessions/import');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ sessions: [row] });
    request.flush(response);

    expect(result?.imported).toBe(1);
    expect(result?.results[1].status).toBe('SKIPPED_DUPLICATE');
  });

  it('lists workout plans with a status filter and maps exercise blueprints', () => {
    let result: WorkoutPlan[] | undefined;
    service.getWorkoutPlans('DRAFT').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/plans' &&
        req.params.get('status') === 'DRAFT' &&
        req.params.get('size') === '20'
    );
    request.flush({
      content: [
        {
          planId: 'plan-1',
          name: 'Strength base',
          description: 'Foundation plan',
          goalFocus: 'STRENGTH',
          workoutType: 'STRENGTH',
          difficulty: 'INTERMEDIATE',
          estimatedDurationMinutes: 50,
          status: 'DRAFT',
          exercises: [
            {
              planExerciseId: 'plan-ex-1',
              exerciseId: 'exercise-1',
              exerciseNameSnapshot: 'Back squat',
              sequence: 1,
              targetSets: 3,
              targetReps: 8,
              targetWeightKg: '60.5',
              restSeconds: 120,
              setTargets: []
            }
          ]
        }
      ]
    });

    expect(result?.[0].planId).toBe('plan-1');
    expect(result?.[0].exerciseCount).toBe(1);
    expect(result?.[0].exercises[0].targetWeightKg).toBe(60.5);
  });

  it('creates and updates workout plans through the plan endpoints', () => {
    const payload = {
      name: 'Plan',
      description: '',
      goalFocus: 'STRENGTH',
      workoutType: 'STRENGTH',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 45,
      exercises: [
        {
          exerciseId: 'exercise-1',
          sequence: 1,
          targetSets: 3,
          targetReps: 8,
          targetWeightKg: null,
          targetDurationSeconds: null,
          targetDistanceKm: null,
          restSeconds: 90,
          notes: '',
          setTargets: []
        }
      ]
    };

    service.createWorkoutPlan(payload).subscribe();
    const createRequest = httpTesting.expectOne('/api/v1/workouts/plans');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(payload);
    createRequest.flush({ planId: 'plan-1', name: 'Plan', exercises: [] });

    service.updateWorkoutPlan('plan-1', payload).subscribe();
    const updateRequest = httpTesting.expectOne('/api/v1/workouts/plans/plan-1');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(payload);
    updateRequest.flush({ planId: 'plan-1', name: 'Plan', exercises: [] });
  });

  it('maps the days of a plan, its sessions a week, and defaults both for a plan without a week', () => {
    let result: WorkoutPlan[] | undefined;
    service.getWorkoutPlans('ACTIVE').subscribe((value) => (result = value));

    httpTesting
      .expectOne((req) => req.url === '/api/v1/workouts/plans')
      .flush({
        content: [
          {
            planId: 'week',
            name: 'Recomp',
            sessionsPerWeek: 3,
            exercises: [],
            days: [
              {
                planDayId: 'day-1',
                dayOfWeek: 1,
                kind: 'STRENGTH',
                title: 'Full body',
                sportActivity: null,
                sportLabel: null,
                estimatedDurationMinutes: 50,
                exercises: [{ exerciseId: 'exercise-1', exerciseNameSnapshot: 'Back squat', sequence: 1, targetWeightKg: '60.5', setTargets: [] }]
              },
              {
                planDayId: 'day-6',
                dayOfWeek: 6,
                kind: 'SPORT',
                title: 'Badminton',
                sportActivity: 'BADMINTON',
                sportLabel: 'Badminton',
                estimatedDurationMinutes: 60,
                exercises: []
              },
              { planDayId: 'day-7', dayOfWeek: 7, kind: 'UNKNOWN', title: null }
            ]
          },
          { planId: 'flat', name: 'Flat', exercises: [] }
        ]
      });

    const week = result?.[0];
    expect(week?.sessionsPerWeek).toBe(3);
    expect(week?.days?.length).toBe(3);
    expect(week?.days?.[0]).toEqual(
      jasmine.objectContaining({
        planDayId: 'day-1',
        dayOfWeek: 1,
        kind: 'STRENGTH',
        title: 'Full body',
        sportActivity: null,
        estimatedDurationMinutes: 50
      })
    );
    expect(week?.days?.[0].exercises[0].targetWeightKg).toBe(60.5);
    expect(week?.days?.[1]).toEqual(
      jasmine.objectContaining({ kind: 'SPORT', sportActivity: 'BADMINTON', sportLabel: 'Badminton', exercises: [] })
    );
    expect(week?.days?.[2]).toEqual(jasmine.objectContaining({ kind: 'STRENGTH', title: '', estimatedDurationMinutes: null }));
    expect(result?.[1].days).toEqual([]);
    expect(result?.[1].sessionsPerWeek).toBeNull();
  });

  it('sends the days of a plan as they are and refuses nothing itself', () => {
    const payload = {
      name: 'Week',
      description: '',
      goalFocus: 'STRENGTH',
      workoutType: 'STRENGTH',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 45,
      exercises: [],
      days: [
        { planDayId: 'day-1', dayOfWeek: 1, kind: 'STRENGTH' as const, title: 'Push', sportActivity: null, estimatedDurationMinutes: 40, exercises: [] },
        { dayOfWeek: 6, kind: 'SPORT' as const, title: 'Tennis', sportActivity: 'TENNIS', estimatedDurationMinutes: null, exercises: [] }
      ]
    };

    service.createWorkoutPlan(payload).subscribe();
    const createRequest = httpTesting.expectOne('/api/v1/workouts/plans');
    expect(createRequest.request.body).toEqual(payload);
    createRequest.flush({ planId: 'plan-1', name: 'Week', exercises: [], sessionsPerWeek: 2, days: [] });

    service.updateWorkoutPlan('plan-1', payload).subscribe();
    const updateRequest = httpTesting.expectOne('/api/v1/workouts/plans/plan-1');
    expect(updateRequest.request.body).toEqual(payload);
    updateRequest.flush({ planId: 'plan-1', name: 'Week', exercises: [] });
  });

  it('maps the sport activities of the exercise metadata and defaults them to none', () => {
    let result: ExerciseMetadata | null | undefined;
    service.getExerciseMetadata().subscribe((value) => (result = value));
    httpTesting.expectOne('/api/v1/workouts/exercises/metadata').flush({
      exerciseTypes: [],
      sportActivities: [{ code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' }]
    });
    expect(result?.sportActivities).toEqual([{ code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' }]);

    service.getExerciseMetadata().subscribe((value) => (result = value));
    httpTesting.expectOne('/api/v1/workouts/exercises/metadata').flush({ exerciseTypes: [] });
    expect(result?.sportActivities).toEqual([]);
  });

  it('activates, archives, and starts a workout plan', () => {
    let started: WorkoutSessionDetail | undefined;

    service.activateWorkoutPlan('plan-1').subscribe();
    const activateRequest = httpTesting.expectOne('/api/v1/workouts/plans/plan-1/activate');
    expect(activateRequest.request.method).toBe('POST');
    activateRequest.flush({ planId: 'plan-1', name: 'Plan', status: 'ACTIVE', exercises: [] });

    service.archiveWorkoutPlan('plan-1').subscribe();
    const archiveRequest = httpTesting.expectOne('/api/v1/workouts/plans/plan-1');
    expect(archiveRequest.request.method).toBe('DELETE');
    archiveRequest.flush(null);

    service.startWorkoutPlan('plan-1').subscribe((session) => (started = session));
    const startRequest = httpTesting.expectOne('/api/v1/workouts/plans/plan-1/start');
    expect(startRequest.request.method).toBe('POST');
    startRequest.flush({
      sessionId: 'session-1',
      planId: 'plan-1',
      name: 'Plan',
      workoutType: 'STRENGTH',
      status: 'IN_PROGRESS',
      startedAt: '2026-06-20T02:00:00Z',
      exerciseCount: 1,
      exercises: []
    });

    expect(started?.sessionId).toBe('session-1');
    expect(started?.status).toBe('IN_PROGRESS');
  });

  it('starts an ad hoc in-progress session without completedAt', () => {
    let started: WorkoutSessionDetail | undefined;
    service.startAdHocSession({ name: 'Live upper', workoutType: 'STRENGTH', notes: 'Warm up well' }).subscribe((session) => {
      started = session;
    });

    const request = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.name).toBe('Live upper');
    expect(request.request.body.status).toBe('IN_PROGRESS');
    expect(request.request.body.completedAt).toBeUndefined();
    expect(request.request.body.exercises).toEqual([]);
    request.flush({
      sessionId: 'session-live',
      name: 'Live upper',
      workoutType: 'STRENGTH',
      status: 'IN_PROGRESS',
      startedAt: '2026-06-20T02:00:00Z',
      exercises: []
    });

    expect(started?.sessionId).toBe('session-live');
    expect(started?.exercises).toEqual([]);
  });

  it('sends the sport of an ad hoc sport session, and nothing for other types', () => {
    service.startAdHocSession({ name: 'Badminton', workoutType: 'SPORTS', sportActivity: 'BADMINTON' }).subscribe();
    const sport = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect(sport.request.body.sportActivity).toBe('BADMINTON');
    sport.flush({ sessionId: 's', name: 'Badminton', workoutType: 'SPORTS', status: 'IN_PROGRESS', startedAt: '2026-06-20T02:00:00Z', exercises: [] });

    service.startAdHocSession({ name: 'Cardio', workoutType: 'CARDIO' }).subscribe();
    const plain = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect('sportActivity' in plain.request.body).toBeFalse();
    plain.flush({ sessionId: 's2', name: 'Cardio', workoutType: 'CARDIO', status: 'IN_PROGRESS', startedAt: '2026-06-20T02:00:00Z', exercises: [] });
  });

  it('starts a timer session with its segments as SEGMENT entries, and with none by default', () => {
    service
      .startAdHocSession({ name: 'Run', workoutType: 'CARDIO', segments: [{ kind: 'STEADY', label: 'Steady', plannedSeconds: 1200 }] })
      .subscribe();
    const timed = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect(timed.request.body.entries).toEqual([
      { entryType: 'SEGMENT', kind: 'STEADY', label: 'Steady', plannedSeconds: 1200, position: 1 }
    ]);
    timed.flush({ sessionId: 's', name: 'Run', workoutType: 'CARDIO', status: 'IN_PROGRESS', startedAt: '2026-06-20T02:00:00Z', exercises: [] });

    service.startAdHocSession({ name: 'Run', workoutType: 'CARDIO' }).subscribe();
    const plain = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect('entries' in plain.request.body).toBeFalse();
    plain.flush({ sessionId: 's2', name: 'Run', workoutType: 'CARDIO', status: 'IN_PROGRESS', startedAt: '2026-06-20T02:00:00Z', exercises: [] });
  });

  it('maps the SEGMENT entries of a session defensively and leaves SET entries out', () => {
    let session: WorkoutSessionDetail | undefined;
    service.getSession('s').subscribe((value) => (session = value ?? undefined));
    httpTesting.expectOne('/api/v1/workouts/sessions/s').flush({
      sessionId: 's', name: 'Run', workoutType: 'CARDIO', status: 'COMPLETED', startedAt: '2026-06-20T02:00:00Z', exercises: [],
      entries: [
        { id: 'b', entryType: 'SEGMENT', position: 2, kind: 'COOLDOWN', plannedSeconds: '300', actualSeconds: 180, status: 'SKIPPED' },
        { entryId: 'a', entryType: 'SEGMENT', position: 1, kind: 'MYSTERY', label: ' ', plannedSeconds: 600, status: 'later' },
        { entryId: 'x', entryType: 'SET', position: 3, plannedSeconds: 10 },
        { entryId: 'z', entryType: 'SEGMENT', position: 4, kind: 'WORK' }
      ]
    });
    expect(session?.segments?.map((segment) => [segment.entryId, segment.position, segment.kind, segment.label, segment.plannedSeconds, segment.status]))
      .toEqual([['a', 1, 'STEADY', 'Steady', 600, 'PENDING'], ['b', 2, 'COOLDOWN', 'Cool-down', 300, 'SKIPPED']]);
    expect(session?.segments?.[1].actualSeconds).toBe(180);
  });

  it('puts a segment update on the entry endpoint', () => {
    service.updateSessionSegment('s', 'e1', { actualSeconds: 300, startedAt: '2026-06-20T02:00:00Z', status: 'DONE' }).subscribe();
    const request = httpTesting.expectOne('/api/v1/workouts/sessions/s/entries/e1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ actualSeconds: 300, startedAt: '2026-06-20T02:00:00Z', status: 'DONE' });
    request.flush({ sessionId: 's', name: 'Run', workoutType: 'CARDIO', status: 'IN_PROGRESS', startedAt: '2026-06-20T02:00:00Z', exercises: [] });
  });

  it('sends the name search of the session list, trimmed and capped at 80 characters', () => {
    service.getWorkoutSessionPage({ q: '  push  ', page: 0, size: 8 }).subscribe();
    const named = httpTesting.expectOne((req) => req.url === '/api/v1/workouts/sessions');
    expect(named.request.params.get('q')).toBe('push');
    named.flush({ content: [] });

    service.getWorkoutSessionPage({ q: 'x'.repeat(120) }).subscribe();
    const long = httpTesting.expectOne((req) => req.url === '/api/v1/workouts/sessions');
    expect(long.request.params.get('q')?.length).toBe(80);
    long.flush({ content: [] });

    service.getWorkoutSessionPage({ q: '   ' }).subscribe();
    const blank = httpTesting.expectOne((req) => req.url === '/api/v1/workouts/sessions');
    expect(blank.request.params.has('q')).toBeFalse();
    blank.flush({ content: [] });
  });

  it('adds an exercise to a live session and maps server-derived totals', () => {
    let updated: WorkoutSessionDetail | undefined;
    service
      .addSessionExercise('session-live', {
        exerciseId: 'exercise-1',
        sequence: 1,
        performedSets: null,
        performedReps: null,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: null,
        sets: []
      })
      .subscribe((session) => (updated = session));

    const request = httpTesting.expectOne('/api/v1/workouts/sessions/session-live/exercises');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.exerciseId).toBe('exercise-1');
    expect(request.request.body.sequence).toBe(1);
    request.flush({
      sessionId: 'session-live',
      name: 'Live upper',
      workoutType: 'STRENGTH',
      status: 'IN_PROGRESS',
      startedAt: '2026-06-20T02:00:00Z',
      exercises: [
        {
          exerciseLogId: 'log-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Back squat',
          sequence: 1,
          performedSets: 2,
          performedReps: 15,
          totalVolumeKg: '900',
          sets: []
        }
      ]
    });

    expect(updated?.exercises[0].performedSets).toBe(2);
    expect(updated?.exercises[0].totalVolumeKg).toBe(900);
  });

  it('upserts a live session set through the set-number path', () => {
    service
      .upsertSessionSet('session-live', 'log-1', 3, {
        reps: 8,
        weightKg: 55,
        durationSeconds: null,
        distanceKm: null,
        restSeconds: 120,
        perceivedExertion: 7,
        notes: 'Working set'
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/workouts/sessions/session-live/exercises/log-1/sets/3');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      reps: 8,
      weightKg: 55,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: 120,
      perceivedExertion: 7,
      notes: 'Working set'
    });
    request.flush({
      sessionId: 'session-live',
      name: 'Live upper',
      workoutType: 'STRENGTH',
      status: 'IN_PROGRESS',
      startedAt: '2026-06-20T02:00:00Z',
      exercises: [
        {
          exerciseLogId: 'log-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Back squat',
          sequence: 1,
          sets: [{ setLogId: 'set-3', setNumber: 3, reps: 8, weightKg: '55', logged: true }]
        }
      ]
    });
  });

  it('completes and cancels live sessions through action endpoints', () => {
    service.completeSession('session-live', '2026-06-20T03:00:00Z').subscribe();
    const completeRequest = httpTesting.expectOne('/api/v1/workouts/sessions/session-live/complete');
    expect(completeRequest.request.method).toBe('POST');
    expect(completeRequest.request.body.completedAt).toBe('2026-06-20T03:00:00Z');
    completeRequest.flush({
      sessionId: 'session-live',
      name: 'Live upper',
      workoutType: 'STRENGTH',
      status: 'COMPLETED',
      startedAt: '2026-06-20T02:00:00Z',
      completedAt: '2026-06-20T03:00:00Z',
      exercises: []
    });

    service.cancelSession('session-live').subscribe();
    const cancelRequest = httpTesting.expectOne('/api/v1/workouts/sessions/session-live/cancel');
    expect(cancelRequest.request.method).toBe('POST');
    expect(cancelRequest.request.body).toEqual({});
    cancelRequest.flush({
      sessionId: 'session-live',
      name: 'Live upper',
      workoutType: 'STRENGTH',
      status: 'CANCELLED',
      startedAt: '2026-06-20T02:00:00Z',
      exercises: []
    });
  });

  describe('plan days', () => {
    it('maps the days of a weekly plan with their exercises', () => {
      let result: WorkoutPlan | null | undefined;
      service.getActivePlan().subscribe((value) => (result = value));

      httpTesting.expectOne('/api/v1/workouts/plans/active').flush({
        planId: 'plan-week',
        name: 'Week plan',
        sessionsPerWeek: 2,
        exercises: [],
        days: [
          {
            planDayId: 'day-1',
            dayOfWeek: 1,
            kind: 'STRENGTH',
            title: 'Full body',
            estimatedDurationMinutes: 50,
            exercises: [{ exerciseNameSnapshot: 'Goblet squat', sequence: 1, targetSets: 3, targetReps: 12, targetWeightKg: '18.0' }]
          },
          { planDayId: 'day-4', dayOfWeek: 4, kind: 'SPORT', title: 'Game', sportActivity: 'BADMINTON', sportLabel: 'Badminton' }
        ]
      });

      expect(result?.sessionsPerWeek).toBe(2);
      expect(result?.days?.length).toBe(2);
      expect(result?.days?.[0]).toEqual(
        jasmine.objectContaining({ planDayId: 'day-1', dayOfWeek: 1, kind: 'STRENGTH', title: 'Full body', estimatedDurationMinutes: 50 })
      );
      expect(result?.days?.[0].exercises[0]).toEqual(jasmine.objectContaining({ exerciseNameSnapshot: 'Goblet squat', targetWeightKg: 18 }));
      expect(result?.days?.[1]).toEqual(
        jasmine.objectContaining({ sportActivity: 'BADMINTON', sportLabel: 'Badminton', estimatedDurationMinutes: null, exercises: [] })
      );
    });

    it('gives an empty list of days for a plan from an older backend', () => {
      let result: WorkoutPlan | null | undefined;
      service.getActivePlan().subscribe((value) => (result = value));

      httpTesting.expectOne('/api/v1/workouts/plans/active').flush({ planId: 'plan-old', name: 'Old plan', exercises: [] });

      expect(result?.days).toEqual([]);
      expect(result?.sessionsPerWeek).toBeNull();
    });

    it('drops a day without an id and reads an unknown kind as strength', () => {
      let result: WorkoutPlan | null | undefined;
      service.getActivePlan().subscribe((value) => (result = value));

      httpTesting.expectOne('/api/v1/workouts/plans/active').flush({
        planId: 'plan-odd',
        name: 'Odd plan',
        days: [{ dayOfWeek: 2, kind: 'CARDIO' }, { planDayId: 'day-x', dayOfWeek: 'soon', kind: 'YOGA' }, null]
      });

      expect(result?.days?.length).toBe(1);
      expect(result?.days?.[0]).toEqual(jasmine.objectContaining({ planDayId: 'day-x', dayOfWeek: 0, kind: 'STRENGTH', title: '' }));
    });
  });

  it('returns a null active plan when none is set', () => {
    let result: WorkoutPlan | null | undefined = undefined;
    service.getActivePlan().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/workouts/plans/active').flush({});

    expect(result).toBeNull();
  });

  it('logs a completed workout session via POST /workouts/sessions', () => {
    service
      .saveWorkoutSession({
        name: 'Upper body strength',
        workoutType: 'STRENGTH',
        durationMinutes: 60,
        caloriesBurned: 400,
        perceivedExertion: 8,
        notes: 'Strong session'
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.name).toBe('Upper body strength');
    expect(request.request.body.status).toBe('COMPLETED');
    expect(request.request.body.source).toBe('MANUAL');
    expect(request.request.body.durationMinutes).toBe(60);
    expect(typeof request.request.body.startedAt).toBe('string');
    expect(typeof request.request.body.completedAt).toBe('string');
    expect('sportActivity' in request.request.body).toBeFalse();
    expect('distanceKm' in request.request.body).toBeFalse();
    request.flush({});
  });

  it('sends the sport and distance of a logged session only when given', () => {
    service
      .saveWorkoutSession({
        name: 'Cycling',
        workoutType: 'SPORTS',
        durationMinutes: 60,
        caloriesBurned: 400,
        perceivedExertion: 6,
        notes: '',
        sportActivity: 'CYCLING',
        distanceKm: 24.5
      })
      .subscribe();

    const request = httpTesting.expectOne('/api/v1/workouts/sessions');
    expect(request.request.body.sportActivity).toBe('CYCLING');
    expect(request.request.body.distanceKm).toBe(24.5);
    request.flush({});
  });

  it('requests the monthly training insight with the month only', () => {
    let result: MonthlyTrainingInsight | undefined;
    service.getMonthlyTrainingInsight('2026-09').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/workouts/insights/monthly' &&
        req.params.get('month') === '2026-09' &&
        !req.params.has('timezone')
    );
    request.flush({
      timezone: 'Asia/Singapore',
      month: '2026-09',
      monthStart: '2026-09-01',
      monthEnd: '2026-09-30',
      referenceDate: '2026-10-01',
      firstSessionDate: '2026-08-03',
      days: [{ date: '2026-09-03', kind: 'CARDIO', label: 'Cardio', sessions: 1, minutes: 35, muscles: ['CARDIO'], record: true }],
      weeks: [
        { weekStart: '2026-08-31', weekEnd: '2026-09-06', sessions: 4, minutes: 195, strengthSessions: 2, cardioSessions: 1, mobilitySessions: 0, sportSessions: 1, complete: true }
      ],
      totals: { sessions: 16, minutes: 780, records: 3, longestStreakDays: 3 },
      previousTotals: { sessions: 15, minutes: 720, records: 2, longestStreakDays: 2 },
      muscles: [{ group: 'CHEST', label: 'Chest', sessions: 8 }]
    });

    expect(result?.month).toBe('2026-09');
    expect(result?.referenceDate).toBe('2026-10-01');
    expect(result?.firstSessionDate).toBe('2026-08-03');
    expect(result?.days).toEqual([{ date: '2026-09-03', kind: 'CARDIO', label: 'Cardio', sessions: 1, minutes: 35, muscles: ['CARDIO'], record: true }]);
    expect(result?.weeks[0].complete).toBeTrue();
    expect(result?.weeks[0].sportSessions).toBe(1);
    expect(result?.totals.minutes).toBe(780);
    expect(result?.previousTotals?.sessions).toBe(15);
    expect(result?.muscles[0].label).toBe('Chest');
  });

  it('defensively maps a monthly training insight with missing and invalid fields', () => {
    let result: MonthlyTrainingInsight | undefined;
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    service.getMonthlyTrainingInsight('2026-09').subscribe((value) => (result = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/monthly').flush({
      referenceDate: '2026-10-01',
      days: [
        { date: '2026-09-03', kind: 'UNKNOWN_KIND', sessions: null, minutes: Number.NaN },
        { kind: 'CARDIO' },
        null
      ],
      weeks: [{ sessions: 2 }],
      totals: { sessions: 2 },
      muscles: [{ label: 'No code' }, { group: 'CORE', sessions: undefined }]
    });

    expect(result?.month).toBe('2026-09');
    expect(result?.timezone).toBe('Asia/Singapore');
    expect(result?.firstSessionDate).toBeNull();
    expect(result?.previousTotals).toBeNull();
    expect(result?.days.length).toBe(1);
    expect(result?.days[0].kind).toBe('OPEN');
    expect(result?.days[0].sessions).toBe(0);
    expect(result?.days[0].minutes).toBe(0);
    expect(result?.days[0].muscles).toEqual([]);
    expect(result?.days[0].record).toBeFalse();
    expect(result?.weeks).toEqual([]);
    expect(result?.totals).toEqual({ sessions: 2, minutes: 0, records: 0, longestStreakDays: 0 });
    expect(result?.muscles).toEqual([{ group: 'CORE', label: 'CORE', sessions: 0 }]);
  });

  it('maps an empty monthly response to empty lists and zero totals', () => {
    let result: MonthlyTrainingInsight | undefined;
    service.getMonthlyTrainingInsight('2026-09').subscribe((value) => (result = value));
    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/monthly').flush({});
    expect(result?.days).toEqual([]);
    expect(result?.weeks).toEqual([]);
    expect(result?.muscles).toEqual([]);
    expect(result?.totals.sessions).toBe(0);
  });

  it('lets a failed monthly request reach the caller', () => {
    let failed = false;
    service.getMonthlyTrainingInsight('2026-09').subscribe({ error: () => (failed = true) });
    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/insights/monthly').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
  });

  describe('getActiveWorkout', () => {
    const url = '/api/v1/workouts/sessions/active';

    it('maps the session and where the person left off', () => {
      let result: unknown;
      service.getActiveWorkout().subscribe((value) => (result = value));

      httpTesting.expectOne(url).flush({
        session: {
          sessionId: 'session-1',
          name: 'Leg day',
          workoutType: 'STRENGTH',
          status: 'IN_PROGRESS',
          startedAt: '2026-10-01T10:00:00Z',
          planDayId: 'day-3',
          autoClosedAt: null,
          exercises: [{ exerciseLogId: 'log-1', exerciseId: 'exercise-1', exerciseNameSnapshot: 'Goblet squat', sequence: 1, sets: [] }]
        },
        resume: {
          doneSets: 2,
          skippedSets: 0,
          pendingSets: 4,
          totalSets: 6,
          nextSet: { exerciseLogId: 'log-1', exerciseId: 'exercise-1', exerciseNameSnapshot: 'Goblet squat', exerciseSequence: 1, setNumber: 3 }
        }
      });

      const active = result as { session: WorkoutSessionDetail; resume: { doneSets: number; nextSet: { exerciseName: string; setNumber: number } } };
      expect(active.session.sessionId).toBe('session-1');
      expect(active.session.planDayId).toBe('day-3');
      expect(active.session.autoClosedAt).toBeNull();
      expect(active.session.exercises.length).toBe(1);
      expect(active.resume.doneSets).toBe(2);
      expect(active.resume.nextSet).toEqual(jasmine.objectContaining({ exerciseName: 'Goblet squat', setNumber: 3 }));
    });

    it('keeps a missing resume as null, and a missing next set as null', () => {
      const results: unknown[] = [];
      service.getActiveWorkout().subscribe((value) => results.push(value));
      httpTesting.expectOne(url).flush({ session: { sessionId: 'session-1', name: 'Run', status: 'IN_PROGRESS', startedAt: '2026-10-01T10:00:00Z' } });
      service.getActiveWorkout().subscribe((value) => results.push(value));
      httpTesting.expectOne(url).flush({
        session: { sessionId: 'session-2', name: 'Run', status: 'IN_PROGRESS', startedAt: '2026-10-01T10:00:00Z' },
        resume: { doneSets: 1, skippedSets: 0, pendingSets: 0, totalSets: 1, nextSet: null }
      });

      expect((results[0] as { resume: unknown }).resume).toBeNull();
      expect((results[1] as { resume: { nextSet: unknown } }).resume.nextSet).toBeNull();
    });

    it('means no workout for a 204, an empty body, a body without a session, and an error', () => {
      const results: unknown[] = [];
      const ask = () => service.getActiveWorkout().subscribe((value) => results.push(value));

      ask();
      httpTesting.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
      ask();
      httpTesting.expectOne(url).flush(null);
      ask();
      httpTesting.expectOne(url).flush({ resume: null });
      ask();
      httpTesting.expectOne(url).flush({ session: { name: 'No id' } });
      ask();
      httpTesting.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });

      expect(results).toEqual([null, null, null, null, null]);
    });
  });

  it('carries the plan day and the automatic close on every session it maps', () => {
    let page: { sessions: WorkoutSession[] } | undefined;
    service.getWorkoutSessionPage({ page: 0, size: 1 }).subscribe((value) => (page = value));

    httpTesting.expectOne((req) => req.url === '/api/v1/workouts/sessions').flush({
      content: [
        { sessionId: 'session-1', name: 'Run', status: 'COMPLETED', startedAt: '2026-10-01T10:00:00Z', planDayId: 'day-2', autoClosedAt: '2026-10-01T13:00:00Z' },
        { sessionId: 'session-2', name: 'Lift', status: 'COMPLETED', startedAt: '2026-10-01T08:00:00Z' }
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0
    });

    expect(page?.sessions[0].planDayId).toBe('day-2');
    expect(page?.sessions[0].autoClosedAt).toBe('2026-10-01T13:00:00Z');
    expect(page?.sessions[1].planDayId).toBeNull();
    expect(page?.sessions[1].autoClosedAt).toBeNull();
  });
});
