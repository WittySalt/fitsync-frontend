import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, delay, forkJoin, map, Observable, of, throwError } from 'rxjs';

import {
  BodyMetric,
  Exercise,
  FoodCategory,
  FoodSearchResult,
  Goal,
  LoggedFood,
  MealTemplate,
  MealFormValue,
  Meal,
  NutritionSummary,
  OnboardingFormValue,
  OnboardingSeed,
  UserProfile,
  WorkoutPlan,
  WorkoutPlanRequest,
  WorkoutPlanStatus,
  WorkoutSession
} from './fitsync.models';

export interface DashboardData {
  profile: UserProfile;
  nutrition: NutritionSummary;
  latestWorkout: WorkoutSession | null;
  latestMeal: Meal | null;
  latestBodyMetric: BodyMetric | null;
  goals: Goal[];
}

export type ProgressMetricKey = 'weightKg' | 'bmi' | 'bodyFatRate' | 'waistCm';

export interface ProgressDateRange {
  startDate: string;
  endDate: string;
}

export interface ProgressBodyMetric {
  weightKg: number | null;
  bodyFatRate: number | null;
  bmi: number | null;
  waistCm: number | null;
  measuredAt: string | null;
}

export interface ProgressData {
  latestBodyMetric: ProgressBodyMetric | null;
  bodyMetrics: ProgressBodyMetric[];
  trendPoints: ProgressBodyMetric[];
  goals: Goal[];
}

export interface FoodSearchOptions {
  categoryId?: string | null;
  includeSubcategories?: boolean;
  verified?: boolean;
  page?: number;
  size?: number;
}

interface PageResponse<T> {
  content: T[];
}

interface BackendCurrentUser {
  profile?: Partial<UserProfile> | null;
  preferences?: BackendUserPreferences | null;
  activeGoals?: Array<Partial<Goal>> | null;
  latestBodyMetrics?: Partial<BodyMetric> | null;
}

interface BackendUserPreferences {
  app?: {
    preferredUnits?: string | null;
  } | null;
  training?: {
    fitnessLevel?: string | null;
    trainingLocation?: string | null;
    weeklyWorkoutDays?: number | null;
    preferredDurationMinutes?: number | null;
    preferredWorkoutTime?: string | null;
    intensityPreference?: string | null;
  } | null;
  nutrition?: {
    dietaryPattern?: string | null;
    mealFrequency?: number | null;
    calorieTrackingMode?: string | null;
    macroPreference?: string | null;
    waterGoalMl?: number | null;
  } | null;
  notifications?: {
    workoutReminderEnabled?: boolean | null;
    mealReminderEnabled?: boolean | null;
    weighInReminderEnabled?: boolean | null;
  } | null;
}

interface BackendNutritionSummary {
  totalCalories?: number | null;
  totalProteinGrams?: number | string | null;
  totalCarbsGrams?: number | string | null;
  totalFatGrams?: number | string | null;
  targetCalories?: number | null;
  targetProteinGrams?: number | string | null;
  targetCarbsGrams?: number | string | null;
  targetFatGrams?: number | string | null;
  mealCount?: number | null;
  totalFiberGrams?: number | string | null;
  totalSugarGrams?: number | string | null;
  totalSodiumMg?: number | string | null;
  fiberTargetGrams?: number | string | null;
  sugarLimitGrams?: number | string | null;
  sodiumLimitMg?: number | string | null;
  fiberTargetMet?: boolean | null;
  sugarWithinLimit?: boolean | null;
  sodiumWithinLimit?: boolean | null;
}

interface BackendFoodSearchResult {
  foodId?: string | null;
  displayName?: string | null;
  brandName?: string | null;
  categoryCode?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  basisLabel?: string | null;
  basisUnit?: string | null;
  verified?: boolean | null;
}

interface BackendWorkoutPlanExercise {
  planExerciseId?: string | null;
  exerciseId?: string | null;
  exerciseNameSnapshot?: string | null;
  sequence?: number | null;
  targetSets?: number | null;
  targetReps?: number | null;
  targetWeightKg?: number | string | null;
  targetDurationSeconds?: number | null;
  targetDistanceKm?: number | string | null;
  restSeconds?: number | null;
  notes?: string | null;
  setTargets?: BackendWorkoutPlanExerciseSetTarget[] | null;
}

interface BackendWorkoutPlanExerciseSetTarget {
  setTargetId?: string | null;
  setNumber?: number | null;
  targetReps?: number | null;
  targetWeightKg?: number | string | null;
  targetDurationSeconds?: number | null;
  targetDistanceKm?: number | string | null;
  restSeconds?: number | null;
}

interface BackendWorkoutPlan {
  planId?: string | null;
  name?: string | null;
  description?: string | null;
  goalFocus?: string | null;
  workoutType?: string | null;
  difficulty?: string | null;
  estimatedDurationMinutes?: number | null;
  status?: string | null;
  exerciseCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  exercises?: BackendWorkoutPlanExercise[] | null;
}

