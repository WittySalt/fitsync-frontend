import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, delay, forkJoin, map, Observable, of, tap, throwError } from 'rxjs';

import { AnalyticsApiService } from './analytics-api.service';
import { AccountDataService } from './account-data.service';
import {
  AnalyticsBodyTrendPoint,
  AnalyticsBucket,
  AnalyticsDashboardBody,
  AnalyticsDashboardNutrition,
  AnalyticsGoalProgress
} from './analytics.models';
import {
  BodyMetric,
  CreateExerciseRequest,
  Exercise,
  ExerciseDetail,
  ExerciseImage,
  ExerciseHistoryEntry,
  ExerciseMetadata,
  ExerciseRecords,
  ExerciseRecordValue,
  ExerciseSearchOptions,
  FoodCategory,
  FoodDetail,
  FoodSearchResult,
  FoodServing,
  Goal,
  GOAL_STATUSES,
  GOAL_TYPES,
  GoalStatus,
  GoalType,
  ImportResult,
  ImportSessionRow,
  LoggedFood,
  MealDraft,
  MealItemDraft,
  MealTemplate,
  MealTemplateItem,
  MealFormValue,
  QuickAddMealValue,
  WorkoutSessionFormValue,
  Meal,
  NutritionSummary,
  OnboardingFormValue,
  OnboardingSeed,
  PagedFoods,
  PagedExercises,
  UpsertGoalRequest,
  UserProfile,
  UserGoal,
  StartAdHocSessionInput,
  UpsertWorkoutSessionRequest,
  WorkoutExport,
  WorkoutExerciseLogInput,
  WorkoutExerciseSetInput,
  WorkoutPlan,
  WorkoutPlanRequest,
  WorkoutPlanStatus,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSessionPage,
  WorkoutSessionQuery,
  UpdateExerciseRequest
} from './fitsync.models';

export interface DashboardData {
  profile: UserProfile;
  nutrition: NutritionSummary;
  workout?: DashboardWorkoutSummary;
  latestWorkout: WorkoutSession | null;
  latestMeal: Meal | null;
  latestBodyMetric: BodyMetric | null;
  goals: Goal[];
}

