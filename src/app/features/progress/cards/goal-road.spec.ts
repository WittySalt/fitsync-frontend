import { mapGoalProgress, mapRoad } from '../progress-api.mappers';
import { GoalProgress, GoalRoad } from '../progress-api.models';
import { GOAL_WIRE, TODAY } from '../progress-testing.spec';
import { goalCardView } from './goal-card-view';
import {
  alsoPills,
  deriveRoad,
  keepGeometry,
  keepHeadline,
  leadOf,
  pageState,
  roadGeometry,
  roadHeadline,
  roadNote,
  roadOf,
  ruleSentence,
  stripGeometry,
  verdictFor,
  wholeKilos
} from './goal-road';

/** The loss case of board 21f: 75 kg to 68 kg by 11 Dec, 71.2 kg now, 25 Nov at this pace. */
export function lossRoad(overrides: Partial<GoalRoad> = {}): GoalRoad {
  return {
    direction: 'LOSE',
    state: 'AHEAD',
    startKg: 75,
    startDate: '2026-07-06',
    nowKg: 71.2,
    nowDate: '2026-10-01',
    targetKg: 68,
    targetDate: '2026-12-11',
    distanceKg: 3.2,
    fractionWeight: 0.54,
    fractionTime: 0.52,
    projectedDate: '2026-11-25',
    ticks: [
      { kg: 75, crossedOn: '2026-07-06', projectedOn: null },
      { kg: 74, crossedOn: '2026-07-24', projectedOn: null },
      { kg: 73, crossedOn: '2026-08-14', projectedOn: null },
      { kg: 72, crossedOn: '2026-09-12', projectedOn: null },
      { kg: 71, crossedOn: null, projectedOn: '2026-10-08' },
      { kg: 70, crossedOn: null, projectedOn: '2026-10-25' },
      { kg: 69, crossedOn: null, projectedOn: '2026-11-10' },
      { kg: 68, crossedOn: null, projectedOn: '2026-11-25' }
    ],
    keep: null,
    derived: false,
    ...overrides
  };
}

function goalWith(road: GoalRoad | null, extra: Record<string, unknown> = {}): GoalProgress {
  return { ...mapGoalProgress({ ...GOAL_WIRE, ...extra }), road };
}

describe('the verdict', () => {
  it('speaks each state in two words and colours only the states that are on their way green', () => {
    expect(verdictFor('AHEAD')).toEqual({ text: 'Ahead of plan.', tone: 'green' });
    expect(verdictFor('ON_COURSE')).toEqual({ text: 'On course.', tone: 'green' });
    expect(verdictFor('REACHED')).toEqual({ text: 'Goal reached.', tone: 'green' });
    for (const [state, text] of [
      ['BEHIND', 'Behind plan.'],
      ['DATE_PASSED', 'Past your date.'],
      ['STALLED', 'Holding steady.'],
      ['NO_GOAL', 'No goal yet.'],
      ['NO_DATA', 'Start logging.']
    ] as const) {
      expect(verdictFor(state)).toEqual({ text, tone: 'ink' });
    }
  });

  it('reads the state from the road, "No goal yet" with a habit lead and "Start logging" without weight data', () => {
    expect(pageState(goalWith(lossRoad({ state: 'BEHIND' })), TODAY)).toBe('BEHIND');
    expect(pageState(null, TODAY)).toBe('NO_DATA');
    const habitOnly = mapGoalProgress({ otherGoals: GOAL_WIRE.otherGoals });
    expect(pageState(habitOnly, TODAY)).toBe('NO_GOAL');
    expect(pageState(mapGoalProgress({}), TODAY)).toBe('NO_DATA');
    expect(pageState(mapGoalProgress({ weight: GOAL_WIRE.weight, hero: { nowKg: 71 } }), TODAY)).toBe('NO_GOAL');
  });

  it('falls back to a rule sentence from the hero figures', () => {
    expect(ruleSentence(goalWith(null))).toBe('71.2 kg, losing 0.4 kg a week.');
    expect(ruleSentence(mapGoalProgress({ hero: { nowKg: 70, weeklyRate: { value: 0.01 } } }))).toBe('70.0 kg, holding steady.');
    expect(ruleSentence(null)).toContain('Log a weigh-in');
  });
});