interface BackendFoodCategory {
  categoryId?: string | null;
  parentId?: string | null;
  code?: string | null;
  displayName?: string | null;
  slug?: string | null;
  sortOrder?: number | null;
  children?: BackendFoodCategory[] | null;
}

interface BackendFoodDetail {
  foodId?: string | null;
  displayName?: string | null;
  brandName?: string | null;
  calories?: number | null;
  proteinGrams?: number | string | null;
  carbsGrams?: number | string | null;
  fatGrams?: number | string | null;
  basisUnit?: string | null;
}

interface BackendLoggedFood {
  foodName?: string | null;
  brandName?: string | null;
  snapshotServingLabel?: string | null;
  servingSize?: number | string | null;
  servingUnit?: string | null;
  calories?: number | null;
  proteinGrams?: number | string | null;
  carbsGrams?: number | string | null;
  fatGrams?: number | string | null;
  timesLogged?: number | string | null;
}

@Injectable({ providedIn: 'root' })
export class FitSyncDataService {
  private readonly http = inject(HttpClient);

  readonly apiBaseUrl = '/api/v1';
  readonly lastSavedMessage = signal<string | null>(null);

  getDashboard(): Observable<DashboardData> {
    const today = new Date().toISOString().slice(0, 10);

    return forkJoin({
      user: this.http.get<BackendCurrentUser>(`${this.apiBaseUrl}/users/me`),
      nutrition: this.http.get<BackendNutritionSummary>(
        `${this.apiBaseUrl}/nutrition/summary/daily?date=${today}&timezone=Asia/Singapore`
      ),
      latestWorkout: this.http.get<Partial<WorkoutSession>>(`${this.apiBaseUrl}/workouts/sessions/latest`),
      latestMeal: this.http.get<Partial<Meal>>(`${this.apiBaseUrl}/nutrition/meals/latest`)
    }).pipe(
      map(({ user, nutrition, latestWorkout, latestMeal }) => ({
        profile: this.mapProfile(user.profile),
        nutrition: this.mapNutrition(nutrition),
        latestWorkout: this.mapWorkoutSession(latestWorkout),
        latestMeal: this.mapMeal(latestMeal),
        latestBodyMetric: this.mapBodyMetric(user.latestBodyMetrics),
        goals: (user.activeGoals ?? []).map((goal) => this.mapGoal(goal))
      })),
      catchError(() => this.getFallbackDashboard())
    );
  }

  getFallbackDashboard(): Observable<DashboardData> {
    return of({
      profile: {
        displayName: 'Alice Tan',
        firstName: 'Alice',
        lastName: 'Tan',
        heightCm: 165,
        activityLevel: 'MODERATELY_ACTIVE',
        timezone: 'Asia/Singapore',
        onboardingCompleted: false
      },
      nutrition: {
        totalCalories: 1680,
        targetCalories: 2100,
        totalProteinGrams: 118,
        targetProteinGrams: 150,
        totalCarbsGrams: 184,
        targetCarbsGrams: 230,
        totalFatGrams: 52,
        targetFatGrams: 70,
        mealCount: 3,
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
        name: 'Upper Body Strength',
        workoutType: 'STRENGTH',
        status: 'COMPLETED',
        startedAt: 'Today 18:24',
        durationMinutes: 48,
        caloriesBurned: 390,
        completedAt: 'Today 19:12',
        exerciseCount: 6
      },
      latestMeal: {
        mealId: 'demo-meal',
        mealType: 'LUNCH',
        name: 'Chicken rice bowl',
        totalCalories: 620,
        totalProteinGrams: 42,
        consumedAt: 'Today 12:36',
        itemCount: 4
      },
      latestBodyMetric: {
        weightKg: 72.4,
        bodyFatRate: 21.5,
        bmi: 26.6,
        measuredAt: 'Today 07:20'
      },
      goals: [
        {
          goalType: 'WEIGHT',
          targetValue: 68,
          targetUnit: 'kg',
          targetDate: '2026-09-30',
          status: 'ACTIVE',
          progressRatio: 0.42
        },
        {
          goalType: 'WORKOUT_FREQUENCY',
          targetValue: 4,
          targetUnit: 'sessions/week',
          targetDate: '2026-07-31',
          status: 'ACTIVE',
          progressRatio: 0.75
        }
      ]
    }).pipe(delay(260));
  }