export interface DashboardWorkoutSummary {
  todayWorkoutCount: number;
  weekWorkoutCount: number;
  weekWorkoutMinutes: number;
  activeStreakDays: number;
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

export function dedupeGoalsByLatestEvaluation(goals: Goal[]): Goal[] {
  const latestByType = new Map<string, Goal>();

  for (const goal of goals) {
    const existing = latestByType.get(goal.goalType);
    if (!existing || goalEvaluationTime(goal) >= goalEvaluationTime(existing)) {
      latestByType.set(goal.goalType, goal);
    }
  }

  return Array.from(latestByType.values());
}

function goalEvaluationTime(goal: Goal): number {
  if (!goal.lastEvaluatedAt) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(goal.lastEvaluatedAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
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
  totalPages?: number;
  totalElements?: number;
  number?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
}

interface BackendCurrentUser {
  profile?: BackendUserProfile | null;
  preferences?: BackendUserPreferences | null;
  activeGoals?: Array<Partial<Goal>> | null;
  latestBodyMetrics?: Partial<BodyMetric> | null;
}

interface BackendUserProfile {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  activityLevel?: string | null;
  timezone?: string | null;
  onboardingCompleted?: boolean | null;
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
    equipmentInventory?: string[] | null;
    focusAreas?: string[] | null;
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

interface BackendUserGoal {
  goalId?: string | null;
  goalType?: string | null;
  targetValue?: number | string | null;
  targetUnit?: string | null;
  targetDate?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface BackendFoodSearchResult {
  foodId?: string | null;
  displayName?: string | null;
  brandName?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  scope?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  basisLabel?: string | null;
  basisUnit?: string | null;
  primaryBarcode?: string | null;
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
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: BackendExerciseImage[] | string[] | null;
  /** First catalog image, sent with the plan so a client needs no per-exercise request. */
  primaryImageUrl?: string | null;
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

interface BackendWorkoutSessionDetail extends Partial<WorkoutSession> {
  perceivedExertion?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  exercises?: BackendWorkoutExerciseLog[] | null;
}

interface BackendWorkoutExerciseLog {
  exerciseLogId?: string | null;
  exerciseId?: string | null;
  exerciseNameSnapshot?: string | null;
  sequence?: number | null;
  performedSets?: number | null;
  performedReps?: number | null;
  totalVolumeKg?: number | string | null;
  distanceKm?: number | string | null;
  durationSeconds?: number | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  notes?: string | null;
  sets?: BackendWorkoutExerciseSetLog[] | null;
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: BackendExerciseImage[] | string[] | null;
}

interface BackendWorkoutExerciseSetLog {
  setLogId?: string | null;
  setNumber?: number | null;
  reps?: number | null;
  weightKg?: number | string | null;
  durationSeconds?: number | null;
  distanceKm?: number | string | null;
  restSeconds?: number | null;
  perceivedExertion?: number | null;
  logged?: boolean | null;
  notes?: string | null;
}

interface BackendExerciseRecordValue {
  value?: number | string | null;
  sessionId?: string | null;
  achievedAt?: string | null;
}

interface BackendExerciseRecords {
  exerciseId?: string | null;
  exerciseName?: string | null;
  maxWeightKg?: BackendExerciseRecordValue | null;
  maxReps?: BackendExerciseRecordValue | null;
  maxSingleSetVolumeKg?: BackendExerciseRecordValue | null;
  estimatedOneRepMaxKg?: BackendExerciseRecordValue | null;
  bestSessionVolumeKg?: BackendExerciseRecordValue | null;
}

interface BackendExerciseHistoryEntry {
  sessionId?: string | null;
  exerciseLogId?: string | null;
  setLogId?: string | null;
  exerciseId?: string | null;
  exerciseNameSnapshot?: string | null;
  sessionName?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  sequence?: number | null;
  setNumber?: number | null;
  reps?: number | null;
  weightKg?: number | string | null;
  durationSeconds?: number | null;
  distanceKm?: number | string | null;
  restSeconds?: number | null;
  perceivedExertion?: number | null;
  notes?: string | null;
}

interface BackendExerciseView {
  exerciseId?: string | null;
  ownerUserId?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  exerciseType?: string | null;
  primaryMuscleGroup?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  status?: string | null;
  custom?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: BackendExerciseImage[] | string[] | null;
  instructions?: BackendExerciseInstruction[] | null;
  secondaryMuscleGroups?: string[] | null;
}

interface BackendExerciseImage {
  position?: number | null;
  url?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;
}

interface BackendExerciseInstruction {
  stepNumber?: number | null;
  text?: string | null;
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
  categoryName?: string | null;
  scope?: string | null;
  densityGramsPerMl?: number | string | null;
  calories?: number | null;
  proteinGrams?: number | string | null;
  carbsGrams?: number | string | null;
  fatGrams?: number | string | null;
  fiberGrams?: number | string | null;
  sugarGrams?: number | string | null;
  sodiumMg?: number | string | null;
  basisQuantity?: number | string | null;
  basisUnit?: string | null;
  primaryBarcode?: string | null;
  sourceDataset?: string | null;
  servings?: BackendFoodServing[] | null;
}

interface BackendFoodServing {
  servingId?: string | null;
  label?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  gramsEquivalent?: number | string | null;
  millilitersEquivalent?: number | string | null;
  sortOrder?: number | null;
  defaultServing?: boolean | null;
}

interface BackendLoggedFood {
  foodId?: string | null;
  customFoodId?: string | null;
  foodCatalogItemId?: string | null;
  foodServingId?: string | null;
  scope?: string | null;
  foodName?: string | null;
  brandName?: string | null;
  snapshotServingLabel?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  servingSize?: number | string | null;
  servingUnit?: string | null;
  calories?: number | null;
  proteinGrams?: number | string | null;
  carbsGrams?: number | string | null;
  fatGrams?: number | string | null;
  fiberGrams?: number | string | null;
  sugarGrams?: number | string | null;
  sodiumMg?: number | string | null;
  timesLogged?: number | string | null;
  lastLoggedAt?: string | null;
}

interface BackendMealTemplateItem {
  templateItemId?: string | null;
  customFoodId?: string | null;
  foodCatalogItemId?: string | null;
  foodServingId?: string | null;
  foodName?: string | null;
  brandName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  snapshotServingLabel?: string | null;
  calories?: number | null;
  proteinGrams?: number | string | null;
  carbsGrams?: number | string | null;
  fatGrams?: number | string | null;
  fiberGrams?: number | string | null;
  sugarGrams?: number | string | null;
  sodiumMg?: number | string | null;
}

interface BackendMealTemplate {
  templateId?: string | null;
  name?: string | null;
  mealType?: string | null;
  note?: string | null;
  totalCalories?: number | null;
  items?: BackendMealTemplateItem[] | null;
}

interface BackendDailyNutritionSummary {
  totalCalories?: number | null;
  targetCalories?: number | null;
  totalProteinGrams?: number | string | null;
  targetProteinGrams?: number | string | null;
  totalCarbsGrams?: number | string | null;
  targetCarbsGrams?: number | string | null;
  totalFatGrams?: number | string | null;
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

@Injectable({ providedIn: 'root' })
export class FitSyncDataService {
  private readonly http = inject(HttpClient);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly accountDataService = inject(AccountDataService);

  readonly apiBaseUrl = '/api/v1';
  readonly lastSavedMessage = signal<string | null>(null);

  getDashboard(): Observable<DashboardData> {
    return forkJoin({
      analytics: this.analyticsApi.getDashboard(),
      goalProgress: this.analyticsApi.getGoalsProgress('ACTIVE'),
      user: this.accountDataService.getCurrentUser(),
      // "latest" workout/meal are optional — a brand-new user has none, and the
      // backend returns 404 for the workout one. Don't let that fail the whole
      // forkJoin (which would break the entire dashboard); treat absence as null.
      latestWorkout: this.http
        .get<Partial<WorkoutSession>>(`${this.apiBaseUrl}/workouts/sessions/latest`)
        .pipe(catchError(() => of(null))),
      latestMeal: this.http
        .get<Partial<Meal>>(`${this.apiBaseUrl}/nutrition/meals/latest`)
        .pipe(catchError(() => of(null)))
    }).pipe(
      map(({ analytics, goalProgress, user, latestWorkout, latestMeal }) => ({
        profile: this.mapProfile(user.profile),
        nutrition: this.mapAnalyticsNutrition(analytics.nutrition),
        workout: analytics.workout,
        latestWorkout: this.mapWorkoutSession(latestWorkout, { completedOnly: true }),
        latestMeal: this.mapMeal(latestMeal),
        latestBodyMetric: this.mapAnalyticsBodyMetric(analytics.body, analytics.generatedAt),
        goals: dedupeGoalsByLatestEvaluation(goalProgress.goals.map((goal) => this.mapAnalyticsGoalProgress(goal)))
      })),
      catchError(() => throwError(() => new Error('Unable to load dashboard data. Please retry.')))
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
      workout: {
        todayWorkoutCount: 1,
        weekWorkoutCount: 7,
        weekWorkoutMinutes: 300,
        activeStreakDays: 7
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

  getProgressData(range: ProgressDateRange, bucket: AnalyticsBucket = 'DAY'): Observable<ProgressData> {
    return forkJoin({
      trends: this.analyticsApi.getBodyTrends(range.startDate, range.endDate, bucket),
      goals: this.analyticsApi.getGoalsProgress('ACTIVE')
    }).pipe(
      map(({ trends, goals }) => {
        const trendRows = trends.points.map((point) => this.mapAnalyticsBodyTrendPoint(point));
        // The goal-progress read model is keyed by goalId and can hold stale rows from
        // superseded/seeded goals, so collapse to one row per type (latest evaluated) —
        // same guard the dashboard path already applies.
        const mappedGoals = dedupeGoalsByLatestEvaluation(
          goals.goals.map((goal) => this.mapAnalyticsGoalProgress(goal))
        );

        return {
          latestBodyMetric: trendRows.at(-1) ?? null,
          bodyMetrics: trendRows,
          trendPoints: trendRows,
          goals: mappedGoals
        };
      }),
      catchError(() => throwError(() => new Error('Unable to load progress data. Please retry.')))
    );
  }

  getProgressGoals(): Observable<Goal[]> {
    return this.analyticsApi.getGoalsProgress('ACTIVE').pipe(
      map((goals) => goals.goals.map((goal) => this.mapAnalyticsGoalProgress(goal))),
      catchError(() => throwError(() => new Error('Unable to load goal progress. Please retry.')))
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

  startWorkoutPlan(planId: string): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/plans/${planId}/start`, {})
      .pipe(
        map((session) => {
          const mapped = this.mapWorkoutSessionDetail(session);
          if (!mapped.sessionId) {
            throw new Error('Workout plan started but the session response was empty.');
          }
          return mapped;
        })
      );
  }

  startAdHocSession(input: StartAdHocSessionInput): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions`, {
        name: input.name,
        workoutType: input.workoutType,
        status: 'IN_PROGRESS',
        source: 'MANUAL',
        startedAt: new Date().toISOString(),
        notes: input.notes || null,
        exercises: []
      })
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  addSessionExercise(sessionId: string, input: WorkoutExerciseLogInput): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}/exercises`, input)
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  upsertSessionSet(
    sessionId: string,
    exerciseLogId: string,
    setNumber: number,
    input: WorkoutExerciseSetInput
  ): Observable<WorkoutSessionDetail> {
    return this.http
      .put<BackendWorkoutSessionDetail>(
        `${this.apiBaseUrl}/workouts/sessions/${sessionId}/exercises/${exerciseLogId}/sets/${setNumber}`,
        input
      )
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  completeSession(sessionId: string, completedAt?: string): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(
        `${this.apiBaseUrl}/workouts/sessions/${sessionId}/complete`,
        completedAt ? { completedAt } : {}
      )
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  cancelSession(sessionId: string): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}/cancel`, {})
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  getWorkoutSessions(limit = 10): Observable<WorkoutSession[]> {
    return this.getWorkoutSessionPage(limit).pipe(map((page) => page.sessions));
  }

  getWorkoutSessionPage(query: number | WorkoutSessionQuery = 10): Observable<WorkoutSessionPage> {
    const q: WorkoutSessionQuery = typeof query === 'number' ? { size: query } : query;
    const requestedPage = Math.max(0, q.page ?? 0);
    let params = new HttpParams()
      .set('size', String(this.safeWorkoutSessionPageSize(q.size ?? 10)))
      .set('page', String(requestedPage));
    if (q.status) {
      params = params.set('status', q.status);
    }
    if (q.workoutType) {
      params = params.set('workoutType', q.workoutType);
    }
    if (q.minDurationMinutes != null) {
      params = params.set('minDurationMinutes', String(q.minDurationMinutes));
    }
    if (q.maxDurationMinutes != null) {
      params = params.set('maxDurationMinutes', String(q.maxDurationMinutes));
    }
    if (q.from) {
      params = params.set('from', q.from);
    }
    if (q.to) {
      params = params.set('to', q.to);
    }
    return this.http
      .get<PageResponse<Partial<WorkoutSession>>>(`${this.apiBaseUrl}/workouts/sessions`, { params })
      .pipe(
        map((response) => {
          const sessions = (response.content ?? [])
            .map((session) => this.mapWorkoutSession(session))
            .filter((session): session is WorkoutSession => session !== null);
          return {
            sessions,
            total: response.totalElements ?? sessions.length,
            totalPages: response.totalPages ?? 1,
            page: response.number ?? requestedPage
          };
        }),
        catchError(() => of({ sessions: [], total: 0, totalPages: 1, page: requestedPage } as WorkoutSessionPage))
      );
  }

  getWorkoutSessionsInRange(fromInstant: string, toInstant: string): Observable<WorkoutSession[]> {
    const params = new HttpParams()
      .set('from', fromInstant)
      .set('to', toInstant)
      .set('size', '100');

    return this.http
      .get<PageResponse<Partial<WorkoutSession>>>(`${this.apiBaseUrl}/workouts/sessions`, { params })
      .pipe(
        map((response) =>
          (response.content ?? [])
            .map((session) =>
              this.mapWorkoutSession({
                name: session.name ?? this.defaultSessionName(session),
                caloriesBurned: null,
                exerciseCount: 0,
                ...session
              })
            )
            .filter((session): session is WorkoutSession => session !== null)
        ),
        catchError(() => of([] as WorkoutSession[]))
      );
  }

  private safeWorkoutSessionPageSize(limit: number): number {
    const parsed = Math.trunc(Number(limit));
    if (!Number.isFinite(parsed)) {
      return 10;
    }
    return Math.min(Math.max(parsed, 1), 100);
  }

  getGoals(): Observable<UserGoal[]> {
    return this.http.get<BackendUserGoal[]>(`${this.apiBaseUrl}/users/me/goals`).pipe(
      map((goals) =>
        (goals ?? [])
          .map((goal) => this.mapUserGoal(goal))
          .filter((goal): goal is UserGoal => goal !== null)
      ),
      catchError(() => of([] as UserGoal[]))
    );
  }

  upsertGoal(goalType: GoalType, request: UpsertGoalRequest): Observable<UserGoal> {
    return this.http
      .put<BackendUserGoal>(`${this.apiBaseUrl}/users/me/goals/${goalType}`, request)
      .pipe(
        map((goal) => {
          const mapped = this.mapUserGoal(goal);
          if (!mapped) {
            throw new Error('Goal response was empty or unsupported.');
          }
          return mapped;
        })
      );
  }

  deleteGoal(goalType: GoalType): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/users/me/goals/${goalType}`);
  }

  getSession(sessionId: string): Observable<WorkoutSessionDetail | null> {
    if (!sessionId) {
      return of(null);
    }

    return this.http
      .get<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}`)
      .pipe(
        map((session) => this.mapWorkoutSessionDetail(session)),
        catchError(() => of(null))
      );
  }

  updateSession(sessionId: string, request: UpsertWorkoutSessionRequest): Observable<WorkoutSessionDetail> {
    return this.http
      .put<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}`, request)
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  deleteSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}`);
  }

  repeatSession(sessionId: string): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/${sessionId}/repeat`, {})
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  repeatLatestSession(): Observable<WorkoutSessionDetail> {
    return this.http
      .post<BackendWorkoutSessionDetail>(`${this.apiBaseUrl}/workouts/sessions/repeat-latest`, {})
      .pipe(map((session) => this.mapWorkoutSessionDetail(session)));
  }

  exportWorkoutData(): Observable<WorkoutExport> {
    return this.http.get<WorkoutExport>(`${this.apiBaseUrl}/workouts/export`);
  }

  importSessions(rows: ImportSessionRow[]): Observable<ImportResult> {
    return this.http.post<ImportResult>(`${this.apiBaseUrl}/workouts/sessions/import`, { sessions: rows });
  }

  getExercises(queryOrOptions: string | ExerciseSearchOptions = ''): Observable<Exercise[]> {
    const options: ExerciseSearchOptions =
      typeof queryOrOptions === 'string' ? { q: queryOrOptions, size: 30 } : queryOrOptions;
    return this.searchExercisesPage(options).pipe(map((page) => page.items));
  }

  searchExercisesPage(options: ExerciseSearchOptions = {}): Observable<PagedExercises> {
    const page = options.page ?? 0;
    const size = options.size ?? 30;
    let params = new HttpParams()
      .set('q', options.q ?? '')
      .set('page', String(page))
      .set('size', String(size));
    if (options.exerciseType) {
      params = params.set('exerciseType', options.exerciseType);
    }
    if (options.primaryMuscleGroup) {
      params = params.set('primaryMuscleGroup', options.primaryMuscleGroup);
    }
    if (options.equipment) {
      params = params.set('equipment', options.equipment);
    }
    if (options.difficulty) {
      params = params.set('difficulty', options.difficulty);
    }

    return this.http
      .get<PageResponse<BackendExerciseView>>(`${this.apiBaseUrl}/workouts/exercises`, { params })
      .pipe(
        map((response) => {
          const items = (response.content ?? []).map((exercise) => this.mapExercise(exercise));
          return {
            items,
            page: response.number ?? page,
            size: response.size ?? size,
            totalPages: response.totalPages ?? 0,
            totalElements: response.totalElements ?? items.length
          };
        }),
        catchError(() =>
          of({
            items: [],
            page: 0,
            size,
            totalPages: 0,
            totalElements: 0
          })
        )
      );
  }

  getExercise(exerciseId: string): Observable<ExerciseDetail | null> {
    if (!exerciseId) {
      return of(null);
    }

    return this.http
      .get<BackendExerciseView>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}`)
      .pipe(
        map((exercise) => this.mapExerciseDetail(exercise)),
        catchError(() => of(null))
      );
  }

  getExerciseMetadata(): Observable<ExerciseMetadata | null> {
    return this.http.get<ExerciseMetadata>(`${this.apiBaseUrl}/workouts/exercises/metadata`).pipe(
      map((metadata) => ({
        exerciseTypes: metadata.exerciseTypes ?? [],
        muscleGroups: metadata.muscleGroups ?? [],
        equipment: metadata.equipment ?? [],
        difficulties: metadata.difficulties ?? [],
        workoutTypes: metadata.workoutTypes ?? [],
        goalFocuses: metadata.goalFocuses ?? []
      })),
      catchError(() => of(null))
    );
  }

  createExercise(request: CreateExerciseRequest): Observable<Exercise> {
    return this.http
      .post<BackendExerciseView>(`${this.apiBaseUrl}/workouts/exercises`, request)
      .pipe(map((exercise) => this.mapExercise(exercise)));
  }

  updateExercise(exerciseId: string, request: UpdateExerciseRequest): Observable<Exercise> {
    return this.http
      .put<BackendExerciseView>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}`, request)
      .pipe(map((exercise) => this.mapExercise(exercise)));
  }

  uploadExerciseVideo(exerciseId: string, file: Blob): Observable<HttpEvent<Exercise>> {
    const form = new FormData();
    form.append('file', file, 'exercise-video');
    return this.http
      .post<BackendExerciseView>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}/video`, form, {
        reportProgress: true,
        observe: 'events'
      })
      .pipe(
        map((event) => {
          if (event.type !== HttpEventType.Response) {
            return event;
          }
          return event.clone({ body: this.mapExercise(event.body ?? {}) });
        })
      );
  }

