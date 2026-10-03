import { parseLocalDate, shortDateLabel } from '../../../shared/date-label';
import { daysBetween, formatNumber } from '../../../shared/progress/progress-format';
import { GoalProgress, GoalRoad, OtherGoal, RoadState, RoadTick } from '../progress-api.models';

/** The state a Progress page speaks of: the road's, or the two cases where there is no road. */
export type VerdictState = RoadState | 'NO_GOAL' | 'NO_DATA';

export interface Verdict {
  text: string;
  /** Green says "on its way"; everything else reads in ink. */
  tone: 'green' | 'ink';
}

const VERDICTS: Record<VerdictState, Verdict> = {
  AHEAD: { text: 'Ahead of plan.', tone: 'green' },
  ON_COURSE: { text: 'On course.', tone: 'green' },
  NO_PROJECTION: { text: 'On course.', tone: 'green' },
  REACHED: { text: 'Goal reached.', tone: 'green' },
  BEHIND: { text: 'Behind plan.', tone: 'ink' },
  DATE_PASSED: { text: 'Past your date.', tone: 'ink' },
  STALLED: { text: 'Holding steady.', tone: 'ink' },
  NO_GOAL: { text: 'No goal yet.', tone: 'ink' },
  NO_DATA: { text: 'Start logging.', tone: 'ink' }
};

export function verdictFor(state: VerdictState): Verdict {
  return VERDICTS[state];
}

/** The state of the page: a weight road speaks for itself; a habit lead or no goal reads "No goal yet". */
export function pageState(goal: GoalProgress | null, today: string): VerdictState {
  if (!goal) {
    return 'NO_DATA';
  }
  const road = roadOf(goal, today);
  if (road) {
    return road.state;
  }
  if (leadOf(goal).kind === 'HABIT') {
    return 'NO_GOAL';
  }
  return hasWeightData(goal) ? 'NO_GOAL' : 'NO_DATA';
}

export function hasWeightData(goal: GoalProgress): boolean {
  return goal.hero.nowKg !== null || goal.weight.daily.length > 0 || goal.weight.weekly.length > 0;
}

/** "25 Nov": a day and a month, never a year; the card's dates all fall inside the goal's own span. */
export function day(key: string | null | undefined): string {
  return key ? shortDateLabel(key, parseLocalDate(key)) : '';
}

