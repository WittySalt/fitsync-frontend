import { NutrientTileData } from '../../nutrition/nutrients/nutrients.models';
import { mapFoodNutrition, mapFoodProgress, mapGoalProgress } from '../progress-api.mappers';
import { FoodProgress, GoalProgress, GoalRoad } from '../progress-api.models';
import { FOOD_WIRE, GOAL_WIRE, NUTRITION_WIRE, TODAY } from '../progress-testing.spec';
import { foodReadingLines, goalReadingLines } from './card-readings';
import { goalCardView } from './goal-card-view';
import { lossRoad } from './goal-road.spec';

const goalWith = (road: GoalRoad, hero: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): GoalProgress => ({
  ...mapGoalProgress({ ...GOAL_WIRE, hero: { ...GOAL_WIRE.hero, ...hero }, ...extra }),
  road
});

describe('the Goal card readings', () => {
  const lines = (goal: GoalProgress, span = { words: '4 weeks', days: 28 }) => goalReadingLines(goal, goal.road, span).map((line) => `${line.text} | ${line.trend}${line.amber ? ' (amber)' : ''}`);

  it('reads the steady account: weight, pace and waist', () => {
    expect(lines(goalWith(lossRoad()))).toEqual([
      '71.2 kg, down 1.6 kg in 4 weeks and 3.8 kg since the start | on track',
      '0.41 kg a week, inside the 0.25 to 0.5 kg range that keeps muscle | healthy pace',
      'Waist down 2.1 cm with the weight, which points to fat rather than muscle | good sign'
    ]);
  });

  it('judges the weight line by the road state, and names the period', () => {
    expect(lines(goalWith(lossRoad({ state: 'BEHIND' })))[0]).toContain('| behind (amber)');
    expect(lines(goalWith(lossRoad({ state: 'STALLED' })))[0]).toContain('| no change');
    expect(lines(goalWith(lossRoad({ state: 'REACHED' })))[0]).toContain('| reached');
    expect(lines(goalWith(lossRoad({ state: 'ON_COURSE' })), { words: '3 months', days: 91 })[0]).toContain('in 3 months and');
  });

  it('says "up" for a gain road and leaves out the period clause when the server sent no change', () => {
    const gain = goalWith(lossRoad({ direction: 'GAIN', startKg: 60, nowKg: 62 }), { changeKg: 0.8 });
    expect(lines(gain)[0]).toBe('62.0 kg, up 0.8 kg in 4 weeks and 2.0 kg since the start | on track');
    const none = goalWith(lossRoad(), { changeKg: null });
    expect(goalReadingLines(none, none.road)[0].text).toBe('71.2 kg, down 3.8 kg since the start');
  });

  it('judges the pace: healthy, fast, slow, wrong way, and the gain range', () => {
    const pace = (value: number, road: Partial<GoalRoad> = {}) => lines(goalWith(lossRoad(road), { weeklyRate: { value, previous: -0.3 } }))[1];
    expect(pace(-0.7)).toBe('0.70 kg a week, above the 0.5 kg range that keeps muscle | fast (amber)');
    expect(pace(-0.1)).toBe('0.10 kg a week, under the 0.25 kg a week most plans aim for | slow');
    expect(pace(0.4)).toBe('0.40 kg a week the wrong way, away from the target | reversing');
    expect(pace(0.22, { direction: 'GAIN' })).toBe('0.22 kg a week, inside the 0.20 to 0.5 kg range most plans aim for | healthy pace');
    expect(pace(0.15, { direction: 'GAIN' })).toContain('under the 0.20 kg a week');
    expect(pace(0.7, { direction: 'GAIN' })).toContain('| fast (amber)');
    expect(goalReadingLines(goalWith(lossRoad({ direction: 'KEEP' })), lossRoad({ direction: 'KEEP' })).length).toBe(2);
  });

  it('judges the body line: waist, body fat, a watch, and logged weigh-ins', () => {
    const body = (patch: Record<string, unknown>, hero: Record<string, unknown> = {}) => lines(goalWith(lossRoad(), hero, { body: patch }))[2];
    const series = (start: number, end: number) => ({ series: [{ date: '2026-09-05', value: start }, { date: '2026-10-03', value: end }], start, end, context: '' });
    expect(body({ waist: series(85.9, 85.8) })).toBe('Waist unchanged while the weight fell 1.6 kg | watch (amber)');
    expect(body({ waist: series(85.9, 87) })).toBe('Waist up 1.1 cm while the weight fell 1.6 kg | watch (amber)');
    expect(body({ bodyFat: series(22.4, 21.3) })).toBe('Body fat down 1.1 points with the weight, which points to fat rather than muscle | good sign');
    expect(body({ waist: series(85.9, 83.8) }, { changeKg: 0.5 })).toBe('Waist down 2.1 cm over the same period | logged');
    const none = goalWith(lossRoad(), {}, { body: {} });
    expect(goalReadingLines(none, none.road, { words: '4 weeks', days: 28 }, { logged: 20, days: 28 })[2]).toEqual({ text: 'Logged 20 of 28 weigh-ins', trend: 'logged' });
    expect(goalReadingLines(none, none.road).length).toBe(2);
  });

  it('gives no lines without a road, and the card view carries them with their judgement', () => {
    expect(goalReadingLines(mapGoalProgress({}), null)).toEqual([]);
    expect(goalCardView(goalWith(lossRoad()), TODAY).lines.map((line) => line.trend)).toEqual(['on track', 'healthy pace', 'good sign']);
  });
});

