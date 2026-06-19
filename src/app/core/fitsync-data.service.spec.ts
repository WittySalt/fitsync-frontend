import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FitSyncDataService, ProgressData } from './fitsync-data.service';
import { Exercise, FoodCategory, FoodSearchResult, LoggedFood, Meal, OnboardingFormValue, OnboardingSeed, WorkoutPlan, WorkoutSession } from './fitsync.models';

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

  it('searches foods by query and maps calories + basis (no macros in search results)', () => {
    let result: FoodSearchResult[] | undefined;
    service.searchFoods('chicken').subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/foods/search' && req.params.get('q') === 'chicken'
    );
    expect(request.request.method).toBe('GET');
    request.flush([
      { foodId: 'f1', displayName: 'Grilled chicken breast', brandName: 'Generic', calories: 165, basisLabel: '100 g', verified: true }
    ]);

    expect(result?.length).toBe(1);
    expect(result?.[0].foodId).toBe('f1');
    expect(result?.[0].calories).toBe(165);
    expect(result?.[0].basisUnit).toBe('100 g');
    expect(result?.[0].verified).toBeTrue();
    expect(result?.[0].proteinGrams).toBe(0);
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
    request.flush([{ foodId: 'f2', displayName: 'Brown rice', brandName: 'Generic', calories: 112, basisLabel: '100 g' }]);

    expect(result?.[0].displayName).toBe('Brown rice');
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
      { foodName: 'Greek yogurt', brandName: 'Generic', snapshotServingLabel: '170 g', calories: 100, proteinGrams: 17, carbsGrams: 6, fatGrams: 0, timesLogged: 4 }
    ]);

    expect(result?.[0].proteinGrams).toBe(17);
    expect(result?.[0].servingLabel).toBe('170 g');
    expect(result?.[0].timesLogged).toBe(4);
  });

  it('maps frequent foods with full macros for one-tap re-logging', () => {
    let result: LoggedFood[] | undefined;
    service.getFrequentFoods(6).subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/foods/frequent' && req.params.get('limit') === '6'
    );
    request.flush([
      { foodName: 'Chicken rice', brandName: 'Hawker', snapshotServingLabel: '1 plate', calories: 620, proteinGrams: '38', carbsGrams: '72', fatGrams: '18', timesLogged: '9' }
    ]);

    expect(result?.[0].foodName).toBe('Chicken rice');
    expect(result?.[0].proteinGrams).toBe(38);
    expect(result?.[0].timesLogged).toBe(9);
  });

  it('fetches today meals within a from/to day window', () => {
    let result: Meal[] | undefined;
    service.getTodayMeals().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/nutrition/meals' && req.params.has('from') && req.params.has('to')
    );
    request.flush([
      { mealType: 'LUNCH', name: 'Chicken rice', totalCalories: 640, totalProteinGrams: 48, consumedAt: '2026-06-19T04:30:00Z', itemCount: 1 }
    ]);

    expect(result?.length).toBe(1);
    expect(result?.[0].mealType).toBe('LUNCH');
    expect(result?.[0].totalCalories).toBe(640);
  });

  it('lists workout sessions from the paginated sessions endpoint', () => {
    let result: WorkoutSession[] | undefined;
    service.getWorkoutSessions().subscribe((value) => (result = value));

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/workouts/sessions' && req.params.get('size') === '20'
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

  it('returns a null active plan when none is set', () => {
    let result: WorkoutPlan | null | undefined = undefined;
    service.getActivePlan().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/workouts/plans/active').flush({});

    expect(result).toBeNull();
  });
});