describe('the road geometry', () => {
  it('puts every whole kilo from the start to the target at its share of the width', () => {
    expect(wholeKilos(75.4, 68)).toEqual([75, 74, 73, 72, 71, 70, 69, 68]);
    expect(wholeKilos(60, 63.2)).toEqual([60, 61, 62, 63]);
    const road = lossRoad();
    const g = roadGeometry(road, 600);
    expect(g.x0).toBe(12);
    expect(g.x1).toBe(572);
    expect(g.marks[0].x).toBe(g.x0);
    expect(g.marks.find((mark) => mark.kg === 68)?.x).toBe(g.x1);
    expect(g.marks.find((mark) => mark.kg === 71.5)).toBeUndefined();
    expect(g.todayX).toBeCloseTo(12 + 0.54 * 560, 5);
    expect(g.percent).toBe('54% of the way');
  });

  it('shows the crossing date under crossed ticks and the projection under the rest, and drops dates that collide', () => {
    const road = lossRoad({
      fractionWeight: 0.5,
      ticks: [
        { kg: 75, crossedOn: '2026-07-06', projectedOn: null },
        { kg: 74, crossedOn: '2026-07-20', projectedOn: null },
        { kg: 73, crossedOn: '2026-08-10', projectedOn: null },
        { kg: 72, crossedOn: null, projectedOn: '2026-10-20' },
        { kg: 71, crossedOn: null, projectedOn: '2026-11-05' },
        { kg: 70, crossedOn: null, projectedOn: '2026-11-25' }
      ],
      startKg: 75,
      targetKg: 70
    });
    const wide = roadGeometry(road, 900);
    const dates = wide.marks.filter((mark) => mark.date).map((mark) => mark.date);
    expect(dates).toContain('6 Jul');
    expect(wide.marks.find((mark) => mark.kg === 71)?.date).toBe('5 Nov');
    // Near Today (50% of the road, at kilo 72.5) the neighbouring dates give way to the "Today" label.
    const narrow = roadGeometry(road, 300);
    const shown = narrow.marks.filter((mark) => mark.date);
    shown.forEach((mark) => expect(Math.abs(mark.x - narrow.todayX)).toBeGreaterThanOrEqual(56));
    shown.slice(1).forEach((mark, index) => expect(mark.x - shown[index].x).toBeGreaterThanOrEqual(56));
    expect(shown.length).toBeLessThan(wide.marks.filter((mark) => mark.date).length);
  });

  it('keeps kilo labels apart and clear of the target label, and thins ticks on a long road', () => {
    const g = roadGeometry(lossRoad(), 300);
    const labelled = g.marks.filter((mark) => mark.label);
    labelled.slice(1).forEach((mark, index) => expect(mark.x - labelled[index].x).toBeGreaterThanOrEqual(30));
    labelled.forEach((mark) => expect(g.x1 - mark.x).toBeGreaterThanOrEqual(62));
    const long = lossRoad({ startKg: 130, targetKg: 70, ticks: wholeKilos(130, 70).map((kg) => ({ kg, crossedOn: null, projectedOn: null })) });
    expect(roadGeometry(long, 500).marks.length).toBeLessThan(61);
  });

  it('draws the dashed line green, slate after the date and not at all when stalled or reached', () => {
    expect(roadGeometry(lossRoad(), 600).dashed).toBe('green');
    expect(roadGeometry(lossRoad({ state: 'DATE_PASSED' }), 600).dashed).toBe('slate');
    expect(roadGeometry(lossRoad({ state: 'STALLED' }), 600).dashed).toBeNull();
    const reached = roadGeometry(lossRoad({ state: 'REACHED', fractionWeight: 1 }), 600);
    expect(reached.dashed).toBeNull();
    expect(reached.reached).toBeTrue();
    expect(reached.todayX).toBe(reached.x1);
  });

  it('runs a gain road the same way from the lower start to the higher target', () => {
    const road = lossRoad({ direction: 'GAIN', startKg: 60, targetKg: 65, nowKg: 62, fractionWeight: 0.4, ticks: wholeKilos(60, 65).map((kg) => ({ kg, crossedOn: null, projectedOn: null })) });
    const g = roadGeometry(road, 600);
    expect(g.marks[0].kg).toBe(60);
    expect(g.marks.at(-1)?.kg).toBe(65);
    expect(g.marks.at(-1)?.x).toBe(g.x1);
  });
});