describe('the Food card readings', () => {
  const food = (patch: (wire: typeof FOOD_WIRE) => unknown = (wire) => wire): FoodProgress => ({ ...mapFoodProgress(patch(JSON.parse(JSON.stringify(FOOD_WIRE)))), nutrition: mapFoodNutrition(NUTRITION_WIRE) });
  const tile = (displayName: string, share: number | null, groupCode: NutrientTileData['groupCode'] = 'WATER_SOLUBLE'): NutrientTileData => ({
    code: displayName,
    displayName,
    unit: 'mg',
    groupCode,
    symbol: displayName.slice(0, 2),
    atomicNumber: null,
    averageAmount: share,
    reference: 1,
    share,
    met: share !== null && share >= 1,
    upperLimit: null,
    aboveUpperLimit: false,
    dayValues: []
  });
  const read = (input: Partial<Parameters<typeof foodReadingLines>[0]> = {}) =>
    foodReadingLines({ food: food(), nutrients: null, calorieTarget: null, days: 30, earlierWords: 'a month ago', ...input }).map((line) => `${line.text} | ${line.trend}${line.amber ? ' (amber)' : ''}`);

  it('reads the steady account: energy, protein and the lowest nutrient', () => {
    expect(read()).toEqual([
      '2,123 kcal a day, logged 26 of 30 days | logged',
      'Protein 136 g a day this week, 4 g under the 140 g target and down from 150 g a month ago | under (amber)',
      'Vitamin D at 34% of the daily amount is the furthest short | 1 short (amber)'
    ]);
  });

  it('judges energy against the calorie target within 5%', () => {
    expect(read({ calorieTarget: 2100 })[0]).toBe('2,123 kcal a day on a 2,100 target, logged 26 of 30 days | on target');
    expect(read({ calorieTarget: 2500 })[0]).toContain('| under (amber)');
    expect(read({ calorieTarget: 1800 })[0]).toContain('| over');
    expect(read({ calorieTarget: 1800 })[0]).not.toContain('amber');
  });

  it('judges protein: under, met, over, without an earlier figure and without a target', () => {
    const protein = (patch: Record<string, unknown>) => read({ food: food((wire) => ({ ...wire, macros: { ...wire.macros, protein: { ...wire.macros.protein, ...patch } } })) })[1];
    expect(protein({ thisWeek: 145, firstWeek: 140 })).toBe('Protein 145 g a day this week, 5 g over the 140 g target | met');
    expect(protein({ thisWeek: 140, firstWeek: 140 })).toBe('Protein 140 g a day this week, on the 140 g target | met');
    expect(protein({ firstWeek: null })).toBe('Protein 136 g a day this week, 4 g under the 140 g target | under (amber)');
    expect(protein({ firstWeek: 120 })).toContain('and up from 120 g a month ago');
    expect(protein({ target: null })).toBe('Protein 136 g a day this week | no target');
  });

  it('names the week of the protein figure when no food was logged this week', () => {
    const earlier = food((wire) => ({ ...wire, macros: { ...wire.macros, protein: { ...wire.macros.protein, series: [{ weekStart: '2026-08-10', value: 150 }, { weekStart: '2026-09-21', value: 180 }], thisWeek: 180 } } }));
    expect(read({ food: earlier, today: '2026-10-09' })[1]).toBe('Protein 180 g a day in the week of 21 Sept, 40 g over the 140 g target | met');
    expect(read({ food: earlier, today: '2026-09-23' })[1]).toContain('Protein 180 g a day this week');
  });

  it('judges the nutrients: all met, one short, two short, and the closest when none is under 80%', () => {
    const nutrients = (shares: number[]) => shares.map((share, index) => tile(['Iron', 'Zinc', 'Vitamin D', 'Calcium', 'Fibre'][index], share));
    expect(read({ nutrients: nutrients([1, 1.2, 1]) })[2]).toBe('All 3 nutrients met over the last 30 days | met');
    expect(read({ nutrients: nutrients([1, 0.34, 1.1]) })[2]).toBe('2 of 3 nutrients met; Zinc at 34% is the one clearly short | 1 short (amber)');
    expect(read({ nutrients: nutrients([0.6, 0.34, 1.1, 1]) })[2]).toBe('2 of 4 nutrients met; Zinc and Iron are short | 2 short (amber)');
    expect(read({ nutrients: nutrients([0.9, 1, 1]) })[2]).toBe('2 of 3 nutrients met; Iron at 90% is the lowest | close');
    expect(read({ nutrients: [tile('Sodium', 0.2, 'LIMIT'), tile('Iron', 1)] })[2]).toBe('All 1 nutrients met over the last 30 days | met');
  });

  it('leaves out a line it has no figure for', () => {
    expect(read({ food: { ...mapFoodProgress({}), nutrition: null } }).length).toBe(0);
  });
});
