import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, delay, forkJoin, map, Observable, of, throwError } from 'rxjs';

import {
  BodyMetric,
  FoodSearchResult,
  Goal,
  LoggedFood,
  MealFormValue,
  Meal,
  NutritionSummary,
  OnboardingFormValue,
  OnboardingSeed,
  UserProfile,
  WorkoutPlan,
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
  totalProteinGrams?: number | null;
  totalCarbsGrams?: number | null;
  totalFatGrams?: number | null;
  targetCalories?: number | null;
  targetProteinGrams?: number | null;
  targetCarbsGrams?: number | null;
  targetFatGrams?: number | null;
  mealCount?: number | null;
}

interface BackendFoodSearchResult {
  foodId?: string | null;
  displayName?: string | null;
  brandName?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  basisLabel?: string | null;
  basisUnit?: string | null;
  verified?: boolean | null;
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
        mealCount: 3
      },
      latestWorkout: {
        name: 'Upper Body Strength',
        workoutType: 'STRENGTH',
        durationMinutes: 48,
        caloriesBurned: 390,
        completedAt: 'Today 19:12',
        exerciseCount: 6
      },
      latestMeal: {
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

  getWorkoutPlans(): Observable<WorkoutPlan[]> {
    return this.http.get<PageResponse<Partial<WorkoutPlan>>>(`${this.apiBaseUrl}/workouts/plans?status=ACTIVE`).pipe(
      map((response) => response.content.map((plan) => this.mapWorkoutPlan(plan))),
      catchError(() => this.getFallbackWorkoutPlans())
    );
  }

  getFallbackWorkoutPlans(): Observable<WorkoutPlan[]> {
    return of([
      {
        name: 'Four Day Strength Base',
        goalFocus: 'STRENGTH',
        workoutType: 'STRENGTH',
        difficulty: 'INTERMEDIATE',
        estimatedDurationMinutes: 50,
        status: 'ACTIVE',
        exerciseCount: 7
      },
      {
        name: 'Low Impact Conditioning',
        goalFocus: 'ENDURANCE',
        workoutType: 'CARDIO',
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 32,
        status: 'DRAFT',
        exerciseCount: 5
      }
    ]).pipe(delay(220));
  }

  searchFoods(query: string): Observable<FoodSearchResult[]> {
    const params = new HttpParams().set('q', query ?? '');
    return this.http
      .get<BackendFoodSearchResult[]>(`${this.apiBaseUrl}/nutrition/foods/search`, { params })
      .pipe(
        map((foods) => foods.map((food) => this.mapFood(food))),
        catchError(() => this.getFallbackFoods())
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
      totalProteinGrams: summary.totalProteinGrams ?? 0,
      targetProteinGrams: summary.targetProteinGrams ?? 0,
      totalCarbsGrams: summary.totalCarbsGrams ?? 0,
      targetCarbsGrams: summary.targetCarbsGrams ?? 0,
      totalFatGrams: summary.totalFatGrams ?? 0,
      targetFatGrams: summary.targetFatGrams ?? 0,
      mealCount: summary.mealCount ?? 0
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
      name: session.name,
      workoutType: session.workoutType ?? 'CUSTOM',
      durationMinutes: session.durationMinutes ?? 0,
      caloriesBurned: session.caloriesBurned ?? 0,
      completedAt: session.completedAt ?? '',
      exerciseCount: session.exerciseCount ?? 0
    };
  }

  private mapMeal(meal?: Partial<Meal> | null): Meal | null {
    if (!meal?.mealType && !meal?.name) {
      return null;
    }

    return {
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

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private mapWorkoutPlan(plan: Partial<WorkoutPlan>): WorkoutPlan {
    return {
      name: plan.name ?? 'Workout plan',
      goalFocus: plan.goalFocus ?? 'GENERAL_FITNESS',
      workoutType: plan.workoutType ?? 'CUSTOM',
      difficulty: plan.difficulty ?? 'BEGINNER',
      estimatedDurationMinutes: plan.estimatedDurationMinutes ?? 0,
      status: plan.status ?? 'ACTIVE',
      exerciseCount: plan.exerciseCount ?? 0
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
}