  uploadExerciseImage(exerciseId: string, file: Blob): Observable<HttpEvent<Exercise>> {
    const form = new FormData();
    form.append('file', file, 'exercise-image');
    return this.http
      .post<BackendExerciseView>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}/image`, form, {
        reportProgress: true,
        observe: 'events'
      })
      .pipe(
        map((event) => {
          if (event.type !== HttpEventType.Response) {
            return event;
          }
          return event.clone({ body: this.mapExercise(event.body ?? {}) });
        })
      );
  }

  archiveExercise(exerciseId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}`);
  }

  getExerciseRecords(exerciseId: string): Observable<ExerciseRecords | null> {
    if (!exerciseId) {
      return of(null);
    }

    return this.http
      .get<BackendExerciseRecords>(`${this.apiBaseUrl}/workouts/exercises/${exerciseId}/records`)
      .pipe(
        map((records) => this.mapExerciseRecords(records)),
        catchError(() => of(null))
      );
  }

  getExerciseHistory(
    exerciseId: string,
    opts: { from?: string; to?: string; page?: number; size?: number } = {}
  ): Observable<ExerciseHistoryEntry[]> {
    if (!exerciseId) {
      return of([] as ExerciseHistoryEntry[]);
    }

    let params = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 20));
    if (opts.from) {
      params = params.set('from', opts.from);
    }
    if (opts.to) {
      params = params.set('to', opts.to);
    }

    return this.http
      .get<PageResponse<BackendExerciseHistoryEntry>>(
        `${this.apiBaseUrl}/workouts/exercises/${exerciseId}/history`,
        { params }
      )
      .pipe(
        map((response) => (response.content ?? []).map((entry) => this.mapExerciseHistoryEntry(entry))),
        catchError(() => of([] as ExerciseHistoryEntry[]))
      );
  }

  getActivePlan(): Observable<WorkoutPlan | null> {
    return this.http
      .get<BackendWorkoutPlan>(`${this.apiBaseUrl}/workouts/plans/active`)
      .pipe(
        map((plan) => (plan?.name ? this.mapWorkoutPlan(plan) : null)),
        catchError(() => of(null))
      );
  }

  searchFoods(query: string, options: FoodSearchOptions = {}): Observable<FoodSearchResult[]> {
    return this.searchFoodsPage(query, options).pipe(map((page) => page.items));
  }

  searchFoodsPage(query: string, options: FoodSearchOptions = {}): Observable<PagedFoods> {
    const page = options.page ?? 0;
    const size = options.size ?? 20;
    let params = new HttpParams().set('q', query ?? '');
    if (options.categoryId) {
      params = params
        .set('categoryId', options.categoryId)
        .set('includeSubcategories', String(options.includeSubcategories ?? true));
    }
    if (options.verified) {
      params = params.set('verified', 'true');
    }
    params = params.set('page', String(page)).set('size', String(size));

    const shouldUseFallback = !query?.trim() && !options.categoryId && !options.verified && !options.page;
    return this.http
      .get<PageResponse<BackendFoodSearchResult>>(`${this.apiBaseUrl}/nutrition/foods/search`, { params })
      .pipe(
        map((response) => {
          const items = (response.content ?? []).map((food) => this.mapFood(food));
          return {
            items,
            page: response.number ?? page,
            size: response.size ?? size,
            totalPages: response.totalPages ?? 0,
            totalElements: response.totalElements ?? items.length
          };
        }),
        catchError(() =>
          shouldUseFallback
            ? this.getFallbackFoods().pipe(
                map((items) => ({
                  items,
                  page: 0,
                  size,
                  totalPages: items.length ? 1 : 0,
                  totalElements: items.length
                }))
              )
            : of({ items: [], page: 0, size, totalPages: 0, totalElements: 0 })
        )
      );
  }

  getFoodDetail(foodId: string): Observable<FoodDetail | null> {
    if (!foodId) {
      return of(null);
    }

    return this.http
      .get<BackendFoodDetail>(`${this.apiBaseUrl}/nutrition/foods/${foodId}`)
      .pipe(
        map((food) => this.mapFoodDetail(food)),
        catchError(() => of(null))
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
    let params = new HttpParams()
      .set('from', start.toISOString())
      .set('to', new Date().toISOString());
    if (timezone) {
      params = params.set('timezone', timezone);
    }
    return this.http
      .get<Partial<Meal>[]>(`${this.apiBaseUrl}/nutrition/meals`, { params })
      .pipe(
        map((meals) => meals.map((meal) => this.mapMeal(meal)).filter((meal): meal is Meal => meal !== null)),
        catchError(() => of([] as Meal[]))
      );
  }

  getDailyNutritionSummary(date = new Date(), timezone = this.getLocalTimezone()): Observable<NutritionSummary> {
    const params = new HttpParams()
      .set('date', this.toDateParam(date))
      .set('timezone', timezone);
    return this.http
      .get<BackendDailyNutritionSummary>(`${this.apiBaseUrl}/nutrition/summary/daily`, { params })
      .pipe(
        map((summary) => this.mapDailyNutritionSummary(summary)),
        catchError(() => of(this.emptyNutritionSummary()))
      );
  }

  getFallbackFoods(): Observable<FoodSearchResult[]> {
    return of<FoodSearchResult[]>([
      {
        foodId: null,
        displayName: 'Greek yogurt',
        brandName: 'Generic',
        categoryName: 'Dairy',
        scope: 'CATALOG',
        calories: 96,
        proteinGrams: 10,
        basisUnit: '100 g',
        basisLabel: '100 g',
        primaryBarcode: '',
        verified: true
      },
      {
        foodId: null,
        displayName: 'Grilled chicken breast',
        brandName: 'Generic',
        categoryName: 'Protein',
        scope: 'CATALOG',
        calories: 165,
        proteinGrams: 31,
        basisUnit: '100 g',
        basisLabel: '100 g',
        primaryBarcode: '',
        verified: true
      },
      {
        foodId: null,
        displayName: 'Brown rice',
        brandName: 'Generic',
        categoryName: 'Grains',
        scope: 'CATALOG',
        calories: 112,
        proteinGrams: 2.6,
        basisUnit: '100 g',
        basisLabel: '100 g',
        primaryBarcode: '',
        verified: true
      }
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

    const healthReadiness = value.parqAcknowledged
      ? {
          heartCondition: value.parqHeartCondition,
          chestPainActivity: value.parqChestPainActivity,
          dizziness: value.parqDizziness,
          boneJointIssue: value.parqBoneJointIssue,
          bpOrHeartMeds: value.parqBpOrHeartMeds,
          otherReason: value.parqOtherReason,
          injuryAreas: value.injuryAreas.filter((area) => /^[A-Z_]{2,40}$/.test(area)),
          acknowledgedDisclaimerAt: value.parqAcknowledgedAt ?? new Date().toISOString()
        }
      : undefined;

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
      fitnessLevel: value.fitnessLevel,
      trainingLocation: value.trainingLocation,
      weeklyWorkoutDays: value.weeklyWorkoutDays,
      preferredDurationMinutes: value.preferredDurationMinutes,
      preferredWorkoutTime: this.toBackendLocalTime(value.preferredWorkoutTime),
      intensityPreference: value.intensityPreference,
      equipmentInventory: value.equipmentInventory,
      focusAreas: value.focusAreas,
      dietaryPattern: value.dietaryPattern,
      mealFrequency: 4,
      calorieTrackingMode: value.calorieTrackingMode,
      macroPreference: 'BALANCED',
      waterGoalMl: 2500,
      workoutReminderEnabled: value.workoutReminderEnabled,
      mealReminderEnabled: value.mealReminderEnabled,
      weighInReminderEnabled: true,
      ...(healthReadiness ? { healthReadiness } : {})
    }).pipe(
      // Onboarding writes onboardingCompleted=true server-side; the auth guard
      // reads it from AccountDataService's cached getCurrentUser(). Without this
      // the stale (false) cache keeps bouncing the user back to /onboarding.
      tap(() => this.accountDataService.invalidateCurrentUser()),
      map(() => ({ ok: true as const }))
    );
  }

  saveWorkoutSession(value: WorkoutSessionFormValue): Observable<{ ok: true }> {
    const completedAt = new Date();
    const startedAt = new Date(completedAt.getTime() - Math.max(0, value.durationMinutes) * 60_000);

    return this.http
      .post(`${this.apiBaseUrl}/workouts/sessions`, {
        name: value.name,
        workoutType: value.workoutType,
        status: 'COMPLETED',
        source: 'MANUAL',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMinutes: value.durationMinutes,
        caloriesBurned: value.caloriesBurned,
        perceivedExertion: value.perceivedExertion,
        notes: value.notes || null,
        exercises: []
      })
      .pipe(map(() => ({ ok: true as const })));
  }

  getMealTemplates(): Observable<MealTemplate[]> {
    return this.http
      .get<BackendMealTemplate[]>(`${this.apiBaseUrl}/nutrition/meal-templates`)
      .pipe(
        map((templates) => templates.map((template) => this.mapMealTemplate(template))),
        catchError(() => of([] as MealTemplate[]))
      );
  }

  getMealTemplate(templateId: string): Observable<MealTemplate | null> {
    if (!templateId) {
      return of(null);
    }
    return this.http
      .get<BackendMealTemplate>(`${this.apiBaseUrl}/nutrition/meal-templates/${templateId}`)
      .pipe(
        map((template) => this.mapMealTemplate(template)),
        catchError(() => of(null))
      );
  }

  createMealTemplate(value: Pick<MealTemplate, 'name' | 'mealType' | 'note'> & { items: MealItemDraft[] }): Observable<MealTemplate> {
    return this.http
      .post<BackendMealTemplate>(`${this.apiBaseUrl}/nutrition/meal-templates`, {
        name: value.name,
        mealType: value.mealType,
        note: value.note || null,
        items: value.items.map((item) => this.toMealItemInput(item))
      })
      .pipe(map((template) => this.mapMealTemplate(template)));
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
          food?.displayName
            ? {
                foodId: food.foodId ?? null,
                customFoodId: null,
                foodServingId: null,
                scope: food.scope ?? 'CATALOG',
                foodName: food.displayName,
                brandName: food.brandName ?? '',
                servingLabel: food.basisUnit ?? '',
                quantity: 1,
                unit: 'serving',
                servingSize: this.numericValue(food.basisQuantity),
                servingUnit: food.basisUnit ?? null,
                calories: food.calories ?? 0,
                proteinGrams: Number(food.proteinGrams ?? 0),
                carbsGrams: Number(food.carbsGrams ?? 0),
                fatGrams: Number(food.fatGrams ?? 0),
                fiberGrams: this.numericValue(food.fiberGrams),
                sugarGrams: this.numericValue(food.sugarGrams),
                sodiumMg: this.numericValue(food.sodiumMg),
                timesLogged: 0,
                lastLoggedAt: null
              }
            : null
        ),
        catchError(() => of(null))
      );
  }

  private mapMealTemplate(template: BackendMealTemplate): MealTemplate {
    return {
      templateId: template.templateId ?? '',
      name: template.name ?? 'Saved meal',
      mealType: template.mealType ?? 'MEAL',
      note: template.note ?? '',
      totalCalories: template.totalCalories ?? 0,
      items: (template.items ?? []).map((item) => this.mapMealTemplateItem(item))
    };
  }

  private mapMealTemplateItem(item: BackendMealTemplateItem): MealTemplateItem {
    return {
      templateItemId: item.templateItemId ?? '',
      customFoodId: item.customFoodId ?? null,
      foodCatalogItemId: item.foodCatalogItemId ?? null,
      foodServingId: item.foodServingId ?? null,
      foodName: item.foodName ?? 'Food',
      brandName: item.brandName ?? null,
      quantity: this.numericValue(item.quantity) ?? 1,
      unit: item.unit ?? 'serving',
      snapshotServingLabel: item.snapshotServingLabel ?? null,
      calories: item.calories ?? 0,
      proteinGrams: this.numericValue(item.proteinGrams) ?? 0,
      carbsGrams: this.numericValue(item.carbsGrams) ?? 0,
      fatGrams: this.numericValue(item.fatGrams) ?? 0,
      fiberGrams: this.numericValue(item.fiberGrams),
      sugarGrams: this.numericValue(item.sugarGrams),
      sodiumMg: this.numericValue(item.sodiumMg)
    };
  }

  createMeal(draft: MealDraft): Observable<Meal> {
    this.lastSavedMessage.set(null);

    return this.http
      .post<Partial<Meal>>(`${this.apiBaseUrl}/nutrition/meals`, {
        mealType: draft.mealType,
        name: draft.name || null,
        source: 'MANUAL',
        consumedAt: draft.consumedAt ?? new Date().toISOString(),
        timezone: draft.timezone ?? this.getLocalTimezone(),
        note: draft.note || null,
        items: draft.items.map((item) => this.toMealItemInput(item))
      })
      .pipe(
        map((meal) => {
          this.lastSavedMessage.set('Meal saved to FitSync backend.');
          const mapped = this.mapMeal(meal);
          if (!mapped) {
            throw new Error('Meal saved, but the response was empty.');
          }
          return mapped;
        })
      );
  }

  quickAddMeal(value: QuickAddMealValue): Observable<Meal> {
    this.lastSavedMessage.set(null);

    return this.http
      .post<Partial<Meal>>(`${this.apiBaseUrl}/nutrition/meals/quick-add`, {
        mealType: value.mealType,
        name: value.name,
        consumedAt: value.consumedAt ?? new Date().toISOString(),
        timezone: value.timezone ?? this.getLocalTimezone(),
        calories: value.calories,
        proteinGrams: value.proteinGrams,
        carbsGrams: value.carbsGrams,
        fatGrams: value.fatGrams,
        fiberGrams: value.fiberGrams ?? null,
        sugarGrams: value.sugarGrams ?? null,
        sodiumMg: value.sodiumMg ?? null
      })
      .pipe(
        map((meal) => {
          this.lastSavedMessage.set('Meal saved to FitSync backend.');
          const mapped = this.mapMeal(meal);
          if (!mapped) {
            throw new Error('Meal saved, but the response was empty.');
          }
          return mapped;
        })
      );
  }

  saveMeal(value: MealFormValue): Observable<{ ok: true }> {
    return this.quickAddMeal({
      mealType: value.mealType,
      name: value.foodName,
      calories: value.calories,
      proteinGrams: value.proteinGrams,
      carbsGrams: value.carbsGrams,
      fatGrams: value.fatGrams
    }).pipe(map(() => ({ ok: true as const })));
  }

  simulateLoadError(): Observable<never> {
    return throwError(() => new Error('Unable to load FitSync data. Please retry.'));
  }

  private mapProfile(profile?: BackendUserProfile | null): UserProfile {
    return {
      displayName: profile?.displayName ?? 'FitSync User',
      firstName: profile?.firstName ?? profile?.displayName?.split(' ')[0] ?? 'FitSync',
      lastName: profile?.lastName ?? '',
      gender: profile?.gender ?? undefined,
      birthDate: profile?.birthDate ?? undefined,
      heightCm: profile?.heightCm ?? 0,
      activityLevel: profile?.activityLevel ?? 'NOT_SET',
      timezone: profile?.timezone ?? 'Asia/Singapore',
      onboardingCompleted: profile?.onboardingCompleted ?? false
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

  private toBackendLocalTime(value: string | null | undefined): string | null {
    return value ? `${value.slice(0, 5)}:00` : null;
  }

  private getLocalTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';
    } catch {
      return 'Asia/Singapore';
    }
  }

  private toDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    this.applyProfileSeed(value, profile, latestBodyMetric, weightGoal);
    this.applyAppPreferenceSeed(value, preferences?.app);
    this.applyNutritionSeed(value, preferences?.nutrition, caloriesGoal, proteinGoal);
    this.applyTrainingSeed(value, preferences?.training);
    this.applyNotificationSeed(value, preferences?.notifications);

    return {
      value,
      hasExistingBodyBaseline:
        hasCompletedOnboarding || Boolean(latestBodyMetric?.weightKg || weightGoal?.targetValue),
      hasExistingTrainingBaseline: hasCompletedOnboarding || this.hasTrainingBaseline(preferences?.training),
      hasExistingNutritionBaseline:
        hasCompletedOnboarding || Boolean(caloriesGoal?.targetValue || proteinGoal?.targetValue)
    };
  }

  private applyProfileSeed(
    value: Partial<OnboardingFormValue>,
    profile: BackendUserProfile | null | undefined,
    latestBodyMetric: Partial<BodyMetric> | null | undefined,
    weightGoal: Partial<Goal> | undefined
  ): void {
    const displayName = profile?.displayName?.trim();
    if (displayName) {
      value.displayName = displayName;
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
  }

  private applyAppPreferenceSeed(
    value: Partial<OnboardingFormValue>,
    app: BackendUserPreferences['app'] | undefined
  ): void {
    const preferredUnits = this.normalizeEnum(app?.preferredUnits, {
      '100001': 'METRIC',
      '100002': 'IMPERIAL'
    });
    if (preferredUnits) {
      value.preferredUnits = preferredUnits;
    }
  }

  private applyNutritionSeed(
    value: Partial<OnboardingFormValue>,
    nutrition: BackendUserPreferences['nutrition'] | undefined,
    caloriesGoal: Partial<Goal> | undefined,
    proteinGoal: Partial<Goal> | undefined
  ): void {
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
    if (caloriesGoal?.targetValue != null) {
      value.targetCalories = caloriesGoal.targetValue;
    }
    if (proteinGoal?.targetValue != null) {
      value.targetProteinGrams = proteinGoal.targetValue;
    }
  }

  private applyTrainingSeed(
    value: Partial<OnboardingFormValue>,
    training: BackendUserPreferences['training'] | undefined
  ): void {
    if (training?.weeklyWorkoutDays != null) {
      value.weeklyWorkoutDays = training.weeklyWorkoutDays;
    }
    const fitnessLevel = this.normalizeEnum(training?.fitnessLevel, {
      '200001': 'BEGINNER',
      '200002': 'INTERMEDIATE',
      '200003': 'ADVANCED'
    });
    if (fitnessLevel) {
      value.fitnessLevel = fitnessLevel;
    }
    const trainingLocation = this.normalizeEnum(training?.trainingLocation, {
      '210001': 'HOME',
      '210002': 'GYM',
      '210003': 'OUTDOOR',
      '210004': 'MIXED'
    });
    if (trainingLocation) {
      value.trainingLocation = trainingLocation;
    }
    if (training?.preferredDurationMinutes != null) {
      value.preferredDurationMinutes = training.preferredDurationMinutes;
    }
    if (training?.preferredWorkoutTime) {
      value.preferredWorkoutTime = training.preferredWorkoutTime.slice(0, 5);
    }
    const intensityPreference = this.normalizeEnum(training?.intensityPreference, {
      '220001': 'LOW',
      '220002': 'MODERATE',
      '220003': 'HIGH'
    });
    if (intensityPreference) {
      value.intensityPreference = intensityPreference;
    }
    const equipmentInventory = this.normalizeEnumList(training?.equipmentInventory, {
      '230001': 'NONE',
      '230002': 'DUMBBELLS',
      '230003': 'BARBELL',
      '230004': 'BANDS',
      '230005': 'PULL_UP_BAR',
      '230006': 'KETTLEBELL',
      '230007': 'MACHINES',
      '230008': 'FULL_GYM'
    });
    if (equipmentInventory.length) {
      value.equipmentInventory = equipmentInventory;
    }
    const focusAreas = this.normalizeEnumList(training?.focusAreas, {
      '240001': 'FULL_BODY',
      '240002': 'UPPER',
      '240003': 'CORE',
      '240004': 'LOWER',
      '240005': 'MOBILITY',
      '240006': 'CARDIO'
    });
    if (focusAreas.length) {
      value.focusAreas = focusAreas;
    }
  }

  private applyNotificationSeed(
    value: Partial<OnboardingFormValue>,
    notifications: BackendUserPreferences['notifications'] | undefined
  ): void {
    if (notifications?.workoutReminderEnabled != null) {
      value.workoutReminderEnabled = notifications.workoutReminderEnabled;
    }
    if (notifications?.mealReminderEnabled != null) {
      value.mealReminderEnabled = notifications.mealReminderEnabled;
    }
  }

  private hasTrainingBaseline(training: BackendUserPreferences['training'] | undefined): boolean {
    return Boolean(
      training?.weeklyWorkoutDays ||
      training?.fitnessLevel ||
      training?.trainingLocation ||
      training?.preferredDurationMinutes ||
      training?.preferredWorkoutTime ||
      training?.intensityPreference ||
      training?.equipmentInventory?.length ||
      training?.focusAreas?.length
    );
  }

  private normalizeEnum(value: string | null | undefined, codeMap: Record<string, string>): string | undefined {
    if (!value) {
      return undefined;
    }
    return codeMap[value] ?? value.toUpperCase();
  }

  private normalizeEnumList(values: string[] | null | undefined, codeMap: Record<string, string>): string[] {
    return (values ?? [])
      .map((value) => this.normalizeEnum(value, codeMap))
      .filter((value): value is string => Boolean(value));
  }

  private mapWorkoutSession(
    session?: Partial<WorkoutSession> | null,
    options: { completedOnly?: boolean } = {}
  ): WorkoutSession | null {
    if (!session?.name) {
      return null;
    }

    const status = session.status ?? 'COMPLETED';
    if (options.completedOnly && status !== 'COMPLETED') {
      return null;
    }

    return {
      sessionId: session.sessionId ?? null,
      planId: session.planId ?? null,
      name: session.name,
      workoutType: session.workoutType ?? 'CUSTOM',
      status,
      source: session.source ?? null,
      startedAt: session.startedAt ?? '',
      durationMinutes: session.durationMinutes ?? null,
      caloriesBurned: session.caloriesBurned ?? null,
      completedAt: session.completedAt ?? '',
      exerciseCount: session.exerciseCount ?? 0
    };
  }

  private defaultSessionName(session?: Partial<WorkoutSession> | null): string {
    const type = session?.workoutType?.replaceAll('_', ' ').toLowerCase() ?? '';
    if (!type) {
      return 'Workout session';
    }
    return type.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private mapWorkoutSessionDetail(session: BackendWorkoutSessionDetail): WorkoutSessionDetail {
    const base = this.mapWorkoutSession(session) ?? {
      sessionId: session.sessionId ?? null,
      planId: session.planId ?? null,
      name: session.name ?? 'Workout session',
      workoutType: session.workoutType ?? 'CUSTOM',
      status: session.status ?? 'IN_PROGRESS',
      source: session.source ?? null,
      startedAt: session.startedAt ?? '',
      durationMinutes: session.durationMinutes ?? null,
      caloriesBurned: session.caloriesBurned ?? null,
      completedAt: session.completedAt ?? '',
      exerciseCount: session.exerciseCount ?? session.exercises?.length ?? 0
    };

    const exercises = (session.exercises ?? []).map((exercise) => this.mapWorkoutExerciseLog(exercise));
    return {
      ...base,
      exerciseCount: session.exerciseCount ?? exercises.length,
      perceivedExertion: session.perceivedExertion ?? null,
      notes: session.notes ?? '',
      exercises,
      createdAt: session.createdAt ?? '',
      updatedAt: session.updatedAt ?? ''
    };
  }

  private mapWorkoutExerciseLog(exercise: BackendWorkoutExerciseLog) {
    return {
      exerciseLogId: exercise.exerciseLogId ?? '',
      exerciseId: exercise.exerciseId ?? '',
      exerciseNameSnapshot: exercise.exerciseNameSnapshot ?? 'Exercise',
      sequence: exercise.sequence ?? 1,
      performedSets: exercise.performedSets ?? null,
      performedReps: exercise.performedReps ?? null,
      totalVolumeKg: this.numericValue(exercise.totalVolumeKg),
      distanceKm: this.numericValue(exercise.distanceKm),
      durationSeconds: exercise.durationSeconds ?? null,
      averageHeartRate: exercise.averageHeartRate ?? null,
      maxHeartRate: exercise.maxHeartRate ?? null,
      notes: exercise.notes ?? '',
      sets: (exercise.sets ?? []).map((set) => this.mapWorkoutExerciseSetLog(set)),
      videoUrl: exercise.videoUrl ?? null,
      animationUrl: exercise.animationUrl ?? null,
      images: this.mapExerciseImages(exercise.images)
    };
  }

  private mapWorkoutExerciseSetLog(set: BackendWorkoutExerciseSetLog) {
    return {
      setLogId: set.setLogId ?? '',
      setNumber: set.setNumber ?? 1,
      reps: set.reps ?? null,
      weightKg: this.numericValue(set.weightKg),
      durationSeconds: set.durationSeconds ?? null,
      distanceKm: this.numericValue(set.distanceKm),
      restSeconds: set.restSeconds ?? null,
      perceivedExertion: set.perceivedExertion ?? null,
      logged: set.logged ?? false,
      notes: set.notes ?? ''
    };
  }

  private mapExercise(exercise: BackendExerciseView): Exercise {
    return {
      exerciseId: exercise.exerciseId ?? null,
      code: exercise.code ?? '',
      name: exercise.name ?? 'Exercise',
      description: exercise.description ?? '',
      exerciseType: exercise.exerciseType ?? '',
      primaryMuscleGroup: exercise.primaryMuscleGroup ?? '',
      equipment: exercise.equipment ?? '',
      difficulty: exercise.difficulty ?? '',
      status: exercise.status ?? 'ACTIVE',
      custom: exercise.custom ?? false,
      videoUrl: exercise.videoUrl ?? null,
      animationUrl: exercise.animationUrl ?? null,
      images: this.mapExerciseImageDetails(exercise.images),
      imageUrls: this.mapExerciseImages(exercise.images),
      instructions: this.mapExerciseInstructions(exercise.instructions),
      secondaryMuscleGroups: exercise.secondaryMuscleGroups ?? []
    };
  }

  private mapExerciseDetail(exercise: BackendExerciseView): ExerciseDetail {
    const mapped = this.mapExercise(exercise);
    return {
      ...mapped,
      images: mapped.images ?? [],
      imageUrls: mapped.imageUrls ?? [],
      instructions: mapped.instructions ?? [],
      secondaryMuscleGroups: mapped.secondaryMuscleGroups ?? []
    };
  }

  private mapExerciseRecords(records?: BackendExerciseRecords | null): ExerciseRecords | null {
    if (!records) {
      return null;
    }

    return {
      exerciseId: records.exerciseId ?? '',
      exerciseName: records.exerciseName ?? 'Exercise',
      maxWeightKg: this.mapExerciseRecordValue(records.maxWeightKg),
      maxReps: this.mapExerciseRecordValue(records.maxReps),
      maxSingleSetVolumeKg: this.mapExerciseRecordValue(records.maxSingleSetVolumeKg),
      estimatedOneRepMaxKg: this.mapExerciseRecordValue(records.estimatedOneRepMaxKg),
      bestSessionVolumeKg: this.mapExerciseRecordValue(records.bestSessionVolumeKg)
    };
  }

  private mapExerciseRecordValue(record?: BackendExerciseRecordValue | null): ExerciseRecordValue | null {
    if (!record) {
      return null;
    }

    return {
      value: this.numericValue(record.value),
      sessionId: record.sessionId ?? '',
      achievedAt: record.achievedAt ?? ''
    };
  }

  private mapExerciseHistoryEntry(entry: BackendExerciseHistoryEntry): ExerciseHistoryEntry {
    return {
      sessionId: entry.sessionId ?? '',
      exerciseLogId: entry.exerciseLogId ?? '',
      setLogId: entry.setLogId ?? '',
      exerciseId: entry.exerciseId ?? '',
      exerciseNameSnapshot: entry.exerciseNameSnapshot ?? 'Exercise',
      sessionName: entry.sessionName ?? '',
      startedAt: entry.startedAt ?? '',
      completedAt: entry.completedAt ?? '',
      sequence: entry.sequence ?? null,
      setNumber: entry.setNumber ?? null,
      reps: entry.reps ?? null,
      weightKg: this.numericValue(entry.weightKg),
      durationSeconds: entry.durationSeconds ?? null,
      distanceKm: this.numericValue(entry.distanceKm),
      restSeconds: entry.restSeconds ?? null,
      perceivedExertion: entry.perceivedExertion ?? null,
      notes: entry.notes ?? ''
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

  /**
   * `measuredAt` is the day the user was actually weighed. It used to be filled with the dashboard
   * snapshot's `generatedAt`, i.e. when analytics last ran, because the payload carried no
   * measurement date at all. The card is headed "Latest body metric", so that was simply the wrong
   * date; the backend now sends `measuredOn`.
   */
  private mapAnalyticsBodyMetric(body: AnalyticsDashboardBody, generatedAt: string): BodyMetric | null {
    if (body.latestWeightKg == null && body.bmi == null && body.latestBodyFatRate == null) {
      return null;
    }

    return {
      weightKg: body.latestWeightKg ?? 0,
      bodyFatRate: body.latestBodyFatRate ?? 0,
      bmi: body.bmi ?? 0,
      measuredAt: body.measuredOn ?? null
    };
  }

  private mapAnalyticsNutrition(nutrition: AnalyticsDashboardNutrition): NutritionSummary {
    return {
      totalCalories: nutrition.todayCaloriesConsumed ?? 0,
      targetCalories: nutrition.todayCaloriesTarget,
      totalProteinGrams: nutrition.todayProteinGrams ?? 0,
      targetProteinGrams: nutrition.todayProteinTargetGrams,
      totalCarbsGrams: 0,
      targetCarbsGrams: null,
      totalFatGrams: 0,
      targetFatGrams: null,
      mealCount: nutrition.todayCaloriesConsumed == null && nutrition.todayProteinGrams == null ? 0 : 1,
      totalFiberGrams: null,
      totalSugarGrams: null,
      totalSodiumMg: null,
      fiberTargetGrams: null,
      sugarLimitGrams: null,
      sodiumLimitMg: null,
      fiberTargetMet: null,
      sugarWithinLimit: null,
      sodiumWithinLimit: null
    };
  }

  private mapAnalyticsBodyTrendPoint(point: AnalyticsBodyTrendPoint): ProgressBodyMetric {
    return {
      weightKg: point.weightKg,
      bodyFatRate: point.bodyFatRate,
      bmi: point.bmi,
      waistCm: point.waistCm,
      measuredAt: point.date
    };
  }

  private mapAnalyticsGoalProgress(goal: AnalyticsGoalProgress): Goal {
    return {
      goalId: goal.goalId,
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      targetUnit: goal.targetUnit,
      targetDate: goal.targetDate,
      status: goal.goalStatus,
      progressRatio: goal.progressRatio,
      onTrack: goal.onTrack,
      expired: goal.expired ?? false,
      currentValue: goal.currentValue,
      daysRemaining: goal.daysRemaining,
      lastEvaluatedAt: goal.lastEvaluatedAt
    };
  }

  private mapUserGoal(goal: BackendUserGoal): UserGoal | null {
    if (!this.isGoalType(goal.goalType) || !this.isGoalStatus(goal.status)) {
      return null;
    }

    return {
      goalId: goal.goalId ?? null,
      goalType: goal.goalType,
      targetValue: this.numericValue(goal.targetValue),
      targetUnit: goal.targetUnit ?? null,
      targetDate: goal.targetDate ?? null,
      status: goal.status,
      notes: goal.notes ?? null
    };
  }

  private isGoalType(value: string | null | undefined): value is GoalType {
    return GOAL_TYPES.includes(value as GoalType);
  }

  private isGoalStatus(value: string | null | undefined): value is GoalStatus {
    return GOAL_STATUSES.includes(value as GoalStatus);
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

  private mapExerciseImages(images: BackendExerciseImage[] | string[] | null | undefined): string[] {
    return this.mapExerciseImageDetails(images).map((image) => image.url);
  }

  private mapExerciseImageDetails(images: BackendExerciseImage[] | string[] | null | undefined): ExerciseImage[] {
    return (images ?? [])
      .map((image, index) => {
        if (typeof image === 'string') {
          return { position: index, url: image };
        }
        return {
          position: image.position ?? index,
          url: image.url ?? image.imageUrl ?? image.mediaUrl ?? ''
        };
      })
      .filter((image) => image.url.trim().length > 0)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  private mapExerciseInstructions(instructions: BackendExerciseInstruction[] | null | undefined) {
    return (instructions ?? [])
      .map((instruction, index) => ({
        stepNumber: instruction.stepNumber ?? index + 1,
        text: instruction.text?.trim() ?? ''
      }))
      .filter((instruction) => instruction.text.length > 0)
      .sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0));
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
      videoUrl: exercise.videoUrl ?? null,
      animationUrl: exercise.animationUrl ?? null,
      primaryImageUrl: exercise.primaryImageUrl ?? null,
      images: this.mapExerciseImages(exercise.images),
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

  private toMealItemInput(item: MealItemDraft): Record<string, unknown> {
    return {
      foodCatalogItemId: item.foodCatalogItemId ?? null,
      customFoodId: item.customFoodId ?? null,
      foodServingId: item.foodServingId ?? null,
      foodName: item.foodName,
      brandName: item.brandName || null,
      quantity: item.quantity,
      unit: item.unit,
      servingSize: item.servingSize,
      servingUnit: item.servingUnit,
      snapshotServingLabel: item.snapshotServingLabel,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      carbsGrams: item.carbsGrams,
      fatGrams: item.fatGrams,
      fiberGrams: item.fiberGrams,
      sugarGrams: item.sugarGrams,
      sodiumMg: item.sodiumMg
    };
  }

  private mapFood(food: BackendFoodSearchResult): FoodSearchResult {
    return {
      foodId: food.foodId ?? null,
      displayName: food.displayName ?? 'Food',
      brandName: food.brandName ?? '',
      categoryName: food.categoryName ?? null,
      scope: food.scope ?? 'CATALOG',
      calories: food.calories ?? 0,
      // Search results carry calories + basis only; macros require the food detail
      // endpoint, so leave protein at 0 until the user picks a detailed/recent food.
      proteinGrams: food.proteinGrams ?? 0,
      basisUnit: food.basisLabel ?? food.basisUnit ?? 'serving',
      basisLabel: food.basisLabel ?? food.basisUnit ?? 'serving',
      primaryBarcode: food.primaryBarcode ?? '',
      verified: food.verified ?? false
    };
  }

  private mapFoodDetail(food: BackendFoodDetail): FoodDetail {
    const basisQuantity = this.numericValue(food.basisQuantity) ?? 100;
    const basisUnit = food.basisUnit ?? 'g';
    const servings = (food.servings ?? [])
      .map((serving) => this.mapFoodServing(serving))
      .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0));

    return {
      foodId: food.foodId ?? null,
      displayName: food.displayName ?? 'Food',
      brandName: food.brandName ?? '',
      categoryName: food.categoryName ?? null,
      scope: food.scope ?? 'CATALOG',
      calories: food.calories ?? 0,
      proteinGrams: this.numericValue(food.proteinGrams) ?? 0,
      carbsGrams: this.numericValue(food.carbsGrams) ?? 0,
      fatGrams: this.numericValue(food.fatGrams) ?? 0,
      fiberGrams: this.numericValue(food.fiberGrams),
      sugarGrams: this.numericValue(food.sugarGrams),
      sodiumMg: this.numericValue(food.sodiumMg),
      basisQuantity,
      basisUnit,
      densityGramsPerMl: this.numericValue(food.densityGramsPerMl),
      primaryBarcode: food.primaryBarcode ?? '',
      sourceDataset: food.sourceDataset ?? null,
      servings: servings.length
        ? servings
        : [
            {
              servingId: null,
              label: `${basisQuantity} ${basisUnit}`.trim(),
              quantity: basisQuantity,
              unit: basisUnit,
              gramsEquivalent: this.isGramUnit(basisUnit) ? basisQuantity : null,
              millilitersEquivalent: this.isMilliliterUnit(basisUnit) ? basisQuantity : null,
              sortOrder: 0,
              defaultServing: true
            }
          ]
    };
  }

  private mapFoodServing(serving: BackendFoodServing): FoodServing {
    return {
      servingId: serving.servingId ?? null,
      label: serving.label ?? 'Serving',
      quantity: this.numericValue(serving.quantity),
      unit: serving.unit ?? null,
      gramsEquivalent: this.numericValue(serving.gramsEquivalent),
      millilitersEquivalent: this.numericValue(serving.millilitersEquivalent),
      sortOrder: serving.sortOrder ?? null,
      defaultServing: serving.defaultServing ?? false
    };
  }

  private mapLoggedFood(food: BackendLoggedFood): LoggedFood {
    return {
      foodId: food.foodCatalogItemId ?? food.foodId ?? null,
      customFoodId: food.customFoodId ?? null,
      foodServingId: food.foodServingId ?? null,
      scope: food.scope ?? (food.customFoodId ? 'USER' : 'CATALOG'),
      foodName: food.foodName ?? 'Food',
      brandName: food.brandName ?? '',
      servingLabel: food.snapshotServingLabel ?? (food.servingSize ? `${food.servingSize} ${food.servingUnit ?? ''}`.trim() : ''),
      quantity: this.numericValue(food.quantity) ?? 1,
      unit: food.unit ?? 'serving',
      servingSize: this.numericValue(food.servingSize),
      servingUnit: food.servingUnit ?? null,
      calories: food.calories ?? 0,
      proteinGrams: Number(food.proteinGrams ?? 0),
      carbsGrams: Number(food.carbsGrams ?? 0),
      fatGrams: Number(food.fatGrams ?? 0),
      fiberGrams: this.numericValue(food.fiberGrams),
      sugarGrams: this.numericValue(food.sugarGrams),
      sodiumMg: this.numericValue(food.sodiumMg),
      timesLogged: Number(food.timesLogged ?? 0),
      lastLoggedAt: food.lastLoggedAt ?? null
    };
  }

  private mapDailyNutritionSummary(summary: BackendDailyNutritionSummary): NutritionSummary {
    return {
      totalCalories: summary.totalCalories ?? 0,
      targetCalories: summary.targetCalories ?? null,
      totalProteinGrams: this.numericValue(summary.totalProteinGrams) ?? 0,
      targetProteinGrams: this.numericValue(summary.targetProteinGrams),
      totalCarbsGrams: this.numericValue(summary.totalCarbsGrams) ?? 0,
      targetCarbsGrams: this.numericValue(summary.targetCarbsGrams),
      totalFatGrams: this.numericValue(summary.totalFatGrams) ?? 0,
      targetFatGrams: this.numericValue(summary.targetFatGrams),
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

  private emptyNutritionSummary(): NutritionSummary {
    return {
      totalCalories: 0,
      targetCalories: null,
      totalProteinGrams: 0,
      targetProteinGrams: null,
      totalCarbsGrams: 0,
      targetCarbsGrams: null,
      totalFatGrams: 0,
      targetFatGrams: null,
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
    };
  }

  private isGramUnit(unit: string): boolean {
    const normalized = unit.trim().toLowerCase();
    return normalized === 'g' || normalized === 'gram' || normalized === 'grams';
  }

  private isMilliliterUnit(unit: string): boolean {
    const normalized = unit.trim().toLowerCase();
    return normalized === 'ml' || normalized === 'milliliter' || normalized === 'milliliters';
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
