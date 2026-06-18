export interface UserProfile {
  displayName: string;
  firstName: string;
  lastName: string;
  heightCm: number;
  activityLevel: string;
  timezone: string;
  onboardingCompleted: boolean;
}

export interface OnboardingFormValue {
  displayName: string;
  birthDate: string;
  gender: string;
  heightCm: number;
  activityLevel: string;
  currentWeightKg: number;
  targetWeightKg: number;
  bodyFatRate: number | null;
  targetDate: string;
  preferredUnits: string;
  fitnessLevel: string;
  trainingLocation: string;
  weeklyWorkoutDays: number;
  preferredDurationMinutes: number;
  preferredWorkoutTime: string;
  intensityPreference: string;
  dietaryPattern: string;
  mealFrequency: number;
  calorieTrackingMode: string;
  macroPreference: string;
  waterGoalMl: number;
  workoutReminderEnabled: boolean;
  mealReminderEnabled: boolean;
  weighInReminderEnabled: boolean;
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
}

export interface WorkoutSession {
  name: string;
  workoutType: string;
  durationMinutes: number;
  caloriesBurned: number;
  completedAt: string;
  exerciseCount: number;
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
  displayName: string;
  brandName: string;
  calories: number;
  proteinGrams: number;
  basisUnit: string;
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
