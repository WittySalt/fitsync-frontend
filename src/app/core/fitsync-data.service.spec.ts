import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FitSyncDataService, ProgressData } from './fitsync-data.service';
import { Exercise, ExerciseRecords, FoodCategory, FoodSearchResult, LoggedFood, Meal, MealTemplate, OnboardingFormValue, OnboardingSeed, WorkoutPlan, WorkoutSession, WorkoutSessionDetail } from './fitsync.models';

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

  it('maps daily nutrition summary micronutrients from dashboard load', () => {
    let result: number | null | undefined;
    service.getDashboard().subscribe((value) => {
      result = value.nutrition.totalFiberGrams;
      expect(value.nutrition.totalSugarGrams).toBe(42.5);
      expect(value.nutrition.totalSodiumMg).toBe(1800);
      expect(value.nutrition.fiberTargetGrams).toBe(25);
      expect(value.nutrition.sugarLimitGrams).toBe(50);
      expect(value.nutrition.sodiumLimitMg).toBe(2300);
      expect(value.nutrition.fiberTargetMet).toBeTrue();
      expect(value.nutrition.sugarWithinLimit).toBeTrue();
      expect(value.nutrition.sodiumWithinLimit).toBeTrue();
    });

    httpTesting.expectOne('/api/v1/users/me').flush({ profile: { displayName: 'Wang Xu' }, activeGoals: [] });

    const summaryRequest = httpTesting.expectOne(
      (req) =>
        req.urlWithParams.startsWith('/api/v1/nutrition/summary/daily?') &&
        req.urlWithParams.includes('timezone=Asia/Singapore')
    );
    summaryRequest.flush({
      totalCalories: 1800,
      targetCalories: 2200,
      totalProteinGrams: '140.5',
      targetProteinGrams: '150',
      totalCarbsGrams: 210,
      targetCarbsGrams: 240,
      totalFatGrams: 55,
      targetFatGrams: 70,
      mealCount: 3,
      totalFiberGrams: '27.5',
      totalSugarGrams: '42.5',
      totalSodiumMg: '1800',
      fiberTargetGrams: '25',
      sugarLimitGrams: '50',
      sodiumLimitMg: '2300',
      fiberTargetMet: true,
      sugarWithinLimit: true,
      sodiumWithinLimit: true
    });
    httpTesting.expectOne('/api/v1/workouts/sessions/latest').flush({});
    httpTesting.expectOne('/api/v1/nutrition/meals/latest').flush({});

    expect(result).toBe(27.5);
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

  it('lists favorite foods from the favorites endpoint', () => {
    let result: FoodSearchResult[] | undefined;
    service.getFavoriteFoods().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/nutrition/favorites');
    expect(request.request.method).toBe('GET');
    request.flush([
      { foodId: 'f1', displayName: 'Greek yogurt', brandName: 'Generic', calories: 96, basisLabel: '100 g', verified: true }
    ]);

    expect(result?.[0].foodId).toBe('f1');
    expect(result?.[0].displayName).toBe('Greek yogurt');
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
    request.flush([{ foodId: 'f2', displayName: 'Brown rice', brandName: 'Generic', calories: 112, basisLabel: '100 g' }]);

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
    request.flush([]);
  });

  it('lists meal templates and logs a meal from a template', () => {
    let templates: MealTemplate[] | undefined;
    service.getMealTemplates().subscribe((value) => (templates = value));
    httpTesting.expectOne('/api/v1/nutrition/meal-templates').flush([
      { templateId: 't1', name: 'Protein breakfast', mealType: 'BREAKFAST', note: '', totalCalories: 520 }
    ]);
    expect(templates?.[0].name).toBe('Protein breakfast');
    expect(templates?.[0].totalCalories).toBe(520);

    let ok = false;
    service.logMealFromTemplate('t1').subscribe(() => (ok = true));
    const request = httpTesting.expectOne('/api/v1/nutrition/meals/from-template/t1');
    expect(request.request.method).toBe('POST');
    request.flush({});
    expect(ok).toBeTrue();
  });

  it('copies a meal to now via POST /meals/{id}/copy', () => {
    let ok = false;
    service.copyMeal('m1', 'LUNCH').subscribe(() => (ok = true));

    const request = httpTesting.expectOne('/api/v1/nutrition/meals/m1/copy');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.mealType).toBe('LUNCH');
    request.flush({});
    expect(ok).toBeTrue();
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
    request.flush({});
  });
});