function nowOf(goal: GoalProgress): number | null {
  return goal.hero.nowKg ?? goal.weight.daily.at(-1)?.kg ?? goal.weight.weekly.at(-1)?.avgKg ?? null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The road the server sent, else a reduced one built from the hero figures (no tick dates). */
export function roadOf(goal: GoalProgress, today: string): GoalRoad | null {
  return goal.road ?? deriveRoad(goal, today);
}

/** State from the dates, as the server does: 7 days or more early is AHEAD, 7 or more late is BEHIND. */
export function deriveRoad(goal: GoalProgress, today: string): GoalRoad | null {
  const target = goal.goal?.targetKg ?? null;
  const now = nowOf(goal);
  if (target === null || now === null) {
    return null;
  }
  const first = goal.weight.daily[0] ?? (goal.weight.weekly[0] ? { date: goal.weight.weekly[0].weekStart, kg: goal.weight.weekly[0].avgKg } : null);
  const startKg = first?.kg ?? now;
  const startDate = first?.date ?? null;
  const by = goal.goal?.byDate ?? null;
  const projected = goal.hero.projectedDate.value;
  const rate = goal.hero.weeklyRate.value;
  const direction = Math.abs(target - startKg) <= 1 ? 'KEEP' : target < startKg ? 'LOSE' : 'GAIN';
  const reached = direction === 'LOSE' ? now <= target : direction === 'GAIN' ? now >= target : false;

  let state: RoadState;
  if (reached) {
    state = 'REACHED';
  } else if (by && today > by) {
    state = 'DATE_PASSED';
  } else if (rate !== null && Math.abs(rate) < 0.05) {
    state = 'STALLED';
  } else if (!projected) {
    state = 'NO_PROJECTION';
  } else if (!by) {
    state = 'ON_COURSE';
  } else {
    const early = daysBetween(projected, by);
    state = early >= 7 ? 'AHEAD' : early <= -7 ? 'BEHIND' : 'ON_COURSE';
  }

  const total = Math.abs(target - startKg);
  const keepWeeks = goal.weight.weekly.slice(-8).map((week) => ({ weekStart: week.weekStart, avgKg: week.avgKg, inside: Math.abs(week.avgKg - target) <= 1 }));
  return {
    direction,
    state,
    startKg,
    startDate,
    nowKg: now,
    nowDate: goal.weight.daily.at(-1)?.date ?? null,
    targetKg: target,
    targetDate: by,
    distanceKg: round1(Math.abs(target - now)),
    fractionWeight: reached ? 1 : total === 0 ? 0 : clamp01(Math.abs(now - startKg) / total),
    fractionTime: startDate && by && daysBetween(startDate, by) > 0 ? clamp01(daysBetween(startDate, today) / daysBetween(startDate, by)) : 0,
    projectedDate: projected,
    ticks: direction === 'KEEP' ? [] : wholeKilos(startKg, target).map((kg) => ({ kg, crossedOn: null, projectedOn: null })),
    keep: direction === 'KEEP' ? { bandKg: 1, weeks: keepWeeks } : null,
    derived: true
  };
}

/** Every whole kilo between the start and the target, from the start side. */
export function wholeKilos(startKg: number, targetKg: number): number[] {
  const low = Math.ceil(Math.min(startKg, targetKg) - 1e-9);
  const high = Math.floor(Math.max(startKg, targetKg) + 1e-9);
  const list: number[] = [];
  for (let kg = low; kg <= high; kg += 1) {
    list.push(kg);
  }
  return targetKg < startKg ? list.reverse() : list;
}

// ---------------------------------------------------------------- the lead goal

export const HABIT_ORDER = ['CALORIES', 'PROTEIN', 'WORKOUT_FREQUENCY', 'CARBS', 'FAT'] as const;

const NAMES: Record<string, string> = { CALORIES: 'Calories', PROTEIN: 'Protein', CARBS: 'Carbs', FAT: 'Fat', WORKOUT_FREQUENCY: 'Workouts', WEIGHT: 'Weight', STEPS: 'Steps' };

export function goalName(type: string): string {
  return NAMES[type] ?? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
}

export type Lead = { kind: 'WEIGHT' } | { kind: 'HABIT'; goal: OtherGoal } | { kind: 'NONE' };

function logged(goal: OtherGoal): number {
  return goal.loggedDays ?? goal.days.filter((day) => day.state !== 'NOT_LOGGED' && day.state !== 'FUTURE').length;
}

/** WEIGHT when active; else the habit goal with most logged days, ties by the fixed order. STEPS never leads. */
export function leadOf(goal: GoalProgress): Lead {
  const habits = goal.otherGoals.filter((item) => item.type !== 'STEPS' && item.type !== 'WEIGHT');
  const weightActive = goal.goal?.targetKg !== null && goal.goal?.targetKg !== undefined;
  if (goal.leadType === 'WEIGHT' && weightActive) {
    return { kind: 'WEIGHT' };
  }
  const named = goal.leadType && goal.leadType !== 'WEIGHT' ? habits.find((item) => item.type === goal.leadType) : undefined;
  if (named) {
    return { kind: 'HABIT', goal: named };
  }
  if (weightActive) {
    return { kind: 'WEIGHT' };
  }
  const order = (type: string): number => {
    const index = (HABIT_ORDER as readonly string[]).indexOf(type);
    return index < 0 ? HABIT_ORDER.length : index;
  };
  const best = [...habits].sort((a, b) => logged(b) - logged(a) || order(a.type) - order(b.type))[0];
  return best ? { kind: 'HABIT', goal: best } : { kind: 'NONE' };
}

export function figureOf(goal: OtherGoal): string {
  return goal.target === null ? '' : `${formatNumber(goal.target)}${goal.unit ? ` ${goal.unit}` : ''}`;
}

export function habitTarget(goal: OtherGoal): string {
  return goal.type === 'WORKOUT_FREQUENCY' ? `${formatNumber(goal.target ?? 0)}` : figureOf(goal);
}

const weekly = (goal: OtherGoal): boolean => goal.type === 'WORKOUT_FREQUENCY';

export interface AlsoPill {
  name: string;
  figure: string;
}

/** One pill per other active goal; STEPS stays out until step data exists. */
export function alsoPills(goal: GoalProgress, lead: Lead): AlsoPill[] {
  return goal.otherGoals
    .filter((item) => item.type !== 'STEPS' && item.type !== 'WEIGHT' && !(lead.kind === 'HABIT' && lead.goal.type === item.type))
    .map((item) => {
      const count = logged(item);
      const unit = weekly(item) ? 'weeks' : 'days';
      return { name: goalName(item.type), figure: count > 0 ? `${item.metDays ?? 0} of ${count} ${unit}` : 'nothing logged yet' };
    });
}

// ---------------------------------------------------------------- the headline and its words

export interface CardHeadline {
  figure: string;
  tail: string;
  caption: string;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function earlyWords(early: number): string {
  return early === 0 ? 'on your date' : early > 0 ? `${plural(early, 'day')} early` : `${plural(-early, 'day')} late`;
}

export function reachedOn(road: GoalRoad): string | null {
  const last = road.ticks.find((tick) => tick.kg === road.targetKg);
  return last?.crossedOn ?? road.nowDate;
}

export function stalledSince(goal: GoalProgress, road: GoalRoad): string | null {
  const daily = goal.weight.daily;
  for (let index = daily.length - 1; index >= 0; index -= 1) {
    if (Math.abs(daily[index].kg - road.nowKg) > 0.3) {
      return daily[Math.min(index + 1, daily.length - 1)].date;
    }
  }
  return daily[0]?.date ?? goal.period?.from ?? null;
}

/** The weight road's headline and caption for each state (spec 1.4). */
export function roadHeadline(goal: GoalProgress, road: GoalRoad): CardHeadline {
  const date = (key: string | null): string => day(key);
  const target = `${formatNumber(road.targetKg, road.targetKg % 1 ? 1 : 0)} kg`;
  const early = road.projectedDate && road.targetDate ? daysBetween(road.projectedDate, road.targetDate) : null;
  const base = { figure: `${formatNumber(road.distanceKg, 1)} kg`, tail: `to ${target}` };
  switch (road.state) {
    case 'AHEAD':
      return { ...base, caption: `On course for ${date(road.projectedDate)}${early === null ? '' : `, ${earlyWords(early)}`}` };
    case 'ON_COURSE':
      return { ...base, caption: road.projectedDate ? `On course for ${date(road.projectedDate)}` : 'On course' };
    case 'BEHIND':
      return { ...base, caption: `At this pace ${date(road.projectedDate)}${early === null ? '' : `, ${earlyWords(early)}`}` };
    case 'REACHED': {
      const on = reachedOn(road);
      const days = on && road.targetDate ? daysBetween(on, road.targetDate) : null;
      return { figure: target, tail: 'reached', caption: on ? `On ${date(on)}${days === null ? '' : `, ${earlyWords(days)}`}` : '' };
    }
    case 'DATE_PASSED':
      return { ...base, caption: `Your date was ${date(road.targetDate)}.${road.projectedDate ? ` ${date(road.projectedDate)} at this pace` : ''}` };
    case 'STALLED': {
      const since = stalledSince(goal, road);
      return { ...base, caption: since ? `No change since ${date(since)}` : 'No change lately' };
    }
    default:
      return { ...base, caption: 'A date appears after a few more weigh-ins' };
  }
}

export interface PictureNote {
  text: string;
  link?: { label: string; href: string; fragment?: string };
}

/** The one caption line under the road. */
export function roadNote(road: GoalRoad): PictureNote {
  const date = day(road.projectedDate);
  const gap = road.projectedDate && road.targetDate ? daysBetween(road.projectedDate, road.targetDate) : null;
  switch (road.state) {
    case 'AHEAD':
      return { text: `${date} at this pace, ${plural(gap ?? 0, 'day')} before your date.` };
    case 'ON_COURSE':
      return { text: road.projectedDate ? `${date} at this pace, close to your date.` : 'On course for your date.' };
    case 'BEHIND':
      return { text: `${date} at this pace, ${plural(Math.abs(gap ?? 0), 'day')} after your date.` };
    case 'REACHED':
      return { text: 'You are there.', link: { label: 'Set a new goal in Me ›', href: '/me', fragment: 'goal-lifecycle' } };
    case 'DATE_PASSED':
      return { text: 'The date has gone by.', link: { label: 'Move your date in Me ›', href: '/me', fragment: 'goal-lifecycle' } };
    case 'STALLED':
      return { text: 'Your weight has held still, so no date is drawn.' };
    default:
      return { text: 'Log a few more weigh-ins and a date appears.' };
  }
}

export function keepHeadline(road: GoalRoad): CardHeadline {
  const weeks = road.keep?.weeks ?? [];
  const inside = weeks.filter((week) => week.inside).length;
  const band = road.keep?.bandKg ?? 1;
  const latest = weeks.at(-1)?.avgKg ?? road.nowKg;
  return {
    figure: `${inside} of ${weeks.length} weeks`,
    tail: `within ${formatNumber(band, band % 1 ? 1 : 0)} kg of ${formatNumber(road.targetKg, road.targetKg % 1 ? 1 : 0)} kg`,
    caption: `Latest weekly average ${formatNumber(latest, 1)} kg`
  };
}

const HABIT_WORDS: Record<string, string> = { CALORIES: 'calories', PROTEIN: 'protein', CARBS: 'carbs', FAT: 'fat' };

export function habitItems(goal: OtherGoal): { date: string; state: 'MET' | 'MISSED' | 'NOT_LOGGED' }[] {
  if (goal.days.length) {
    return goal.days.slice(-60).map((day) => ({ date: day.date, state: day.state === 'MET' ? 'MET' : day.state === 'MISSED' ? 'MISSED' : 'NOT_LOGGED' }));
  }
  return goal.weeks.slice(-20).map((week) => ({ date: week.weekStart, state: week.target !== null && week.value >= week.target ? 'MET' : 'MISSED' }));
}

export function habitHeadline(goal: OtherGoal): CardHeadline {
  const items = habitItems(goal);
  const count = logged(goal);
  const unit = weekly(goal) ? 'weeks' : 'days';
  const tail = weekly(goal) ? `at ${habitTarget(goal)} workouts a week` : `at ${figureOf(goal)} ${HABIT_WORDS[goal.type] ?? ''}`.trim();
  return {
    figure: `${goal.metDays ?? 0} of ${count} ${unit}`,
    tail,
    caption: `Logged ${count} of the last ${items.length} ${unit}`
  };
}

/** The share a bullseye reports under it: "88% of weeks", "84% of days". */
export function habitShare(goal: OtherGoal): string {
  const count = logged(goal);
  return count === 0 ? '' : `${Math.round(((goal.metDays ?? 0) / count) * 100)}% of ${weekly(goal) ? 'weeks' : 'days'}`;
}

export function keepShare(road: GoalRoad): string {
  const weeks = road.keep?.weeks ?? [];
  return weeks.length ? `${Math.round((weeks.filter((week) => week.inside).length / weeks.length) * 100)}% of weeks` : '';
}

// ---------------------------------------------------------------- the three summary lines

export function monthName(key: string | null): string {
  const month = key ? Number(key.slice(5, 7)) : 0;
  return month >= 1 && month <= 12 ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1] : '';
}

/** The period the response was read for, as the lines name it: "4 weeks", "3 months", "a year". */
export interface Span {
  words: string;
  days: number;
}

export const FOUR_WEEKS: Span = { words: '4 weeks', days: 28 };

/** The sentence under the verdict when the coach's reading is not there: "71.2 kg, losing 0.4 kg a week." */
export function ruleSentence(goal: GoalProgress | null): string {
  if (!goal) {
    return 'Log a weigh-in, a meal or a workout and this page starts to answer.';
  }
  const now = nowOf(goal);
  if (now === null) {
    return 'Log a weigh-in, a meal or a workout and this page starts to answer.';
  }
  const rate = goal.hero.weeklyRate.value;
  if (rate === null || Math.abs(rate) < 0.05) {
    return `${formatNumber(now, 1)} kg, holding steady.`;
  }
  return `${formatNumber(now, 1)} kg, ${rate < 0 ? 'losing' : 'gaining'} ${formatNumber(Math.abs(rate), 1)} kg a week.`;
}

// ---------------------------------------------------------------- the picture

/** The road is drawn at its own height and the caption follows it; the other pictures fill their box. */
export const ROAD_HEIGHT = 126;
export const PICTURE_HEIGHT = 240;
const END_PAD = 28;
const START_PAD = 12;
/** Whole-kilo numbers are never dropped; ticks are thinned instead so their numbers keep this much room. */
const MIN_KG_GAP = 24;
const MIN_DATE_GAP = 56;
/** A kilo label this close to the bullseye would touch the target label, which is then raised. */
const TARGET_CLEAR = 62;

export interface RoadMark {
  kg: number;
  x: number;
  /** The whole-kilo number above the tick; null only for the target tick, which the target label names. */
  label: string | null;
  /** The date under the tick: crossing for passed ticks, projection for the rest. */
  date: string | null;
  crossed: boolean;
}

export interface RoadGeometry {
  width: number;
  x0: number;
  x1: number;
  todayX: number;
  marks: RoadMark[];
  today: { anchor: 'start' | 'middle' | 'end' };
  dashed: 'green' | 'slate' | null;
  reached: boolean;
  percent: string;
  /** True when the last kilo number sits so near the bullseye that the target label is lifted above it. */
  raiseTarget: boolean;
}

function tickDate(tick: RoadTick, crossed: boolean): string | null {
  const key = crossed ? tick.crossedOn : tick.projectedOn;
  return key ? day(key) : null;
}

/** Pixel positions for the road at the width it is drawn at, with labels thinned so none touch. */
export function roadGeometry(road: GoalRoad, width: number): RoadGeometry {
  const x0 = START_PAD;
  const x1 = Math.max(x0 + 40, width - END_PAD);
  const span = x1 - x0;
  const total = Math.abs(road.targetKg - road.startKg);
  const at = (fraction: number): number => x0 + clamp01(fraction) * span;
  const kgAt = (kg: number): number => at(total === 0 ? 0 : Math.abs(kg - road.startKg) / total);
  const todayX = at(road.fractionWeight);

  // Ticks closer than their numbers need are thinned to every second, fifth or tenth kilo.
  const perKilo = road.ticks.length > 1 ? span / (road.ticks.length - 1) : span;
  const step = [1, 2, 5, 10, 20, 50].find((candidate) => perKilo * candidate >= MIN_KG_GAP) ?? 50;
  let lastDate = -Infinity;
  const marks: RoadMark[] = [];
  road.ticks.forEach((tick, index) => {
    if (index % step !== 0) {
      return;
    }
    const x = kgAt(tick.kg);
    const crossed = tick.crossedOn !== null || x <= todayX;
    const isTarget = tick.kg === road.targetKg;
    const label = isTarget ? null : formatNumber(tick.kg);
    let date = tickDate(tick, crossed);
    const touchesToday = Math.abs(x - todayX) < MIN_DATE_GAP;
    if (date !== null && (x - lastDate < MIN_DATE_GAP || touchesToday)) {
      date = null;
    }
    if (date !== null) {
      lastDate = x;
    }
    marks.push({ kg: tick.kg, x, label, date, crossed });
  });

  const reached = road.state === 'REACHED';
  return {
    width,
    x0,
    x1,
    todayX,
    marks,
    today: { anchor: todayX < 24 ? 'start' : todayX > width - 24 ? 'end' : 'middle' },
    dashed: reached || road.state === 'STALLED' ? null : road.state === 'DATE_PASSED' ? 'slate' : 'green',
    reached,
    percent: `${Math.round(road.fractionWeight * 100)}% of the way`,
    raiseTarget: marks.some((mark) => mark.label !== null && x1 - mark.x < TARGET_CLEAR)
  };
}

// ---------------------------------------------------------------- the keep lane

export interface KeepGeometry {
  x0: number;
  x1: number;
  laneTop: number;
  laneBottom: number;
  targetY: number;
  points: { x: number; y: number; inside: boolean; label: string | null; weekStart: string }[];
  line: string;
  firstDate: string;
  lastDate: string;
}

const KEEP_TOP = 56;

export function keepGeometry(road: GoalRoad, width: number, height = PICTURE_HEIGHT): KeepGeometry {
  const bottom = height - 50;
  const weeks = road.keep?.weeks ?? [];
  const band = road.keep?.bandKg ?? 1;
  const values = weeks.map((week) => week.avgKg);
  const lo = Math.min(road.targetKg - band, ...values) - 0.3;
  const hi = Math.max(road.targetKg + band, ...values) + 0.3;
  const y = (kg: number): number => bottom - ((kg - lo) / (hi - lo)) * (bottom - KEEP_TOP);
  const x0 = START_PAD;
  const x1 = Math.max(x0 + 40, width - END_PAD);
  const lastX = Math.max(x0, x1 - 44);
  const points = weeks.map((week, index) => ({
    x: weeks.length > 1 ? x0 + (index / (weeks.length - 1)) * (lastX - x0) : x0,
    y: y(week.avgKg),
    inside: week.inside,
    label: index === weeks.length - 1 ? formatNumber(week.avgKg, 1) : null,
    weekStart: week.weekStart
  }));
  return {
    x0,
    x1,
    laneTop: y(road.targetKg + band),
    laneBottom: y(road.targetKg - band),
    targetY: y(road.targetKg),
    points,
    line: points.map((point) => `${point.x},${point.y}`).join(' '),
    firstDate: day(weeks[0]?.weekStart),
    lastDate: day(weeks.at(-1)?.weekStart)
  };
}

// ---------------------------------------------------------------- the dot strip

export interface StripGeometry {
  pitch: number;
  dot: number;
  perRow: number;
  cells: { x: number; y: number; state: 'MET' | 'MISSED' | 'NOT_LOGGED'; date: string }[];
  stripWidth: number;
  rows: number;
  firstDate: string;
  lastDate: string;
}

const STRIP_ROW = 20;
const STRIP_RIGHT = 96;

export function stripGeometry(items: { date: string; state: 'MET' | 'MISSED' | 'NOT_LOGGED' }[], width: number): StripGeometry {
  const perRow = Math.min(STRIP_ROW, Math.max(1, items.length));
  const rows = Math.max(1, Math.ceil(items.length / STRIP_ROW));
  const pitch = Math.max(8, Math.min(30, Math.floor((width - STRIP_RIGHT) / perRow)));
  const dot = Math.min(24, pitch - 4);
  return {
    pitch,
    dot,
    perRow,
    cells: items.map((item, index) => ({
      x: (index % STRIP_ROW) * pitch + pitch / 2,
      y: Math.floor(index / STRIP_ROW) * pitch + pitch / 2,
      state: item.state,
      date: item.date
    })),
    stripWidth: perRow * pitch,
    rows,
    firstDate: day(items[0]?.date),
    lastDate: day(items.at(-1)?.date)
  };
}
