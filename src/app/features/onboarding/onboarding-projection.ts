export type PrimaryGoal = 'LOSE_FAT' | 'BUILD_MUSCLE' | 'MAINTAIN' | 'IMPROVE_FITNESS';

export interface ProjectionInput {
  primaryGoal: PrimaryGoal;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weeklyPaceKg: number | null;
  weeklyWorkoutDays: number | null;
  activityLevel: string | null;
  startDate: Date;
}

export interface GoalProjection {
  showsTargetAndPace: boolean;
  weekCount: number | null;
  projectedDate: string | null;
  dailyCalories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  targetBmi: number | null;
  warnings: string[];
}

const ACTIVITY_FACTORS: Record<string, number> = {
  SEDENTARY: 1.25,
  LIGHTLY_ACTIVE: 1.35,
  MODERATELY_ACTIVE: 1.45,
  VERY_ACTIVE: 1.5625,
  EXTRA_ACTIVE: 1.7
};

export function shouldShowTargetAndPace(primaryGoal: PrimaryGoal): boolean {
  return primaryGoal === 'LOSE_FAT' || primaryGoal === 'BUILD_MUSCLE';
}

export function calculateGoalProjection(input: ProjectionInput): GoalProjection {
  const showsTargetAndPace = shouldShowTargetAndPace(input.primaryGoal);
  const dailyCalories = estimateCalories(input);
  const macros = dailyCalories && input.currentWeightKg ? estimateMacros(dailyCalories, input.currentWeightKg) : null;
  const targetBmi =
    showsTargetAndPace && input.heightCm && input.targetWeightKg
      ? input.targetWeightKg / (input.heightCm / 100) ** 2
      : null;
  const warnings: string[] = [];

  if (targetBmi !== null && targetBmi < 18.5) {
    warnings.push('Your target BMI is below 18.5. Consider a more conservative target.');
  }

  if (showsTargetAndPace && input.weeklyPaceKg !== null && input.weeklyPaceKg > 0.75) {
    warnings.push('A pace above 0.75 kg/week can be hard to sustain.');
  }

  if (!showsTargetAndPace) {
    return {
      showsTargetAndPace,
      weekCount: null,
      projectedDate: null,
      dailyCalories,
      proteinGrams: macros?.proteinGrams ?? null,
      carbsGrams: macros?.carbsGrams ?? null,
      fatGrams: macros?.fatGrams ?? null,
      targetBmi,
      warnings
    };
  }

  const weightDeltaKg =
    input.currentWeightKg !== null && input.targetWeightKg !== null
      ? Math.abs(input.currentWeightKg - input.targetWeightKg)
      : null;
  const weekCount =
    weightDeltaKg !== null && input.weeklyPaceKg !== null && input.weeklyPaceKg > 0
      ? Math.max(1, Math.ceil(weightDeltaKg / input.weeklyPaceKg))
      : null;

  return {
    showsTargetAndPace,
    weekCount,
    projectedDate: weekCount ? addWeeks(input.startDate, weekCount) : null,
    dailyCalories,
    proteinGrams: macros?.proteinGrams ?? null,
    carbsGrams: macros?.carbsGrams ?? null,
    fatGrams: macros?.fatGrams ?? null,
    targetBmi,
    warnings
  };
}

function estimateCalories(input: ProjectionInput): number | null {
  if (!input.currentWeightKg) {
    return null;
  }

  const activityFactor = ACTIVITY_FACTORS[input.activityLevel ?? ''] ?? ACTIVITY_FACTORS['MODERATELY_ACTIVE'];
  const maintenanceCalories = Math.round(input.currentWeightKg * 22 * activityFactor);

  if (!shouldShowTargetAndPace(input.primaryGoal)) {
    return maintenanceCalories;
  }

  const weeklyPaceKg = input.weeklyPaceKg ?? 0;
  const dailyEnergyDelta = Math.round((weeklyPaceKg * 7700) / 7);
  const signedDelta = input.primaryGoal === 'LOSE_FAT' ? -dailyEnergyDelta : dailyEnergyDelta;

  return Math.max(1200, maintenanceCalories + signedDelta);
}

function estimateMacros(dailyCalories: number, currentWeightKg: number): Pick<
  GoalProjection,
  'proteinGrams' | 'carbsGrams' | 'fatGrams'
> {
  const proteinGrams = Math.round(currentWeightKg * 1.8);
  const fatGrams = Math.round((dailyCalories * 0.25) / 9);
  const remainingCalories = Math.max(0, dailyCalories - proteinGrams * 4 - fatGrams * 9);
  const carbsGrams = Math.round(remainingCalories / 4);

  return { proteinGrams, carbsGrams, fatGrams };
}

function addWeeks(startDate: Date, weekCount: number): string {
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + weekCount * 7);
  return date.toISOString().slice(0, 10);
}
