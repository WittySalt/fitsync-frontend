import { BriefObservation } from '../../dashboard/brief/brief-observations';
import { mapFoodNutrition, mapFoodProgress, mapGoalProgress } from '../progress-api.mappers';
import { FoodProgress, GoalProgress, GoalRoad } from '../progress-api.models';
import { FOOD_WIRE, GOAL_WIRE, NUTRITION_WIRE, TODAY } from '../progress-testing.spec';
import { foodCoachLine, goalCoachLine, trainingCoachLine } from './card-lines';
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

  it('puts protein under its target first and names the largest meal', () => {
    expect(foodCoachLine(food((wire) => wire))).toBe('Protein is 4 g a day under the target this week. Dinner carries most of it.');
    expect(foodCoachLine(food((wire) => ({ ...wire, meals: { share: [] } })))).toBe('Protein is 4 g a day under the target this week.');
  });

  it('reports the balance under what was used, with the logged days', () => {
    expect(foodCoachLine(food(noProtein))).toBe('You ate 279 kcal a day under what you used this week, on 5 logged days.');
  });

  it('reports the balance over what was used', () => {
    const over = (wire: typeof FOOD_WIRE) => ({ ...noProtein(wire), hero: { ...wire.hero, balancePerDay: { value: 120, daysLogged: 4 } } });
    expect(foodCoachLine(food(over))).toBe('You ate 120 kcal a day over what you used this week.');
  });

  it('falls back to the first highlight when nothing else applies', () => {
    const even = (wire: typeof FOOD_WIRE) => ({ ...noProtein(wire), hero: { ...wire.hero, balancePerDay: { value: 0, daysLogged: 4 } } });
    expect(foodCoachLine(food(even))).toBe('Protein drifted from 150 g to 136 g a day.');
    expect(foodCoachLine(food((wire) => ({ ...even(wire), highlights: [] })))).toBe('');
  });
});
