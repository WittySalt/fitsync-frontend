import { BriefObservation } from '../../dashboard/brief/brief-observations';
import { mapFoodNutrition, mapFoodProgress, mapGoalProgress } from '../progress-api.mappers';
import { FoodProgress, GoalProgress, GoalRoad } from '../progress-api.models';
import { FOOD_WIRE, GOAL_WIRE, NUTRITION_WIRE, TODAY } from '../progress-testing.spec';
import { foodCoachLine, goalCoachLine, trainingCoachLine } from './card-lines';
import { BarsWeek } from './energy-fallback';
import { lossRoad } from './goal-road.spec';

const goalWith = (road: GoalRoad | null, extra: Record<string, unknown> = {}): GoalProgress => ({ ...mapGoalProgress({ ...GOAL_WIRE, ...extra }), road });

describe('the Training coach line', () => {
  const observation = (fact: string, note: string): BriefObservation => ({ id: 'rested', icon: 'rest', fact, note, muscle: null });

  it('joins the fact and the note of the first observation', () => {
    expect(trainingCoachLine([observation('Chest, back and legs have had five days off.', 'They are ready whenever you are.'), observation('x', 'y')])).toBe(
      'Chest, back and legs have had five days off. They are ready whenever you are.'
    );
  });

  it('closes a sentence that lacks its full stop, and skips an empty note', () => {
    expect(trainingCoachLine([observation('Two sessions this week', '')])).toBe('Two sessions this week.');
  });

  it('is empty without an observation', () => {
    expect(trainingCoachLine([])).toBe('');
  });
});

describe('the Goal coach line', () => {
  it('counts the kilos done and names the next one while ahead or on course', () => {
    expect(goalCoachLine(goalWith(lossRoad()), TODAY)).toBe('4 kilos down since July. The next one falls around 8 Oct at this pace.');
    expect(goalCoachLine(goalWith(lossRoad({ state: 'ON_COURSE' })), TODAY)).toContain('kilos down since July');
    const gain = lossRoad({ direction: 'GAIN', ticks: [{ kg: 60, crossedOn: '2026-07-06', projectedOn: null }, { kg: 61, crossedOn: null, projectedOn: '2026-10-20' }] });
    expect(goalCoachLine(goalWith(gain), TODAY)).toBe('1 kilo up since July. The next one falls around 20 Oct at this pace.');
  });

  it('says what the plan needs when behind', () => {
    const road = lossRoad({ state: 'BEHIND', distanceKg: 3.2, targetDate: '2026-12-11' });
    // 69 days left is 9.86 weeks: 3.2 kg is 0.32 kg a week.
    expect(goalCoachLine(goalWith(road), TODAY)).toBe('The last 28 days were slower than the plan needs; 11 Dec needs 0.32 kg a week from here.');
    expect(goalCoachLine(goalWith(lossRoad({ state: 'BEHIND', targetDate: null })), TODAY)).toBe('The last 28 days were slower than the plan needs.');
  });

  it('says the weight moved away from the target when the trend points away', () => {
    const away = lossRoad({ state: 'BEHIND', projectedDate: null, distanceKg: 3.2, targetDate: '2026-12-11' });
    const rising = goalWith(away, { hero: { ...GOAL_WIRE.hero, weeklyRate: { value: 0.3, previous: 0.1 }, projectedDate: { value: null, previous: null } } });
    expect(goalCoachLine(rising, TODAY)).toBe('Over the last 28 days the weight moved away from 68 kg; 11 Dec needs 0.32 kg a week from here.');
    expect(goalCoachLine({ ...rising, road: { ...away, targetDate: null } }, TODAY)).toBe('Over the last 28 days the weight moved away from 68 kg.');
  });

  it('counts only the weeks that hold a session for a workout goal', () => {
    const workouts = (weeks: { weekStart: string; value: number; target: number }[]) =>
      mapGoalProgress({ otherGoals: [{ type: 'WORKOUT_FREQUENCY', target: 4, unit: 'sessions/week', metDays: 0, loggedDays: 4, days: [], weeks }] });
    const empty = workouts(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map((weekStart) => ({ weekStart, value: 0, target: 4 })));
    expect(goalCoachLine(empty, TODAY)).toBe('');
    const partial = workouts([{ weekStart: '2026-09-07', value: 0, target: 4 }, { weekStart: '2026-09-14', value: 2, target: 4 }, { weekStart: '2026-09-21', value: 4, target: 4 }]);
    expect(goalCoachLine(partial, TODAY)).toBe('1 of 2 logged weeks reached 4 sessions/week.');
  });

  it('names when the average stopped moving when stalled', () => {
    const stalled = { ...goalWith(lossRoad({ state: 'STALLED' })), weight: { ...goalWith(null).weight, daily: [{ date: '2026-09-06', kg: 72 }, { date: '2026-09-20', kg: 71.3 }, { date: '2026-10-01', kg: 71.2 }] } };
    expect(goalCoachLine(stalled, TODAY)).toBe('The weekly average has not moved since 20 Sept.');
  });

  it('counts the days early when reached, and the day when it was not early', () => {
    const reached = lossRoad({ state: 'REACHED', fractionWeight: 1, ticks: [{ kg: 68, crossedOn: '2026-11-18', projectedOn: null }] });
    expect(goalCoachLine(goalWith(reached), TODAY)).toBe('You got there 23 days before your date.');
    expect(goalCoachLine(goalWith({ ...reached, targetDate: '2026-11-18' }), TODAY)).toBe('You got there on 18 Nov.');
  });

  it('says how far the date missed when it has passed', () => {
    expect(goalCoachLine(goalWith(lossRoad({ state: 'DATE_PASSED', projectedDate: '2026-11-25' })), TODAY)).toBe('Your date has passed with 3.2 kg to go; at this pace it is 25 Nov.');
    expect(goalCoachLine(goalWith(lossRoad({ state: 'DATE_PASSED', projectedDate: null })), TODAY)).toBe('Your date has passed with 3.2 kg to go.');
  });

  it('counts the weeks inside the band when keeping', () => {
    const keep = lossRoad({ direction: 'KEEP', targetKg: 70, keep: { bandKg: 1, weeks: [69.4, 70.2, 71.4, 69.9].map((avgKg, i) => ({ weekStart: `2026-09-0${i + 1}`, avgKg, inside: Math.abs(avgKg - 70) <= 1 })) } });
    expect(goalCoachLine(goalWith(keep), TODAY)).toBe('3 of the last 4 weeks stayed within 1 kg of 70 kg.');
  });

  it('reads the habit that leads when there is no weight goal', () => {
    const habit = mapGoalProgress({ otherGoals: [{ type: 'PROTEIN', target: 140, unit: 'g', metDays: 42, loggedDays: 50, days: [] }] });
    expect(goalCoachLine(habit, TODAY)).toBe('42 of 50 logged days reached 140 g.');
  });

  it('asks for a goal when there is none, and has a line while no date can be drawn', () => {
    expect(goalCoachLine(mapGoalProgress({}), TODAY)).toBe('Set a goal in Me and this card turns into a road to it.');
    expect(goalCoachLine(goalWith(lossRoad({ state: 'NO_PROJECTION' })), TODAY)).toContain('Log a few more weigh-ins');
  });
});

