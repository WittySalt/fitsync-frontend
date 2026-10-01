export interface UserProfile {
  displayName: string;
  firstName: string;
  lastName: string;
  gender?: string;
  birthDate?: string;
  heightCm: number;
  activityLevel: string;
  timezone: string;
  onboardingCompleted: boolean;
  /** The focus areas chosen at setup, as onboarding names them (UPPER, LOWER, CORE and so on).
   *  Absent where a profile is built without the preferences. */
  focusAreas?: string[];
}

export interface OnboardingFormValue {
  primaryGoal: string;
  displayName: string;
  gender: string;
  birthDate: string;
  preferredUnits: string;
  heightCm: number | null;
  heightFt: number | null;
  heightIn: number | null;
  currentWeightKg: number | null;
  currentWeightLb: number | null;
  targetWeightKg: number | null;
  targetWeightLb: number | null;
  weeklyPaceKg: number | null;
  activityLevel: string;
  weeklyWorkoutDays: number | null;
  fitnessLevel: string;
  trainingLocation: string;
  preferredDurationMinutes: number | null;
  preferredWorkoutTime: string;
  intensityPreference: string;
  equipmentInventory: string[];
  focusAreas: string[];
  parqHeartCondition: boolean;
  parqChestPainActivity: boolean;
  parqDizziness: boolean;
  parqBoneJointIssue: boolean;
  parqBpOrHeartMeds: boolean;
  parqOtherReason: boolean;
  injuryAreas: string[];
  parqAcknowledged: boolean;
  parqAcknowledgedAt: string | null;
  dietaryPattern: string;
  calorieTrackingMode: string;
  targetCalories: number | null;
  targetProteinGrams: number | null;
  targetCarbsGrams: number | null;
  targetFatGrams: number | null;
  projectedTargetDate: string | null;
  workoutReminderEnabled: boolean;
  mealReminderEnabled: boolean;
}

export interface OnboardingSeed {
  value: Partial<OnboardingFormValue>;
  hasExistingBodyBaseline: boolean;
  hasExistingTrainingBaseline: boolean;
  hasExistingNutritionBaseline: boolean;
}

export interface NutritionSummary {
  totalCalories: number;
  targetCalories: number | null;
  totalProteinGrams: number;
  targetProteinGrams: number | null;
  totalCarbsGrams: number;
  targetCarbsGrams: number | null;
  totalFatGrams: number;
  targetFatGrams: number | null;
  mealCount: number;
  totalFiberGrams: number | null;
  totalSugarGrams: number | null;
  totalSodiumMg: number | null;
  fiberTargetGrams: number | null;
  sugarLimitGrams: number | null;
  sodiumLimitMg: number | null;
  fiberTargetMet: boolean | null;
  sugarWithinLimit: boolean | null;
  sodiumWithinLimit: boolean | null;
}

export interface WorkoutSession {
  sessionId?: string | null;
  planId?: string | null;
  name: string;
  workoutType: string;
  status: string;
  source?: string | null;
  startedAt: string;
  durationMinutes: number | null;
  caloriesBurned: number | null;
  completedAt: string;
  exerciseCount: number;
  /** Set when the backend classifies the session; a sport session also names its activity. */
  kind?: string | null;
  sportActivity?: string | null;
  sportLabel?: string | null;
  distanceKm?: number | null;
}

export interface WorkoutSessionPage {
  sessions: WorkoutSession[];
  total: number;
  totalPages: number;
  page: number;
}

