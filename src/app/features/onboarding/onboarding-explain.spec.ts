import {
  ExplainState,
  HOW_HARD_CHOICES,
  explainGoal,
  explainHealth,
  explainPlan,
  explainStep,
  explainTraining,
  explainYou,
  formatDate,
  formatKcal,
  formatMacros,
  formatWeeks,
  formatWeight,
  howHardFor,
  planSummary
} from './onboarding-explain';

function state(overrides: Partial<ExplainState> = {}): ExplainState {
  return {
    goal: 'LOSE_FAT',
    units: 'METRIC',
    currentWeightKg: 71.2,
    targetWeightKg: 68,
    weeklyPaceKg: 0.5,
    projection: { weekCount: 7, projectedDate: '2026-11-24', dailyCalories: 1721, proteinGrams: 128 },
    weeklyWorkoutDays: 4,
    durationMinutes: 45,
    location: 'GYM',
    fitnessLevel: 'INTERMEDIATE',
    intensity: 'MODERATE',
    equipment: ['DUMBBELLS'],
    focusAreas: ['FULL_BODY'],
    hasHealthFlag: false,
    injuryAreas: [],
    calorieTrackingMode: 'FLEXIBLE',
    ...overrides
  };
}

describe('onboarding explain', () => {
  describe('number formats', () => {
    it('follows the formats used across the app', () => {
      expect(formatKcal(2100)).toBe('2,100 kcal');
      expect(formatKcal(1721.4)).toBe('1,721 kcal');
      expect(formatDate('2026-11-24')).toBe('24 Nov 2026');
      expect(formatDate('2026-09-03')).toBe('3 Sept 2026');
      expect(formatWeeks(7)).toBe('7 weeks');
      expect(formatWeeks(1)).toBe('1 week');
      expect(formatMacros(128, 194, 48)).toBe('128 g protein · 194 g carbs · 48 g fat');
      expect(formatWeight(71.2, 'METRIC')).toBe('71.2 kg');
      expect(formatWeight(68, 'METRIC')).toBe('68 kg');
      expect(formatWeight(68, 'IMPERIAL')).toBe('149.9 lb');
    });
  });

  describe('How hard', () => {
    it('maps the three choices to the experience and intensity fields of the request', () => {
      expect(HOW_HARD_CHOICES.map((choice) => [choice.label, choice.fitnessLevel, choice.intensityPreference])).toEqual([
        ['Ease in', 'BEGINNER', 'LOW'],
        ['Steady', 'INTERMEDIATE', 'MODERATE'],
        ['Push', 'ADVANCED', 'HIGH']
      ]);
    });

    it('reads a stored pair back as a choice, following the intensity when the pair is mixed', () => {
      expect(howHardFor('BEGINNER', 'LOW')?.label).toBe('Ease in');
      expect(howHardFor('ADVANCED', 'HIGH')?.label).toBe('Push');
      expect(howHardFor('BEGINNER', 'HIGH')?.label).toBe('Push');
      expect(howHardFor('ADVANCED', 'MODERATE')?.label).toBe('Steady');
      expect(howHardFor('ADVANCED', null)).toBeNull();
    });
  });

  describe('step 1, Goal', () => {
    it('names the pace and target for a weight goal and Progress as the place', () => {
      expect(explainGoal(state())).toEqual([
        'Lose fat sets a weekly pace and a target weight.',
        'Progress draws the road to it and the Diary budget sits a little under what you burn.'
      ]);
      expect(explainGoal(state({ goal: 'BUILD_MUSCLE' }))[0]).toBe('Build muscle sets a gentle surplus and a target weight.');
    });

    it('speaks about the training rhythm for an activity goal and has a line for no goal', () => {
      expect(explainGoal(state({ goal: 'IMPROVE_FITNESS' }))).toEqual([
        'Improve fitness builds the plan around your training rhythm.',
        'The Workout page and the coach plan your week without a scale target.'
      ]);
      expect(explainGoal(state({ goal: 'MAINTAIN' }))[0]).toBe('Maintain keeps the Diary budget close to what you burn.');
      expect(explainGoal(state({ goal: null }))).toHaveSize(2);
    });
  });

  describe('step 2, You', () => {
    it('gives the date, the weeks away, the daily target and the protein', () => {
      expect(explainYou(state())).toEqual([
        'At 71.2 kg, 68 kg at 0.5 kg a week lands on 24 Nov 2026, 7 weeks away.',
        'Progress draws the road to it.',
        'Your daily target in the Diary becomes 1,721 kcal with 128 g protein.'
      ]);
    });

    it('drops the road for a goal without a target and asks for the basics while they are missing', () => {
      expect(
        explainYou(state({ goal: 'MAINTAIN', targetWeightKg: null, weeklyPaceKg: null, projection: { weekCount: null, projectedDate: null, dailyCalories: 2240, proteinGrams: 128 } }))
      ).toEqual([
        'At 71.2 kg, this goal keeps your weight steady and Progress follows it.',
        'Your daily target in the Diary becomes 2,240 kcal with 128 g protein.'
      ]);
      expect(explainYou(state({ currentWeightKg: null, projection: { weekCount: null, projectedDate: null, dailyCalories: null, proteinGrams: null } }))[0]).toBe(
        'Add your height and current weight to see your daily target.'
      );
    });

    it('shows pounds in imperial units', () => {
      expect(explainYou(state({ units: 'IMPERIAL' }))[0]).toBe('At 157 lb, 149.9 lb at 1.1 lb a week lands on 24 Nov 2026, 7 weeks away.');
    });
  });

  describe('step 3, Training', () => {
    it('plans the days from the weekly target, then equipment and focus areas', () => {
      expect(explainTraining(state({ focusAreas: ['UPPER', 'CORE', 'LOWER'] }))).toEqual([
        'Four sessions a week becomes your target. The coach plans Mon, Thu, Fri and Sat.',
        'Exercises are picked from what you own.',
        'Upper body, Core and Lower body get more of the weekly plan.'
      ]);
    });

    it('handles one session, bodyweight only, no equipment and an open week', () => {
      expect(explainTraining(state({ weeklyWorkoutDays: 1, equipment: ['NONE'], focusAreas: ['FULL_BODY'] }))).toEqual([
        'One session a week becomes your target. The coach plans Wed.',
        'Exercises are bodyweight moves.'
      ]);
      expect(explainTraining(state({ weeklyWorkoutDays: null, equipment: [], focusAreas: ['MOBILITY'] }))).toEqual([
        'Your weekly target stays open until you set one on the Workout page.',
        'Mobility gets more of the weekly plan.'
      ]);
    });
  });

  describe('step 4, Health', () => {
    it('keeps the plan conservative on a yes and names the areas to swap out', () => {
      expect(explainHealth(state({ hasHealthFlag: true, injuryAreas: ['KNEE', 'LOWER_BACK'] }))).toEqual([
        'A yes keeps the plan conservative and the coach suggests a check-up first.',
        'Moves that load your knee and lower back are swapped out of Workout plans.'
      ]);
    });

    it('says the plan follows the chosen effort when nothing is flagged', () => {
      expect(explainHealth(state())).toEqual(['With no flags the coach plans at the effort you chose.']);
    });
  });

  describe('step 5, Your plan', () => {
    it('names the Diary budget and the Progress Goal card, with a line per tracking mode', () => {
      expect(explainPlan(state({ calorieTrackingMode: 'STRICT' }))).toEqual([
        'These targets feed the Diary budget and the Progress Goal card.',
        'Strict tracking holds each Diary day to the calorie target.',
        'Change them any time in Me.'
      ]);
      expect(explainPlan(state({ calorieTrackingMode: 'OFF' }))[1]).toBe('With calorie tracking off, the Diary lists your meals without a budget.');
      expect(explainPlan(state())[1]).toBe('Flexible tracking reads the Diary across the week.');
    });
  });

  it('picks the builder by step and never urges or shouts', () => {
    expect(explainStep(0, state())).toEqual(explainGoal(state()));
    expect(explainStep(1, state())).toEqual(explainYou(state()));
    expect(explainStep(2, state())).toEqual(explainTraining(state()));
    expect(explainStep(3, state())).toEqual(explainHealth(state()));
    expect(explainStep(4, state())).toEqual(explainPlan(state()));

    const all = [0, 1, 2, 3, 4].flatMap((step) => explainStep(step, state({ hasHealthFlag: true, injuryAreas: ['KNEE'] })));
    for (const line of all) {
      expect(line).not.toMatch(/!|—|should|prioriti/i);
    }
  });

  describe('plan summary', () => {
    it('reads as the spec example', () => {
      expect(planSummary(state())).toBe('Gym, four days a week, 45 minutes, steady effort. Lose fat to 68 kg by 24 Nov 2026.');
    });

    it('covers the other goals, efforts and an open week', () => {
      expect(planSummary(state({ goal: 'BUILD_MUSCLE', targetWeightKg: 78, location: 'HOME', weeklyWorkoutDays: 1, fitnessLevel: 'ADVANCED', intensity: 'HIGH' }))).toBe(
        'Home, one day a week, 45 minutes, hard effort. Build muscle to 78 kg by 24 Nov 2026.'
      );
      expect(
        planSummary(
          state({
            goal: 'MAINTAIN',
            targetWeightKg: null,
            weeklyWorkoutDays: null,
            fitnessLevel: 'BEGINNER',
            intensity: 'LOW',
            projection: { weekCount: null, projectedDate: null, dailyCalories: 2200, proteinGrams: 128 }
          })
        )
      ).toBe('Gym, days a week to be decided, 45 minutes, gentle effort. Maintain around 71.2 kg.');
      expect(planSummary(state({ goal: 'IMPROVE_FITNESS', targetWeightKg: null }))).toContain('Improve fitness.');
    });
  });
});
