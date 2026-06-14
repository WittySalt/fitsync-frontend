import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, delay, forkJoin, map, Observable, of, throwError } from 'rxjs';

import {
  BodyMetric,
  FoodSearchResult,
  Goal,
  MealFormValue,
  Meal,
  NutritionSummary,
  OnboardingFormValue,
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

interface PageResponse<T> {
  content: T[];
}

interface BackendCurrentUser {
  profile?: Partial<UserProfile> | null;
  activeGoals?: Array<Partial<Goal>> | null;
  latestBodyMetrics?: Partial<BodyMetric> | null;
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

  getFoods(): Observable<FoodSearchResult[]> {
    return this.http.get<Partial<FoodSearchResult>[]>(`${this.apiBaseUrl}/nutrition/foods/search?q=`).pipe(
      map((foods) => foods.map((food) => this.mapFood(food))),
      catchError(() => this.getFallbackFoods())
    );
  }

  getFallbackFoods(): Observable<FoodSearchResult[]> {
    return of([
      {
        displayName: 'Greek yogurt',
        brandName: 'FitSync verified',
        calories: 96,
        proteinGrams: 10,
        basisUnit: '100 g'
      },
      {
        displayName: 'Grilled chicken breast',
        brandName: 'Generic',
        calories: 165,
        proteinGrams: 31,
        basisUnit: '100 g'
      },
      {
        displayName: 'Brown rice',
        brandName: 'Generic',
        calories: 112,
        proteinGrams: 2.6,
        basisUnit: '100 g'
      }
    ]).pipe(delay(180));
  }

  saveOnboarding(value: OnboardingFormValue): Observable<{ ok: true }> {
    this.lastSavedMessage.set(null);
    const measuredAt = new Date().toISOString();

    return forkJoin([
      this.http.put(`${this.apiBaseUrl}/users/me/profile`, {
        displayName: value.displayName,
        firstName: value.displayName.split(' ')[0] ?? value.displayName,
        lastName: value.displayName.split(' ').slice(1).join(' '),
        heightCm: value.heightCm,
        activityLevel: 'MODERATELY_ACTIVE',
        timezone: 'Asia/Singapore',
        bio: '',
        onboardingCompleted: true
      }),
      this.http.put(`${this.apiBaseUrl}/users/me/preferences`, {
        app: {
          preferredUnits: 'METRIC',
          language: 'EN',
          timezone: 'Asia/Singapore',
          privacyLevel: 'PRIVATE',
          dataSharingConsent: false
        },
        training: {
          fitnessLevel: 'BEGINNER',
          trainingLocation: 'MIXED',
          weeklyWorkoutDays: value.weeklyWorkoutDays,
          preferredDurationMinutes: 45,
          preferredWorkoutTime: '19:00:00',
          intensityPreference: 'MODERATE'
        },
        nutrition: {
          dietaryPattern: value.dietaryPattern,
          mealFrequency: 4,
          calorieTrackingMode: value.calorieTrackingMode,
          macroPreference: 'BALANCED',
          waterGoalMl: 2500
        },
        notifications: {
          pushEnabled: true,
          emailEnabled: false,
          workoutReminderEnabled: value.workoutReminderEnabled,
          mealReminderEnabled: value.mealReminderEnabled,
          weighInReminderEnabled: true,
          goalProgressReminderEnabled: true,
          marketingEmailsEnabled: false,
          quietHoursStart: '22:00:00',
          quietHoursEnd: '07:00:00'
        }
      }),
      this.http.post(`${this.apiBaseUrl}/users/me/body-metrics`, {
        weightKg: value.weightKg,
        measuredAt,
        source: 'MANUAL'
      }),
      this.http.put(`${this.apiBaseUrl}/users/me/goals/${value.goalType}`, {
        targetValue: value.targetValue,
        targetUnit: value.goalType === 'WEIGHT' ? 'kg' : '',
        targetDate: this.defaultTargetDate(),
        status: 'ACTIVE'
      })
    ]).pipe(map(() => ({ ok: true as const })));
  }

  saveMeal(value: MealFormValue): Observable<{ ok: true }> {
    this.lastSavedMessage.set(null);

    return this.http.post(`${this.apiBaseUrl}/nutrition/meals`, {
      mealType: value.mealType,
      source: 'MANUAL',
      consumedAt: new Date().toISOString(),
      timezone: 'Asia/Singapore',
      items: [
        {
          foodName: value.foodName,
          quantity: 1,
          unit: 'serving',
          calories: value.calories,
          proteinGrams: value.proteinGrams
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

  private mapFood(food: Partial<FoodSearchResult>): FoodSearchResult {
    return {
      displayName: food.displayName ?? 'Food',
      brandName: food.brandName ?? '',
      calories: food.calories ?? 0,
      proteinGrams: food.proteinGrams ?? 0,
      basisUnit: food.basisUnit ?? 'serving'
    };
  }
}
