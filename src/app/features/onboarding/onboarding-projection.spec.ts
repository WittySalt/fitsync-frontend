import { calculateGoalProjection, shouldShowTargetAndPace } from './onboarding-projection';

describe('onboarding goal projection', () => {
  it('shows target weight and pace only for weight-changing primary goals', () => {
    expect(shouldShowTargetAndPace('LOSE_FAT')).toBeTrue();
    expect(shouldShowTargetAndPace('BUILD_MUSCLE')).toBeTrue();
    expect(shouldShowTargetAndPace('MAINTAIN')).toBeFalse();
    expect(shouldShowTargetAndPace('IMPROVE_FITNESS')).toBeFalse();
  });

  it('projects weeks, date, calories, macros, and BMI warnings from target pace', () => {
    const projection = calculateGoalProjection({
      primaryGoal: 'LOSE_FAT',
      heightCm: 170,
      currentWeightKg: 72,
      targetWeightKg: 64,
      weeklyPaceKg: 0.5,
      weeklyWorkoutDays: 4,
      activityLevel: 'MODERATELY_ACTIVE',
      startDate: new Date('2026-06-18T00:00:00Z')
    });

    expect(projection.weekCount).toBe(16);
    expect(projection.projectedDate).toBe('2026-10-08');
    expect(projection.dailyCalories).toBe(1747);
    expect(projection.proteinGrams).toBe(130);
    expect(projection.fatGrams).toBe(49);
    expect(projection.carbsGrams).toBe(197);
    expect(projection.targetBmi).toBeCloseTo(22.1, 1);
    expect(projection.warnings).toEqual([]);
  });

  it('warns without blocking when BMI is underweight or pace is aggressive', () => {
    const projection = calculateGoalProjection({
      primaryGoal: 'LOSE_FAT',
      heightCm: 170,
      currentWeightKg: 62,
      targetWeightKg: 52,
      weeklyPaceKg: 0.8,
      weeklyWorkoutDays: 3,
      activityLevel: 'LIGHTLY_ACTIVE',
      startDate: new Date('2026-06-18T00:00:00Z')
    });

    expect(projection.warnings).toContain('Your target BMI is below 18.5. Consider a more conservative target.');
    expect(projection.warnings).toContain('A pace above 0.75 kg/week can be hard to sustain.');
  });

  it('uses activity framing for maintain and fitness goals', () => {
    const projection = calculateGoalProjection({
      primaryGoal: 'IMPROVE_FITNESS',
      heightCm: 170,
      currentWeightKg: 72,
      targetWeightKg: null,
      weeklyPaceKg: null,
      weeklyWorkoutDays: 5,
      activityLevel: 'VERY_ACTIVE',
      startDate: new Date('2026-06-18T00:00:00Z')
    });

    expect(projection.showsTargetAndPace).toBeFalse();
    expect(projection.weekCount).toBeNull();
    expect(projection.projectedDate).toBeNull();
    expect(projection.dailyCalories).toBe(2475);
  });

  it('scales the athlete activity level by 1.7', () => {
    const projection = calculateGoalProjection({
      primaryGoal: 'MAINTAIN',
      heightCm: 170,
      currentWeightKg: 72,
      targetWeightKg: null,
      weeklyPaceKg: null,
      weeklyWorkoutDays: 6,
      activityLevel: 'ATHLETE',
      startDate: new Date('2026-06-18T00:00:00Z')
    });

    expect(projection.dailyCalories).toBe(Math.round(72 * 22 * 1.7));
  });
});