export interface WorkoutSessionQuery {
  status?: string;
  workoutType?: string;
  minDurationMinutes?: number | null;
  maxDurationMinutes?: number | null;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface WorkoutSessionFormValue {
  name: string;
  workoutType: string;
  durationMinutes: number;
  caloriesBurned: number;
  perceivedExertion: number | null;
  notes: string;
  /** Required by the backend for a SPORTS session and sent for no other type. */
  sportActivity?: string;
  distanceKm?: number;
}

export interface StartAdHocSessionInput {
  name: string;
  workoutType: string;
  notes?: string | null;
}

export interface WorkoutSessionDetail extends WorkoutSession {
  perceivedExertion: number | null;
  notes: string;
  exercises: WorkoutExerciseLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExerciseLog {
  exerciseLogId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  sequence: number;
  performedSets: number | null;
  performedReps: number | null;
  totalVolumeKg: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  notes: string;
  sets: WorkoutExerciseSetLog[];
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: string[];
}

export interface WorkoutExerciseSetLog {
  setLogId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
  perceivedExertion: number | null;
  logged: boolean;
  notes: string;
}

export interface WorkoutExerciseLogInput {
  exerciseId: string;
  sequence: number;
  performedSets: number | null;
  performedReps: number | null;
  totalVolumeKg: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  notes: string | null;
  sets: WorkoutExerciseSetInput[];
}

export interface WorkoutExerciseSetInput {
  setNumber?: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
  perceivedExertion: number | null;
  notes: string | null;
}

export interface UpsertWorkoutSessionRequest {
  planId: string | null;
  name: string;
  workoutType: string;
  status: string;
  source: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes: number | null;
  caloriesBurned: number | null;
  perceivedExertion: number | null;
  notes: string | null;
  exercises: WorkoutExerciseLogInput[];
  sportActivity?: string | null;
  distanceKm?: number | null;
}

export interface WorkoutExport {
  schemaVersion: number;
  exportedAt: string;
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSessionDetail[];
}

export interface ImportSessionRow {
  externalId: string;
  source: string;
  planId: string | null;
  name: string;
  workoutType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes: number | null;
  caloriesBurned: number | null;
  perceivedExertion: number | null;
  notes: string | null;
  exercises: WorkoutExerciseLogInput[];
}

export interface ImportSessionRowResult {
  rowIndex: number;
  externalId: string;
  source: string;
  status: 'IMPORTED' | 'SKIPPED_DUPLICATE' | 'REJECTED';
  sessionId: string | null;
  reason: string | null;
}

export interface ImportResult {
  imported: number;
  skippedDuplicate: number;
  rejected: number;
  results: ImportSessionRowResult[];
}

export interface Exercise {
  exerciseId: string | null;
  code: string;
  name: string;
  description: string;
  exerciseType: string;
  primaryMuscleGroup: string;
  equipment: string;
  difficulty: string;
  status: string;
  custom: boolean;
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: ExerciseImage[];
  imageUrls?: string[];
  instructions?: ExerciseInstruction[];
  secondaryMuscleGroups?: string[];
}

export interface ExerciseImage {
  position: number | null;
  url: string;
}

export interface ExerciseInstruction {
  stepNumber: number | null;
  text: string;
}

export interface ExerciseDetail extends Exercise {
  images: ExerciseImage[];
  imageUrls: string[];
  instructions: ExerciseInstruction[];
  secondaryMuscleGroups: string[];
}

export interface ExerciseMetadata {
  exerciseTypes: string[];
  muscleGroups: string[];
  equipment: string[];
  difficulties: string[];
  workoutTypes: string[];
  goalFocuses: string[];
  /** The sports a plan day can be set to; empty when the backend does not list them. */
  sportActivities: SportActivityOption[];
}

export interface SportActivityOption {
  code: string;
  label: string;
  effort: string;
  measure: string;
}

export interface ExerciseSearchOptions {
  q?: string;
  exerciseType?: string;
  primaryMuscleGroup?: string;
  equipment?: string;
  difficulty?: string;
  page?: number;
  size?: number;
}

export interface PagedExercises {
  items: Exercise[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export interface CreateExerciseRequest {
  code: string;
  name: string;
  description: string;
  exerciseType: string;
  primaryMuscleGroup: string;
  equipment: string;
  difficulty: string;
  videoUrl?: string | null;
}

export type UpdateExerciseRequest = Omit<CreateExerciseRequest, 'code'>;

export interface ExerciseRecordValue {
  value: number | null;
  sessionId: string;
  achievedAt: string;
}

export interface ExerciseRecords {
  exerciseId: string;
  exerciseName: string;
  maxWeightKg: ExerciseRecordValue | null;
  maxReps: ExerciseRecordValue | null;
  maxSingleSetVolumeKg: ExerciseRecordValue | null;
  estimatedOneRepMaxKg: ExerciseRecordValue | null;
  bestSessionVolumeKg: ExerciseRecordValue | null;
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  exerciseLogId: string;
  setLogId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  sessionName: string;
  startedAt: string;
  completedAt: string;
  sequence: number | null;
  setNumber: number | null;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
  perceivedExertion: number | null;
  notes: string;
}

export interface Meal {
  mealId: string;
  mealType: string;
  name: string;
  totalCalories: number;
  totalProteinGrams: number;
  consumedAt: string;
  itemCount: number;
}

export interface BodyMetric {
  weightKg: number;
  bodyFatRate: number;
  bmi: number;
  /** ISO date of the measurement. Null when the reading carries no date of its own; the caption
   *  is then omitted rather than filled with an unrelated timestamp. */
  measuredAt: string | null;
  /** Change in weight over the last 30 days in kilograms, negative when the person lost weight.
   *  Null when the analytics snapshot has no earlier reading to compare with. */
  weightChange30dKg?: number | null;
  /** Waist in centimetres when the person records it. The dashboard snapshot does not carry it yet. */
  waistCm?: number | null;
}

export interface Goal {
  goalId?: string | null;
  goalType: string;
  targetValue: number;
  targetUnit: string;
  targetDate: string;
  status: string;
  progressRatio: number;
  onTrack?: boolean | null;
  /** True once targetDate has passed. Rendered as overdue instead of a progress claim. */
  expired?: boolean | null;
  currentValue?: number | null;
  daysRemaining?: number | null;
  lastEvaluatedAt?: string | null;
}

export const GOAL_TYPES = ['WEIGHT', 'CALORIES', 'PROTEIN', 'CARBS', 'FAT', 'WORKOUT_FREQUENCY'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface UserGoal {
  goalId: string | null;
  goalType: GoalType;
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  status: GoalStatus;
  notes: string | null;
}

export interface UpsertGoalRequest {
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  status: GoalStatus;
  notes: string | null;
}

export interface WorkoutPlan {
  planId: string | null;
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number;
  status: string;
  exerciseCount: number;
  exercises: WorkoutPlanExercise[];
  /** The week laid out day by day. Empty for a plan that only has a flat exercise list. */
  days?: WorkoutPlanDay[];
  /** Number of training days in the week; null for a plan without a weekly layout. */
  sessionsPerWeek?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** The four kinds a plan day can have. A day that is not listed is a rest day. */
export type PlanDayKind = SessionKindCode;

/** One training day of a plan's week. A sport day names its activity and carries no exercises. */
export interface WorkoutPlanDay {
  planDayId: string;
  /** 1 for Monday through 7 for Sunday. */
  dayOfWeek: number;
  kind: SessionKindCode;
  title: string;
  sportActivity: string | null;
  sportLabel: string | null;
  estimatedDurationMinutes: number | null;
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutPlanExercise {
  planExerciseId?: string | null;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  sequence: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  restSeconds: number | null;
  notes: string;
  setTargets: WorkoutPlanExerciseSetTarget[];
  /** Thumbnail carried on the plan itself, so rendering one needs no extra request. */
  primaryImageUrl?: string | null;
  videoUrl?: string | null;
  animationUrl?: string | null;
  images?: string[];
}

export interface WorkoutPlanExerciseSetTarget {
  setTargetId?: string | null;
  setNumber: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  restSeconds: number | null;
}

export type WorkoutPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface WorkoutPlanExerciseInput {
  exerciseId: string;
  sequence: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  restSeconds: number | null;
  notes: string;
  setTargets: WorkoutPlanExerciseSetTargetInput[];
}

export interface WorkoutPlanExerciseSetTargetInput {
  setNumber: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
  restSeconds: number | null;
}

export interface WorkoutPlanDayRequest {
  planDayId?: string | null;
  dayOfWeek: number;
  kind: PlanDayKind;
  title: string;
  sportActivity?: string | null;
  estimatedDurationMinutes?: number | null;
  exercises: WorkoutPlanExerciseInput[];
}

export interface WorkoutPlanRequest {
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  exercises: WorkoutPlanExerciseInput[];
  /** A week of days. When present the top-level exercises must be empty. */
  days?: WorkoutPlanDayRequest[];
}

export type MuscleGroupCode = 'FULL_BODY' | 'CHEST' | 'BACK' | 'SHOULDERS' | 'ARMS' | 'CORE' | 'GLUTES' | 'LEGS' | 'CARDIO';

export interface MuscleGroupInsight {
  muscleGroup: MuscleGroupCode;
  sessionsThisWeek: number;
  inActivePlan: boolean;
  trainedYesterday: boolean;
  lastTrainedOn: string | null; // YYYY-MM-DD
  consecutiveSessions: number;
  exerciseNames: string[];
}

export interface WeeklyVolume {
  thisWeekKg: number;
  previousWeekKg: number;
  weekBeforePreviousKg: number;
  thisWeekSessionsWithVolume: number;
  previousWeekSessionsWithVolume: number;
}

export interface WeeklyTrainingInsight {
  timezone: string;
  referenceDate: string;
  weekStart: string;
  weekEnd: string;
  completedSessions: number;
  totalMinutes: number;
  previousWeekCompletedSessions: number;
  previousWeekTotalMinutes: number;
  muscleGroups: MuscleGroupInsight[];
  volume: WeeklyVolume;
  // The three fields below arrive once the day-kinds backend work ships. Until then the response
  // carries none of them, and every reader of this interface must treat that as a valid, quiet
  // fallback rather than an error.
  days: DayInsight[] | null;
  today: TodayInsight | null;
  nextTraining: NextTraining | null;
  /** The time of day the person usually starts training, as the backend sends it ("18:30", 24-hour).
   *  Null when the records do not show a usual time; absent on a response from before the field. */
  usualStartTime?: string | null;
}

/** The four kinds of training day, plus the two states a day can be in without one. */
export type DayKind = 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'SPORT' | 'REST' | 'OPEN';

/** Where a day's kind came from, in the order the backend prefers them. */
export type DaySource = 'DONE' | 'IN_PROGRESS' | 'PLAN' | 'HABIT' | 'NONE';

/** The four kinds a single session, planned day, or carried-over day can take (never REST or OPEN,
 *  since those describe a day with no training, not a training entry itself). */
export type SessionKindCode = 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'SPORT';

export interface DaySessionInsight {
  sessionId: string;
  kind: SessionKindCode;
  label: string;
  sportActivity: string | null;
  status: string;
  minutes: number | null;
  distanceKm: number | null;
  planDayId: string | null;
}

/** What the active plan schedules for a day, whether or not it has been done yet. */
export interface PlannedDay {
  planDayId: string;
  kind: SessionKindCode;
  title: string;
  sportActivity: string | null;
  estimatedMinutes: number | null;
  moves: number | null;
  fulfilled: boolean;
}

export interface DayInsight {
  date: string;
  dayOfWeek: number;
  kind: DayKind;
  label: string;
  source: DaySource;
  minutes: number | null;
  sessions: DaySessionInsight[];
  planned: PlannedDay | null;
}

/** The most recent earlier session of today's kind, used for the "last time" comparisons. */
export interface LastOfKind {
  date: string;
  minutes: number | null;
  distanceKm: number | null;
  paceSecondsPerKm: number | null;
}

/** A plan day from earlier this week that is still open, offered back on a rest or open today. */
export interface CarriedOverDay {
  planDayId: string;
  dayOfWeek: number;
  kind: SessionKindCode;
  title: string;
  estimatedMinutes: number | null;
}

export interface TodayInsight {
  date: string;
  kind: DayKind;
  label: string;
  source: DaySource;
  planDayId: string | null;
  title: string | null;
  estimatedMinutes: number | null;
  moves: number | null;
  lastOfKind: LastOfKind | null;
  carriedOver: CarriedOverDay[];
}

/** The next day, after today, that has a scheduled or habitual training kind. */
export interface NextTraining {
  date: string;
  kind: DayKind;
  label: string;
  title: string;
  estimatedMinutes: number | null;
}

export interface FoodSearchResult {
  foodId: string | null;
  displayName: string;
  brandName: string;
  categoryName: string | null;
  scope: string;
  calories: number;
  proteinGrams: number;
  basisUnit: string;
  basisLabel: string;
  primaryBarcode: string;
  verified: boolean;
}

export interface PagedFoods {
  items: FoodSearchResult[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export interface FoodServing {
  servingId: string | null;
  label: string;
  quantity: number | null;
  unit: string | null;
  gramsEquivalent: number | null;
  millilitersEquivalent: number | null;
  sortOrder: number | null;
  defaultServing: boolean;
}

export interface FoodDetail {
  foodId: string | null;
  displayName: string;
  brandName: string;
  categoryName: string | null;
  scope: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  basisQuantity: number;
  basisUnit: string;
  densityGramsPerMl: number | null;
  primaryBarcode: string;
  /** Upstream open-data provenance ('OFF' = Open Food Facts, 'USDA_SR'); null for native entries. */
  sourceDataset: string | null;
  servings: FoodServing[];
}

export interface FoodCategory {
  categoryId: string;
  parentId: string | null;
  code: string;
  displayName: string;
  slug: string;
  sortOrder: number;
  children: FoodCategory[];
}

/** A saved meal template for one-tap meal logging. */
export interface MealTemplateItem {
  templateItemId: string;
  customFoodId: string | null;
  foodCatalogItemId: string | null;
  foodServingId: string | null;
  foodName: string;
  brandName: string | null;
  quantity: number;
  unit: string;
  snapshotServingLabel: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
}

export interface MealTemplate {
  templateId: string;
  name: string;
  mealType: string;
  note: string;
  totalCalories: number;
  items: MealTemplateItem[];
}

/** A previously logged food surfaced for one-tap re-logging (recent / frequent). */
export interface LoggedFood {
  foodId: string | null;
  customFoodId: string | null;
  foodServingId: string | null;
  scope: string;
  foodName: string;
  brandName: string;
  servingLabel: string;
  quantity: number;
  unit: string;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  timesLogged: number;
  lastLoggedAt: string | null;
}

export interface MealFormValue {
  mealType: string;
  foodName: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  note: string;
}

export interface MealItemDraft {
  foodCatalogItemId?: string | null;
  customFoodId?: string | null;
  foodServingId?: string | null;
  foodName: string;
  brandName: string | null;
  quantity: number;
  unit: string;
  servingSize: number | null;
  servingUnit: string | null;
  snapshotServingLabel: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
}

export interface MealDraft {
  mealType: string;
  name: string;
  note: string;
  consumedAt?: string;
  timezone?: string;
  items: MealItemDraft[];
}

export interface QuickAddMealValue {
  mealType: string;
  name: string;
  consumedAt?: string;
  timezone?: string;
  calories: number;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams?: number | null;
  sugarGrams?: number | null;
  sodiumMg?: number | null;
}

/** One food inside a logged meal, as the meals list returns it. */
export interface DayMealItem {
  name: string;
  calories: number;
  proteinGrams: number;
}

/** A meal logged on one day with the macros and foods the summary `Meal` leaves out. */
export interface DayMeal {
  mealId: string;
  mealType: string;
  consumedAt: string;
  totalCalories: number;
  totalProteinGrams: number;
  totalCarbsGrams: number;
  totalFatGrams: number;
  items: DayMealItem[];
}

/** Protein eaten at one kind of meal on an average day of the period. */
export interface ProteinByMeal {
  mealType: string;
  label: string;
  gramsPerDay: number;
}

/** The nutrition figures behind the meal chart in the nutrition reading. */
export interface NutritionInsightsPage {
  period: string;
  periodStart: string | null;
  periodEnd: string | null;
  daysLogged: number | null;
  proteinPerDayGrams: number | null;
  proteinTargetGrams: number | null;
  proteinByMeal: ProteinByMeal[];
}

export interface WeightSeriesPoint {
  date: string;
  weightKg: number;
}

/** The weight figures behind the projection chart in the progress reading. */
export interface ProgressInsight {
  referenceDate: string | null;
  weightKg: number | null;
  measuredOn: string | null;
  weeklyRateKg: number | null;
  /** Days of weigh-ins the weekly rate was measured over. Absent in older responses. */
  rateWindowDays?: number | null;
  goalWeightKg: number | null;
  goalDate: string | null;
  projectedDate: string | null;
  series: WeightSeriesPoint[];
}

/** One food of a usual meal. The category code is what the food cards may draw an icon from. */
export interface UsualMealItem {
  name: string;
  calories: number | null;
  proteinGrams: number | null;
  categoryCode: string | null;
}

/**
 * The meal a person usually has at one kind of meal, from the last two weeks. When no
 * combination came back often enough the source meal and the figures are null and the list of
 * foods is empty, while the usual time may still be known.
 */
export interface UsualMeal {
  mealType: string;
  label: string;
  /** The usual clock time as "HH:mm", or null when the backend gave none that can be read. */
  usualTime: string | null;
  sourceMealId: string | null;
  totalCalories: number | null;
  totalProteinGrams: number | null;
  totalCarbsGrams: number | null;
  totalFatGrams: number | null;
  items: UsualMealItem[];
}

/** One day of the month calendar that has completed training; days without any are not listed. */
export interface MonthDayInsight {
  date: string;
  kind: DayKind;
  label: string;
  sessions: number;
  minutes: number;
  muscles: string[];
  /** True when the day set a personal record. */
  record: boolean;
}

/** One Monday-to-Sunday week that overlaps the month; its figures count only days inside it. */
export interface MonthWeekInsight {
  weekStart: string;
  weekEnd: string;
  sessions: number;
  minutes: number;
  strengthSessions: number;
  cardioSessions: number;
  mobilitySessions: number;
  sportSessions: number;
  /** True once the week has fully passed on the reference date. */
  complete: boolean;
}

export interface MonthTotals {
  sessions: number;
  minutes: number;
  records: number;
  longestStreakDays: number;
}

export interface MonthMuscleInsight {
  group: string;
  label: string;
  sessions: number;
}

export interface MonthlyTrainingInsight {
  timezone: string;
  /** The month as YYYY-MM. */
  month: string;
  monthStart: string;
  monthEnd: string;
  /** Today's date in the user's timezone, as the backend counts it. */
  referenceDate: string;
  /** The date of the first completed session ever, or null before the first one. */
  firstSessionDate: string | null;
  days: MonthDayInsight[];
  weeks: MonthWeekInsight[];
  totals: MonthTotals;
  /** The month before, or null when the person had no training before this month. */
  previousTotals: MonthTotals | null;
  muscles: MonthMuscleInsight[];
}