  getProgressData(range: ProgressDateRange): Observable<ProgressData> {
    const params = this.dateRangeParams(range);

    return forkJoin({
      bodyMetrics: this.http.get<unknown>(`${this.apiBaseUrl}/users/me/body-metrics`, { params }),
      trends: this.http.get<unknown>(`${this.apiBaseUrl}/users/me/body-metrics/trends`, { params }),
      goals: this.http.get<unknown>(`${this.apiBaseUrl}/users/me/goals`, {
        params: new HttpParams().set('status', 'ACTIVE')
      })
    }).pipe(
      map(({ bodyMetrics, trends, goals }) => {
        const metricRows = this.extractList<Partial<ProgressBodyMetric>>(bodyMetrics).map((metric) =>
          this.mapProgressBodyMetric(metric)
        );
        const trendRows = this.extractList<Partial<ProgressBodyMetric>>(trends).map((metric) =>
          this.mapProgressBodyMetric(metric)
        );
        const mappedGoals = this.extractList<Partial<Goal>>(goals).map((goal) => this.mapGoal(goal));

        return {
          latestBodyMetric: metricRows[0] ?? trendRows.at(-1) ?? null,
          bodyMetrics: metricRows,
          trendPoints: trendRows.length ? trendRows : metricRows.slice().reverse(),
          goals: mappedGoals
        };
      }),
      catchError(() => throwError(() => new Error('Unable to load progress data. Please retry.')))
    );
  }

  getWorkoutPlans(status: WorkoutPlanStatus | null = 'ACTIVE'): Observable<WorkoutPlan[]> {
    let params = new HttpParams().set('size', '20');
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PageResponse<BackendWorkoutPlan>>(`${this.apiBaseUrl}/workouts/plans`, { params }).pipe(
      map((response) => (response.content ?? []).map((plan) => this.mapWorkoutPlan(plan))),
      catchError(() => (status === 'ACTIVE' ? this.getFallbackWorkoutPlans() : of([] as WorkoutPlan[])))
    );
  }

  getFallbackWorkoutPlans(): Observable<WorkoutPlan[]> {
    return of([
      {
        name: 'Four Day Strength Base',
        planId: null,
        description: '',
        goalFocus: 'STRENGTH',
        workoutType: 'STRENGTH',
        difficulty: 'INTERMEDIATE',
        estimatedDurationMinutes: 50,
        status: 'ACTIVE',
        exerciseCount: 7,
        exercises: []
      },
      {
        name: 'Low Impact Conditioning',
        planId: null,
        description: '',
        goalFocus: 'ENDURANCE',
        workoutType: 'CARDIO',
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 32,
        status: 'DRAFT',
        exerciseCount: 5,
        exercises: []
      }
    ]).pipe(delay(220));
  }

  createWorkoutPlan(request: WorkoutPlanRequest): Observable<WorkoutPlan> {
    return this.http
      .post<BackendWorkoutPlan>(`${this.apiBaseUrl}/workouts/plans`, request)
      .pipe(map((plan) => this.mapWorkoutPlan(plan)));
  }

  updateWorkoutPlan(planId: string, request: WorkoutPlanRequest): Observable<WorkoutPlan> {
    return this.http
      .put<BackendWorkoutPlan>(`${this.apiBaseUrl}/workouts/plans/${planId}`, request)
      .pipe(map((plan) => this.mapWorkoutPlan(plan)));
  }

  activateWorkoutPlan(planId: string): Observable<WorkoutPlan> {
    return this.http
      .post<BackendWorkoutPlan>(`${this.apiBaseUrl}/workouts/plans/${planId}/activate`, {})
      .pipe(map((plan) => this.mapWorkoutPlan(plan)));
  }