describe('the Food coach line', () => {
  const food = (patch: (wire: typeof FOOD_WIRE) => unknown): FoodProgress => ({ ...mapFoodProgress(patch(JSON.parse(JSON.stringify(FOOD_WIRE)))), nutrition: mapFoodNutrition(NUTRITION_WIRE) });
  const noProtein = (wire: typeof FOOD_WIRE) => ({ ...wire, macros: { ...wire.macros, protein: { ...wire.macros.protein, thisWeek: 150 } } });
  /** The week the bars draw, with eaten minus used equal to the balance given. */
  const bars = (balance: number, when = 'this week', daysLogged = 5): BarsWeek => ({
    label: 'x',
    when,
    week: {
      weekStart: '2026-09-28', weekEnd: '2026-10-04', status: 'OK', daysLogged, bmrKcal: 1700, bmrEstimated: false, restingFactor: 1.2,
      average: { eaten: 2200 + balance, resting: 2000, workouts: 200, used: 2200, balance: 9999 },
      mealSplit: null, weeklyKgEquivalent: null, days: [], weeks: []
    }
  });

  it('puts protein under its target first and names the largest meal', () => {
    expect(foodCoachLine(food((wire) => wire), null, TODAY)).toBe('Protein is 4 g a day under the target this week. Dinner carries most of it.');
    expect(foodCoachLine(food((wire) => ({ ...wire, meals: { share: [] } })), null, TODAY)).toBe('Protein is 4 g a day under the target this week.');
  });

  it('names the week the protein figure comes from when nothing was logged this week', () => {
    const earlier = (wire: typeof FOOD_WIRE) => ({ ...wire, meals: { share: [] }, macros: { ...wire.macros, protein: { ...wire.macros.protein, series: [{ weekStart: '2026-08-10', value: 150 }, { weekStart: '2026-09-21', value: 136 }] } } });
    expect(foodCoachLine(food(earlier), null, TODAY)).toBe('Protein is 4 g a day under the target in the week of 21 Sept.');
  });

  it('reports the balance under what was used, with the logged days', () => {
    expect(foodCoachLine(food(noProtein), bars(-279), TODAY)).toBe('You ate 279 kcal a day under what you used this week, on 5 logged days.');
  });

  it('reports the balance over what was used', () => {
    expect(foodCoachLine(food(noProtein), bars(120), TODAY)).toBe('You ate 120 kcal a day over what you used this week.');
  });

  it('reads the balance from the week the bars draw, not from the hero, and names that week', () => {
    const heroSays283 = (wire: typeof FOOD_WIRE) => ({ ...noProtein(wire), hero: { ...wire.hero, balancePerDay: { value: 283, daysLogged: 1 } } });
    expect(foodCoachLine(food(heroSays283), bars(7, 'in the week of 21 Sept', 6), TODAY)).toBe('You ate 7 kcal a day over what you used in the week of 21 Sept.');
  });

  it('falls back to the first highlight when nothing else applies', () => {
    expect(foodCoachLine(food(noProtein), bars(0), TODAY)).toBe('Protein drifted from 150 g to 136 g a day.');
    expect(foodCoachLine(food(noProtein), null, TODAY)).toBe('Protein drifted from 150 g to 136 g a day.');
    expect(foodCoachLine(food((wire) => ({ ...noProtein(wire), highlights: [] })), bars(0), TODAY)).toBe('');
  });
});
