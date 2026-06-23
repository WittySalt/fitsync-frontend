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
  weeklyWorkoutDays: number;
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
  durationMinutes: number;
  caloriesBurned: number;
  completedAt: string;
  exerciseCount: number;
}

export interface WorkoutSessionPage {
  sessions: WorkoutSession[];
  total: number;
}

export interface WorkoutSessionFormValue {
  name: string;
  workoutType: string;
  durationMinutes: number;
  caloriesBurned: number;
  perceivedExertion: number | null;
  notes: string;
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
  durationMinutes: number;
  caloriesBurned: number;
  perceivedExertion: number | null;
  notes: string | null;
  exercises: WorkoutExerciseLogInput[];
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
  durationMinutes: number;
  caloriesBurned: number;
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
  measuredAt: string;
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
  currentValue?: number | null;
  daysRemaining?: number | null;
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
  createdAt?: string | null;
  updatedAt?: string | null;
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

export interface WorkoutPlanRequest {
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  exercises: WorkoutPlanExerciseInput[];
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