  archiveWorkoutPlan(planId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/workouts/plans/${planId}`);
  }

  startWorkoutPlan(planId: string): Observable<WorkoutSession> {
    return this.http
      .post<Partial<WorkoutSession>>(`${this.apiBaseUrl}/workouts/plans/${planId}/start`, {})
      .pipe(
        map((session) => {
          const mapped = this.mapWorkoutSession(session);
          if (!mapped) {
            throw new Error('Workout plan started but the session response was empty.');
          }
          return mapped;
        })
      );
  }

  getWorkoutSessions(limit = 20): Observable<WorkoutSession[]> {
    const params = new HttpParams().set('size', String(limit));
    return this.http
      .get<PageResponse<Partial<WorkoutSession>>>(`${this.apiBaseUrl}/workouts/sessions`, { params })
      .pipe(
        map((response) =>
          (response.content ?? [])
            .map((session) => this.mapWorkoutSession(session))
            .filter((session): session is WorkoutSession => session !== null)
        ),
        catchError(() => of([] as WorkoutSession[]))
      );
  }

  getExercises(query = ''): Observable<Exercise[]> {
    const params = new HttpParams().set('q', query ?? '').set('size', '30');
    return this.http
      .get<PageResponse<Partial<Exercise>>>(`${this.apiBaseUrl}/workouts/exercises`, { params })
      .pipe(
        map((response) => (response.content ?? []).map((exercise) => this.mapExercise(exercise))),
        catchError(() => of([] as Exercise[]))
      );
  }

  getActivePlan(): Observable<WorkoutPlan | null> {
    return this.http
      .get<BackendWorkoutPlan>(`${this.apiBaseUrl}/workouts/plans/active`)
      .pipe(
        map((plan) => (plan && plan.name ? this.mapWorkoutPlan(plan) : null)),
        catchError(() => of(null))
      );
  }

  searchFoods(query: string, options: FoodSearchOptions = {}): Observable<FoodSearchResult[]> {
    let params = new HttpParams().set('q', query ?? '');
    if (options.categoryId) {
      params = params
        .set('categoryId', options.categoryId)
        .set('includeSubcategories', String(options.includeSubcategories ?? true));
    }
    if (options.verified) {
      params = params.set('verified', 'true');
    }
    if (options.page != null) {
      params = params.set('page', String(options.page));
    }
    if (options.size != null) {
      params = params.set('size', String(options.size));
    }

    const filtered = Boolean(options.categoryId || options.verified || options.page);
    return this.http
      .get<BackendFoodSearchResult[]>(`${this.apiBaseUrl}/nutrition/foods/search`, { params })
      .pipe(
        map((foods) => foods.map((food) => this.mapFood(food))),
        catchError(() => (filtered ? of([] as FoodSearchResult[]) : this.getFallbackFoods()))
      );
  }

  getFoodCategories(): Observable<FoodCategory[]> {
    return this.http.get<BackendFoodCategory[]>(`${this.apiBaseUrl}/nutrition/categories`).pipe(
      map((categories) => categories.map((category) => this.mapFoodCategory(category))),
      catchError(() => of([] as FoodCategory[]))
    );
  }

  getRecentFoods(limit = 8): Observable<LoggedFood[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http
      .get<BackendLoggedFood[]>(`${this.apiBaseUrl}/nutrition/foods/recent`, { params })
      .pipe(
        map((foods) => foods.map((food) => this.mapLoggedFood(food))),
        catchError(() => of([] as LoggedFood[]))
      );
  }

  getFavoriteFoods(): Observable<FoodSearchResult[]> {
    return this.http.get<BackendFoodSearchResult[]>(`${this.apiBaseUrl}/nutrition/favorites`).pipe(
      map((foods) => foods.map((food) => this.mapFood(food))),
      catchError(() => of([] as FoodSearchResult[]))
    );
  }

  addFavoriteFood(foodId: string): Observable<void> {
    return this.http.post<void>(`${this.apiBaseUrl}/nutrition/foods/${foodId}/favorite`, {});
  }

  removeFavoriteFood(foodId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/nutrition/foods/${foodId}/favorite`);
  }

  getFrequentFoods(limit = 8): Observable<LoggedFood[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http
      .get<BackendLoggedFood[]>(`${this.apiBaseUrl}/nutrition/foods/frequent`, { params })
      .pipe(
        map((foods) => foods.map((food) => this.mapLoggedFood(food))),
        catchError(() => of([] as LoggedFood[]))
      );
  }

  getTodayMeals(timezone?: string): Observable<Meal[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const params = new HttpParams()
      .set('from', start.toISOString())
      .set('to', new Date().toISOString());
    return this.http
      .get<Partial<Meal>[]>(`${this.apiBaseUrl}/nutrition/meals`, { params })
      .pipe(
        map((meals) => meals.map((meal) => this.mapMeal(meal)).filter((meal): meal is Meal => meal !== null)),
        catchError(() => of([] as Meal[]))
      );
  }

  getFallbackFoods(): Observable<FoodSearchResult[]> {
    return of<FoodSearchResult[]>([
      { foodId: null, displayName: 'Greek yogurt', brandName: 'Generic', calories: 96, proteinGrams: 10, basisUnit: '100 g', verified: true },
      { foodId: null, displayName: 'Grilled chicken breast', brandName: 'Generic', calories: 165, proteinGrams: 31, basisUnit: '100 g', verified: true },
      { foodId: null, displayName: 'Brown rice', brandName: 'Generic', calories: 112, proteinGrams: 2.6, basisUnit: '100 g', verified: true }
    ]).pipe(delay(180));
  }

  getOnboardingSeed(): Observable<OnboardingSeed> {
    return this.http
      .get<BackendCurrentUser>(`${this.apiBaseUrl}/users/me`)
      .pipe(map((user) => this.mapOnboardingSeed(user)));
  }

  saveOnboarding(value: OnboardingFormValue): Observable<{ ok: true }> {
    this.lastSavedMessage.set(null);

    const heightCm = this.getOnboardingHeightCm(value);
    const currentWeightKg = this.getOnboardingCurrentWeightKg(value);
    const targetWeightKg = this.getOnboardingTargetWeightKg(value);

    return this.http.post(`${this.apiBaseUrl}/users/me/onboarding`, {
      primaryGoal: value.primaryGoal,
      displayName: value.displayName,
      birthDate: value.birthDate || null,
      gender: value.gender || 'PREFER_NOT_TO_SAY',
      heightCm,
      activityLevel: value.activityLevel,
      timezone: this.getLocalTimezone(),
      preferredUnits: value.preferredUnits,
      currentWeightKg,
      targetWeightKg,
      bodyFatRate: null,
      weeklyPaceKg: value.weeklyPaceKg,
      targetDate: value.projectedTargetDate || this.defaultTargetDate(),
      targetCalories: value.targetCalories,
      targetProteinGrams: value.targetProteinGrams,
      targetCarbsGrams: value.targetCarbsGrams,
      targetFatGrams: value.targetFatGrams,
      // Streamlined goal-driven onboarding no longer collects these; FE-19 guided
      // training flow will replace the defaults with real inputs.
      fitnessLevel: 'BEGINNER',
      trainingLocation: 'MIXED',
      weeklyWorkoutDays: value.weeklyWorkoutDays,
      preferredDurationMinutes: 45,
      preferredWorkoutTime: '19:00:00',
      intensityPreference: 'MODERATE',
      dietaryPattern: value.dietaryPattern,
      mealFrequency: 4,
      calorieTrackingMode: value.calorieTrackingMode,
      macroPreference: 'BALANCED',
      waterGoalMl: 2500,
      workoutReminderEnabled: value.workoutReminderEnabled,
      mealReminderEnabled: value.mealReminderEnabled,
      weighInReminderEnabled: true
    }).pipe(map(() => ({ ok: true as const })));
  }

  getMealTemplates(): Observable<MealTemplate[]> {
    return this.http
      .get<Partial<MealTemplate>[]>(`${this.apiBaseUrl}/nutrition/meal-templates`)
      .pipe(
        map((templates) => templates.map((template) => this.mapMealTemplate(template))),
        catchError(() => of([] as MealTemplate[]))
      );
  }

  logMealFromTemplate(templateId: string): Observable<{ ok: true }> {
    return this.http
      .post(`${this.apiBaseUrl}/nutrition/meals/from-template/${templateId}`, {})
      .pipe(map(() => ({ ok: true as const })));
  }

  copyMeal(mealId: string, mealType: string): Observable<{ ok: true }> {
    return this.http
      .post(`${this.apiBaseUrl}/nutrition/meals/${mealId}/copy`, { mealType })
      .pipe(map(() => ({ ok: true as const })));
  }

  getFoodByBarcode(barcode: string): Observable<LoggedFood | null> {
    return this.http
      .get<BackendFoodDetail>(`${this.apiBaseUrl}/nutrition/barcodes/${encodeURIComponent(barcode)}`)
      .pipe(
        map((food) =>
          food && food.displayName
            ? {
                foodName: food.displayName,
                brandName: food.brandName ?? '',
                servingLabel: food.basisUnit ?? '',
                calories: food.calories ?? 0,
                proteinGrams: Number(food.proteinGrams ?? 0),
                carbsGrams: Number(food.carbsGrams ?? 0),
                fatGrams: Number(food.fatGrams ?? 0),
                timesLogged: 0
              }
            : null
        ),
        catchError(() => of(null))
      );
  }

  private mapMealTemplate(template: Partial<MealTemplate>): MealTemplate {
    return {
      templateId: template.templateId ?? '',
      name: template.name ?? 'Saved meal',
      mealType: template.mealType ?? 'MEAL',
      note: template.note ?? '',
      totalCalories: template.totalCalories ?? 0
    };
  }

  saveMeal(value: MealFormValue): Observable<{ ok: true }> {
    this.lastSavedMessage.set(null);

    return this.http.post(`${this.apiBaseUrl}/nutrition/meals`, {
      mealType: value.mealType,
      name: value.foodName,
      source: 'MANUAL',
      consumedAt: new Date().toISOString(),
      timezone: 'Asia/Singapore',
      note: value.note || null,
      items: [
        {
          foodName: value.foodName,
          quantity: 1,
          unit: 'serving',
          calories: value.calories,
          proteinGrams: value.proteinGrams,
          carbsGrams: value.carbsGrams,
          fatGrams: value.fatGrams
        }
      ]
    }).pipe(
      map(() => {
        this.lastSavedMessage.set('Meal saved to FitSync backend.');
        return { ok: true as const };
      })
    );
  }

  simulateLoadError(): Observable<never> {
    return throwError(() => new Error('Unable to load FitSync data. Please retry.'));
  }

  private mapProfile(profile?: Partial<UserProfile> | null): UserProfile {
    return {
      displayName: profile?.displayName ?? 'FitSync User',
      firstName: profile?.firstName ?? profile?.displayName?.split(' ')[0] ?? 'FitSync',
      lastName: profile?.lastName ?? '',
      gender: profile?.gender,
      birthDate: profile?.birthDate,
      heightCm: profile?.heightCm ?? 0,
      activityLevel: profile?.activityLevel ?? 'NOT_SET',
      timezone: profile?.timezone ?? 'Asia/Singapore',
      onboardingCompleted: profile?.onboardingCompleted ?? false
    };
  }

  private mapNutrition(summary: BackendNutritionSummary): NutritionSummary {
    return {
      totalCalories: summary.totalCalories ?? 0,
      targetCalories: summary.targetCalories ?? 0,
      totalProteinGrams: this.numericValue(summary.totalProteinGrams) ?? 0,
      targetProteinGrams: this.numericValue(summary.targetProteinGrams) ?? 0,
      totalCarbsGrams: this.numericValue(summary.totalCarbsGrams) ?? 0,
      targetCarbsGrams: this.numericValue(summary.targetCarbsGrams) ?? 0,
      totalFatGrams: this.numericValue(summary.totalFatGrams) ?? 0,
      targetFatGrams: this.numericValue(summary.targetFatGrams) ?? 0,
      mealCount: summary.mealCount ?? 0,
      totalFiberGrams: this.numericValue(summary.totalFiberGrams),
      totalSugarGrams: this.numericValue(summary.totalSugarGrams),
      totalSodiumMg: this.numericValue(summary.totalSodiumMg),
      fiberTargetGrams: this.numericValue(summary.fiberTargetGrams),
      sugarLimitGrams: this.numericValue(summary.sugarLimitGrams),
      sodiumLimitMg: this.numericValue(summary.sodiumLimitMg),
      fiberTargetMet: summary.fiberTargetMet ?? null,
      sugarWithinLimit: summary.sugarWithinLimit ?? null,
      sodiumWithinLimit: summary.sodiumWithinLimit ?? null
    };
  }

  private defaultTargetDate(): string {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 3);
    return targetDate.toISOString().slice(0, 10);
  }

  private getOnboardingHeightCm(value: OnboardingFormValue): number {
    if (value.preferredUnits === 'IMPERIAL') {
      const totalInches = (value.heightFt ?? 0) * 12 + (value.heightIn ?? 0);
      return Math.round(totalInches * 2.54);
    }
    return value.heightCm ?? 0;
  }

  private getOnboardingCurrentWeightKg(value: OnboardingFormValue): number {
    if (value.preferredUnits === 'IMPERIAL') {
      return this.lbToKg(value.currentWeightLb ?? 0);
    }
    return value.currentWeightKg ?? 0;
  }

  private getOnboardingTargetWeightKg(value: OnboardingFormValue): number | null {
    if (value.preferredUnits === 'IMPERIAL') {
      return value.targetWeightLb != null ? this.lbToKg(value.targetWeightLb) : null;
    }
    return value.targetWeightKg;
  }

  private lbToKg(value: number): number {
    return Math.round((value / 2.20462) * 10) / 10;
  }

  private getLocalTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';
    } catch {
      return 'Asia/Singapore';
    }
  }

  // FE-12.1: prefill onboarding for returning users + normalize backend numeric enum codes.
  private mapOnboardingSeed(user: BackendCurrentUser): OnboardingSeed {
    const profile = user.profile;
    const preferences = user.preferences;
    const goals = user.activeGoals ?? [];
    const weightGoal = goals.find((goal) => goal.goalType === 'WEIGHT');
    const caloriesGoal = goals.find((goal) => goal.goalType === 'CALORIES');
    const proteinGoal = goals.find((goal) => goal.goalType === 'PROTEIN');
    const latestBodyMetric = user.latestBodyMetrics;
    const hasCompletedOnboarding = profile?.onboardingCompleted === true;
    const value: Partial<OnboardingFormValue> = {};

    if (profile?.displayName?.trim()) {
      value.displayName = profile.displayName.trim();
    }
    if (profile?.gender) {
      value.gender = profile.gender;
    }
    if (profile?.birthDate) {
      value.birthDate = profile.birthDate;
    }
    if (profile?.heightCm) {
      value.heightCm = profile.heightCm;
    }
    if (profile?.activityLevel) {
      value.activityLevel = profile.activityLevel;
    }
    if (latestBodyMetric?.weightKg) {
      value.currentWeightKg = latestBodyMetric.weightKg;
    }
    if (weightGoal?.targetValue != null) {
      value.targetWeightKg = weightGoal.targetValue;
    }

    const app = preferences?.app;
    const training = preferences?.training;
    const nutrition = preferences?.nutrition;
    const notifications = preferences?.notifications;

    const preferredUnits = this.normalizeEnum(app?.preferredUnits, {
      '100001': 'METRIC',
      '100002': 'IMPERIAL'
    });
    if (preferredUnits) {
      value.preferredUnits = preferredUnits;
    }
    const dietaryPattern = this.normalizeEnum(nutrition?.dietaryPattern, {
      '300001': 'NONE',
      '300002': 'HALAL',
      '300003': 'VEGETARIAN',
      '300004': 'VEGAN',
      '300005': 'KETO',
      '300006': 'LOW_CARB'
    });
    if (dietaryPattern) {
      value.dietaryPattern = dietaryPattern;
    }
    const calorieTrackingMode = this.normalizeEnum(nutrition?.calorieTrackingMode, {
      '310001': 'OFF',
      '310002': 'FLEXIBLE',
      '310003': 'STRICT'
    });
    if (calorieTrackingMode) {
      value.calorieTrackingMode = calorieTrackingMode;
    }

    if (training?.weeklyWorkoutDays != null) {
      value.weeklyWorkoutDays = training.weeklyWorkoutDays;
    }
    if (caloriesGoal?.targetValue != null) {
      value.targetCalories = caloriesGoal.targetValue;
    }
    if (proteinGoal?.targetValue != null) {
      value.targetProteinGrams = proteinGoal.targetValue;
    }
    if (notifications?.workoutReminderEnabled != null) {
      value.workoutReminderEnabled = notifications.workoutReminderEnabled;
    }
    if (notifications?.mealReminderEnabled != null) {
      value.mealReminderEnabled = notifications.mealReminderEnabled;
    }

    return {
      value,
      hasExistingBodyBaseline:
        hasCompletedOnboarding || Boolean(latestBodyMetric?.weightKg || weightGoal?.targetValue),
      hasExistingTrainingBaseline: hasCompletedOnboarding || Boolean(training?.weeklyWorkoutDays),
      hasExistingNutritionBaseline:
        hasCompletedOnboarding || Boolean(caloriesGoal?.targetValue || proteinGoal?.targetValue)
    };
  }

  private normalizeEnum(value: string | null | undefined, codeMap: Record<string, string>): string | undefined {
    if (!value) {
      return undefined;
    }
    return codeMap[value] ?? value.toUpperCase();
  }

  private mapWorkoutSession(session?: Partial<WorkoutSession> | null): WorkoutSession | null {
    if (!session?.name) {
      return null;
    }

    return {
      sessionId: session.sessionId ?? null,
      planId: session.planId ?? null,
      name: session.name,
      workoutType: session.workoutType ?? 'CUSTOM',
      status: session.status ?? 'COMPLETED',
      source: session.source ?? null,
      startedAt: session.startedAt ?? '',
      durationMinutes: session.durationMinutes ?? 0,
      caloriesBurned: session.caloriesBurned ?? 0,
      completedAt: session.completedAt ?? '',
      exerciseCount: session.exerciseCount ?? 0
    };
  }

  private mapExercise(exercise: Partial<Exercise>): Exercise {
    return {
      exerciseId: exercise.exerciseId ?? null,
      name: exercise.name ?? 'Exercise',
      exerciseType: exercise.exerciseType ?? '',
      primaryMuscleGroup: exercise.primaryMuscleGroup ?? '',
      equipment: exercise.equipment ?? '',
      difficulty: exercise.difficulty ?? '',
      custom: exercise.custom ?? false
    };
  }

  private mapMeal(meal?: Partial<Meal> | null): Meal | null {
    if (!meal?.mealType && !meal?.name) {
      return null;
    }

    return {
      mealId: meal.mealId ?? '',
      mealType: meal.mealType ?? 'MEAL',
      name: meal.name ?? meal.mealType ?? 'Meal',
      totalCalories: meal.totalCalories ?? 0,
      totalProteinGrams: meal.totalProteinGrams ?? 0,
      consumedAt: meal.consumedAt ?? '',
      itemCount: meal.itemCount ?? 0
    };
  }

  private mapBodyMetric(metric?: Partial<BodyMetric> | null): BodyMetric | null {
    if (!metric?.weightKg && !metric?.bmi) {
      return null;
    }

    return {
      weightKg: metric.weightKg ?? 0,
      bodyFatRate: metric.bodyFatRate ?? 0,
      bmi: metric.bmi ?? 0,
      measuredAt: metric.measuredAt ?? ''
    };
  }

  private mapProgressBodyMetric(metric: Partial<ProgressBodyMetric> & Record<string, unknown>): ProgressBodyMetric {
    const measuredAt = this.stringValue(metric['measuredAt'] ?? metric['date'] ?? metric['metricDate'] ?? metric['recordedAt']);

    return {
      weightKg: this.numberValue(metric['weightKg'] ?? metric['weight']),
      bodyFatRate: this.numberValue(metric['bodyFatRate'] ?? metric['bodyFatPercentage'] ?? metric['bodyFat']),
      bmi: this.numberValue(metric['bmi']),
      waistCm: this.numberValue(metric['waistCm'] ?? metric['waist']),
      measuredAt
    };
  }

  private mapGoal(goal: Partial<Goal>): Goal {
    return {
      goalType: goal.goalType ?? 'GOAL',
      targetValue: goal.targetValue ?? 0,
      targetUnit: goal.targetUnit ?? '',
      targetDate: goal.targetDate ?? '',
      status: goal.status ?? 'ACTIVE',
      progressRatio: goal.progressRatio ?? 0
    };
  }

  private dateRangeParams(range: ProgressDateRange): HttpParams {
    return new HttpParams().set('startDate', range.startDate).set('endDate', range.endDate);
  }

  private extractList<T>(response: unknown): T[] {
    if (Array.isArray(response)) {
      return response as T[];
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const record = response as Record<string, unknown>;
    for (const key of ['content', 'items', 'results', 'data', 'points', 'metrics', 'goals']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }

    return [];
  }

  private numberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private numericValue(value: number | string | null | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private mapWorkoutPlan(plan: BackendWorkoutPlan): WorkoutPlan {
    const exercises = (plan.exercises ?? []).map((exercise) => this.mapWorkoutPlanExercise(exercise));
    return {
      planId: plan.planId ?? null,
      name: plan.name ?? 'Workout plan',
      description: plan.description ?? '',
      goalFocus: plan.goalFocus ?? 'GENERAL_FITNESS',
      workoutType: plan.workoutType ?? 'CUSTOM',
      difficulty: plan.difficulty ?? 'BEGINNER',
      estimatedDurationMinutes: plan.estimatedDurationMinutes ?? 0,
      status: plan.status ?? 'ACTIVE',
      exerciseCount: plan.exerciseCount ?? exercises.length,
      exercises,
      createdAt: plan.createdAt ?? null,
      updatedAt: plan.updatedAt ?? null
    };
  }

  private mapWorkoutPlanExercise(exercise: BackendWorkoutPlanExercise) {
    return {
      planExerciseId: exercise.planExerciseId ?? null,
      exerciseId: exercise.exerciseId ?? null,
      exerciseNameSnapshot: exercise.exerciseNameSnapshot ?? 'Exercise',
      sequence: exercise.sequence ?? 1,
      targetSets: exercise.targetSets ?? null,
      targetReps: exercise.targetReps ?? null,
      targetWeightKg: this.numericValue(exercise.targetWeightKg),
      targetDurationSeconds: exercise.targetDurationSeconds ?? null,
      targetDistanceKm: this.numericValue(exercise.targetDistanceKm),
      restSeconds: exercise.restSeconds ?? null,
      notes: exercise.notes ?? '',
      setTargets: (exercise.setTargets ?? []).map((target) => ({
        setTargetId: target.setTargetId ?? null,
        setNumber: target.setNumber ?? 1,
        targetReps: target.targetReps ?? null,
        targetWeightKg: this.numericValue(target.targetWeightKg),
        targetDurationSeconds: target.targetDurationSeconds ?? null,
        targetDistanceKm: this.numericValue(target.targetDistanceKm),
        restSeconds: target.restSeconds ?? null
      }))
    };
  }

  private mapFood(food: BackendFoodSearchResult): FoodSearchResult {
    return {
      foodId: food.foodId ?? null,
      displayName: food.displayName ?? 'Food',
      brandName: food.brandName ?? '',
      calories: food.calories ?? 0,
      // Search results carry calories + basis only; macros require the food detail
      // endpoint, so leave protein at 0 until the user picks a detailed/recent food.
      proteinGrams: food.proteinGrams ?? 0,
      basisUnit: food.basisLabel ?? food.basisUnit ?? 'serving',
      verified: food.verified ?? false
    };
  }

  private mapLoggedFood(food: BackendLoggedFood): LoggedFood {
    return {
      foodName: food.foodName ?? 'Food',
      brandName: food.brandName ?? '',
      servingLabel: food.snapshotServingLabel ?? (food.servingSize ? `${food.servingSize} ${food.servingUnit ?? ''}`.trim() : ''),
      calories: food.calories ?? 0,
      proteinGrams: Number(food.proteinGrams ?? 0),
      carbsGrams: Number(food.carbsGrams ?? 0),
      fatGrams: Number(food.fatGrams ?? 0),
      timesLogged: Number(food.timesLogged ?? 0)
    };
  }

  private mapFoodCategory(category: BackendFoodCategory): FoodCategory {
    return {
      categoryId: category.categoryId ?? '',
      parentId: category.parentId ?? null,
      code: category.code ?? '',
      displayName: category.displayName ?? 'Category',
      slug: category.slug ?? '',
      sortOrder: category.sortOrder ?? 0,
      children: (category.children ?? []).map((child) => this.mapFoodCategory(child))
    };
  }
}