describe('the headline and the caption of each state', () => {
  const goal = (road: GoalRoad) => goalWith(road);
  const cases: [string, Partial<GoalRoad>, string, string, string][] = [
    ['AHEAD', { state: 'AHEAD' }, '3.2 kg', 'to 68 kg', 'On course for 25 Nov, 16 days early'],
    ['ON_COURSE', { state: 'ON_COURSE', projectedDate: '2026-12-09' }, '3.2 kg', 'to 68 kg', 'On course for 9 Dec'],
    ['BEHIND', { state: 'BEHIND', projectedDate: '2027-01-03' }, '3.2 kg', 'to 68 kg', 'At this pace 3 Jan, 23 days late'],
    ['DATE_PASSED', { state: 'DATE_PASSED', targetDate: '2026-09-11', projectedDate: '2026-10-14' }, '3.2 kg', 'to 68 kg', 'Your date was 11 Sept. 14 Oct at this pace']
  ];
  for (const [name, overrides, figure, tail, caption] of cases) {
    it(`reads ${name}`, () => {
      const head = roadHeadline(goal(lossRoad(overrides)), lossRoad(overrides));
      expect([head.figure, head.tail, head.caption]).toEqual([figure, tail, caption]);
    });
  }

  it('reads REACHED with the day the last kilo was crossed and how early', () => {
    const road = lossRoad({ state: 'REACHED', fractionWeight: 1, nowKg: 67.9, distanceKg: 0.1, ticks: [{ kg: 68, crossedOn: '2026-11-18', projectedOn: null }] });
    const head = roadHeadline(goalWith(road), road);
    expect([head.figure, head.tail, head.caption]).toEqual(['68 kg', 'reached', 'On 18 Nov, 23 days early']);
  });

  it('reads STALLED with the date the weight stopped moving', () => {
    const road = lossRoad({ state: 'STALLED' });
    const stalled = { ...goalWith(road), weight: { ...goalWith(road).weight, daily: [{ date: '2026-09-06', kg: 72 }, { date: '2026-09-20', kg: 71.3 }, { date: '2026-10-01', kg: 71.2 }] } };
    expect(roadHeadline(stalled, road).caption).toBe('No change since 20 Sept');
  });

  it('reads the KEEP headline from the eight weekly means', () => {
    const road = lossRoad({
      direction: 'KEEP',
      targetKg: 70,
      nowKg: 69.9,
      keep: { bandKg: 1, weeks: [69.4, 70.2, 70.9, 69.8, 70.1, 71.4, 69.7, 69.9].map((avgKg, index) => ({ weekStart: `2026-08-${10 + index}`, avgKg, inside: Math.abs(avgKg - 70) <= 1 })) }
    });
    expect(keepHeadline(road)).toEqual({ figure: '7 of 8 weeks', tail: 'within 1 kg of 70 kg', caption: 'Latest weekly average 69.9 kg' });
    const g = keepGeometry(road, 600);
    expect(g.points.length).toBe(8);
    expect(g.points.at(-1)?.label).toBe('69.9');
    expect(g.laneBottom).toBeGreaterThan(g.laneTop);
  });

  it('adds a link to Me on the two states that need a decision', () => {
    expect(roadNote(lossRoad({ state: 'REACHED' })).link?.href).toBe('/me');
    expect(roadNote(lossRoad({ state: 'DATE_PASSED' })).link?.href).toBe('/me');
    expect(roadNote(lossRoad()).link).toBeUndefined();
    expect(roadNote(lossRoad()).text).toBe('25 Nov at this pace, 16 days before your date.');
    expect(roadNote(lossRoad({ state: 'BEHIND', projectedDate: '2027-01-03' })).text).toBe('3 Jan at this pace, 23 days after your date.');
  });
});

