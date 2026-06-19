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
  targetCalories: number;
  totalProteinGrams: number;
  targetProteinGrams: number;
  totalCarbsGrams: number;
  targetCarbsGrams: number;
  totalFatGrams: number;
  targetFatGrams: number;
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
  name: string;
  workoutType: string;
  status: string;
  startedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
  completedAt: string;
  exerciseCount: number;
}

export interface WorkoutSessionFormValue {
  name: string;
  workoutType: string;
  durationMinutes: number;
  caloriesBurned: number;
  perceivedExertion: number | null;
  notes: string;
}

export interface Exercise {
  exerciseId: string | null;
  name: string;
  exerciseType: string;
  primaryMuscleGroup: string;
  equipment: string;
  difficulty: string;
  custom: boolean;
}

export interface Meal {
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
  goalType: string;
  targetValue: number;
  targetUnit: string;
  targetDate: string;
  status: string;
  progressRatio: number;
}

export interface WorkoutPlan {
  name: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number;
  status: string;
  exerciseCount: number;
}

export interface FoodSearchResult {
  foodId: string | null;
  displayName: string;
  brandName: string;
  calories: number;
  proteinGrams: number;
  basisUnit: string;
  verified: boolean;
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

/** A previously logged food surfaced for one-tap re-logging (recent / frequent). */
export interface LoggedFood {
  foodName: string;
  brandName: string;
  servingLabel: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  timesLogged: number;
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