describe('the reduced road when the server sends none', () => {
  const base = () => mapGoalProgress(GOAL_WIRE);

  it('is built from the hero figures with no tick dates, and takes its state from the dates', () => {
    const road = deriveRoad(base(), TODAY)!;
    expect(road.derived).toBeTrue();
    expect(road.direction).toBe('LOSE');
    expect(road.state).toBe('AHEAD');
    expect(road.distanceKg).toBe(3.2);
    expect(road.ticks.every((tick) => tick.crossedOn === null && tick.projectedOn === null)).toBeTrue();
    expect(road.ticks[0].kg).toBe(71);
    expect(roadOf(base(), TODAY)?.state).toBe('AHEAD');
  });

  it('separates the states by 7 days, by the target, by the date and by a flat rate', () => {
    const state = (patch: Record<string, unknown>) => deriveRoad(mapGoalProgress({ ...GOAL_WIRE, ...patch }), TODAY)!.state;
    const hero = (extra: Record<string, unknown>) => ({ ...GOAL_WIRE.hero, ...extra });
    expect(state({ hero: hero({ projectedDate: { value: '2026-12-09' } }) })).toBe('ON_COURSE');
    expect(state({ hero: hero({ projectedDate: { value: '2027-01-03' } }) })).toBe('BEHIND');
    expect(state({ hero: hero({ nowKg: 67.8 }) })).toBe('REACHED');
    expect(state({ goal: { ...GOAL_WIRE.goal, byDate: '2026-09-30' } })).toBe('DATE_PASSED');
    expect(state({ hero: hero({ weeklyRate: { value: 0.02, previous: 0 } }) })).toBe('STALLED');
    expect(state({ hero: hero({ projectedDate: { value: null } }) })).toBe('NO_PROJECTION');
  });

  it('is null without a target or a weight', () => {
    expect(deriveRoad(mapGoalProgress({}), TODAY)).toBeNull();
    expect(deriveRoad(mapGoalProgress({ goal: { type: 'WEIGHT', targetKg: 68 } }), TODAY)).toBeNull();
  });
});

describe('the server road', () => {
  const wire = {
    direction: 'LOSE',
    state: 'ON_COURSE',
    startKg: 75,
    startDate: '2026-07-06',
    nowKg: 71.2,
    nowDate: '2026-10-01',
    targetKg: 68,
    targetDate: '2026-12-11',
    fractionWeight: 1.4,
    fractionTime: -1,
    projectedDate: '2026-12-09',
    ticks: [{ kg: 75, crossedOn: '2026-07-06' }, { kg: 74 }, { notAKilo: true }],
    keep: null
  };

  it('is read defensively: fractions clamp, a missing distance is worked out and bad ticks are dropped', () => {
    const road = mapRoad(wire)!;
    expect(road.fractionWeight).toBe(1);
    expect(road.fractionTime).toBe(0);
    expect(road.distanceKg).toBe(3.2);
    expect(road.ticks).toEqual([{ kg: 75, crossedOn: '2026-07-06', projectedOn: null }, { kg: 74, crossedOn: null, projectedOn: null }]);
    expect(mapRoad({ ...wire, state: 'SOMETHING' })).toBeNull();
    expect(mapRoad({ ...wire, targetKg: 'x' })).toBeNull();
    expect(mapRoad(undefined)).toBeNull();
  });

  it('wins over the derived road in roadOf', () => {
    const goal = { ...mapGoalProgress(GOAL_WIRE), road: mapRoad(wire) };
    expect(roadOf(goal, TODAY)?.derived).toBeFalse();
    expect(roadOf(goal, TODAY)?.state).toBe('ON_COURSE');
  });
});

describe('the lead goal and the Also row', () => {
  const habits = (list: Record<string, unknown>[]) => mapGoalProgress({ otherGoals: list });
  const protein = { type: 'PROTEIN', target: 140, unit: 'g', metDays: 42, loggedDays: 50, days: [] };
  const calories = { type: 'CALORIES', target: 2100, unit: 'kcal', metDays: 19, loggedDays: 26, days: [] };
  const steps = { type: 'STEPS', target: 8000, unit: 'steps', metDays: 30, loggedDays: 60, days: [] };

  it('leads with weight when it is active, else the habit with most logged days, ties by the fixed order, never steps', () => {
    expect(leadOf(mapGoalProgress(GOAL_WIRE)).kind).toBe('WEIGHT');
    const lead = leadOf(habits([steps, calories, protein]));
    expect(lead.kind === 'HABIT' && lead.goal.type).toBe('PROTEIN');
    const tied = leadOf(habits([{ ...protein, loggedDays: 26 }, calories]));
    expect(tied.kind === 'HABIT' && tied.goal.type).toBe('CALORIES');
    expect(leadOf(habits([steps])).kind).toBe('NONE');
  });

  it('follows the server when it names the lead', () => {
    const goal = { ...habits([protein, calories]), leadType: 'CALORIES' };
    const lead = leadOf(goal);
    expect(lead.kind === 'HABIT' && lead.goal.type).toBe('CALORIES');
  });

  it('has one pill for every other goal, "nothing logged yet" for an empty one and none for steps', () => {
    const goal = habits([protein, calories, steps, { type: 'FAT', target: 70, unit: 'g', metDays: 0, loggedDays: 0, days: [] }]);
    const pills = alsoPills(goal, leadOf(goal));
    expect(pills).toEqual([
      { name: 'Calories', figure: '19 of 26 days' },
      { name: 'Fat', figure: 'nothing logged yet' }
    ]);
    expect(alsoPills(mapGoalProgress({}), { kind: 'NONE' })).toEqual([]);
  });
});

describe('the Goal card view', () => {
  it('shows the road for weight, the lane for KEEP, the strip for a habit and an empty road otherwise', () => {
    expect(goalCardView(goalWith(lossRoad()), TODAY).picture).toBe('ROAD');
    const keep = lossRoad({ direction: 'KEEP', targetKg: 70, nowKg: 69.9, keep: { bandKg: 1, weeks: [{ weekStart: '2026-09-28', avgKg: 69.9, inside: true }] } });
    expect(goalCardView(goalWith(keep), TODAY).picture).toBe('KEEP');
    const habit = goalCardView(mapGoalProgress({ otherGoals: [{ type: 'PROTEIN', target: 140, unit: 'g', metDays: 42, loggedDays: 50, days: Array.from({ length: 60 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, state: i % 6 ? 'MET' : 'MISSED' })) }] }), TODAY);
    expect(habit.picture).toBe('HABIT');
    expect(habit.headline.figure).toBe('42 of 50 days');
    expect(habit.headline.tail).toBe('at 140 g protein');
    expect(habit.headline.caption).toBe('Logged 50 of the last 60 days');
    expect(habit.stripShare).toBe('84% of days');
    const empty = goalCardView(mapGoalProgress({}), TODAY);
    expect(empty.picture).toBe('EMPTY');
    expect(empty.headline).toEqual({ figure: 'No goal yet', tail: '', caption: 'Set one in Me' });
  });

  it('writes the three lines from the road and the body figures', () => {
    const view = goalCardView(goalWith(lossRoad()), TODAY);
    expect(view.lines.map((line) => `${line.figure} ${line.text}`.trim())).toEqual([
      '71.2 kg today, down 3.8 kg since July',
      '0.41 kg a week, 16 days ahead of your date',
      'Waist −2.1 cm in 4 weeks'
    ]);
    expect(view.lines.map((line) => line.trend)).toEqual(['down', 'faster', 'down']);
  });
});

describe('the dot strip geometry', () => {
  it('lays sixty days in three rows of twenty and shrinks the dots with the width', () => {
    const items = Array.from({ length: 60 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, state: 'MET' as const }));
    const wide = stripGeometry(items, 700);
    expect(wide.rows).toBe(3);
    expect(wide.perRow).toBe(20);
    expect(wide.dot).toBe(24);
    expect(wide.cells[20].y).toBeGreaterThan(wide.cells[0].y);
    const narrow = stripGeometry(items, 340);
    expect(narrow.dot).toBeLessThan(wide.dot);
    expect(narrow.stripWidth).toBeLessThanOrEqual(340 - 96);
  });
});
