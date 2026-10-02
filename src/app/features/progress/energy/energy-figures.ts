import { addDays, parseIsoDate, weekOf } from '../../nutrition/diary/diary-time';
import { EnergyDay, EnergyWeek, EnergyWeekPoint } from './energy.models';

/** The minus sign of the boards, so a number reads as one figure. */
const MINUS = '−';

const group = (value: number): string => Math.round(value).toLocaleString('en-GB');

/** A kcal figure with its sign, such as "-438" or "+12". */
export function signedKcal(value: number): string {
  const rounded = Math.round(value);
  return rounded === 0 ? '0' : `${rounded < 0 ? MINUS : '+'}${group(Math.abs(rounded))}`;
}

// ---------------------------------------------------------------- weeks

export function shiftWeek(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7);
}

/** The Monday of the week that holds today. */
export function thisMonday(today: string): string {
  return weekOf(today)[0];
}

const shortDay = (iso: string): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parseIsoDate(iso));

/** "28 Sept to 4 Oct". */
export function weekLabel(weekStart: string, weekEnd: string): string {
  return `${shortDay(weekStart)} to ${shortDay(weekEnd)}`;
}

// ---------------------------------------------------------------- the dial

/** The balance at either end of the dial, in kcal. */
export const DIAL_LIMIT = 1000;

/**
 * The angle of the needle in radians, on a half circle that runs from the left (pi, 1,000 under)
 * over the top (3 pi / 2, even) to the right (2 pi, 1,000 over). A balance past either end sits
 * at that end.
 */
export function dialAngle(balance: number): number {
  const clamped = Math.min(Math.max(balance, -DIAL_LIMIT), DIAL_LIMIT);
  return Math.PI + (Math.PI * (clamped + DIAL_LIMIT)) / (2 * DIAL_LIMIT);
}

export interface DialGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  r: number;
  track: string;
  /** The filled part of the arc between even (the top) and the needle, on the needle's side; empty at even. */
  value: string;
  needle: { x: number; y: number };
  tick: { x1: number; y1: number; x2: number; y2: number };
  labels: { left: { x: number; y: number }; even: { x: number; y: number }; right: { x: number; y: number } };
}

const fixed = (value: number): string => value.toFixed(1);

export function dialGeometry(size: number, balance: number): DialGeometry {
  const cx = size / 2;
  const cy = size * 0.56;
  const r = size * 0.42;
  const at = (radius: number, angle: number) => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  const arc = (from: number, to: number): string => {
    const a = at(r, from);
    const b = at(r, to);
    return `M${fixed(a.x)} ${fixed(a.y)} A${fixed(r)} ${fixed(r)} 0 0 1 ${fixed(b.x)} ${fixed(b.y)}`;
  };
  const angle = dialAngle(balance);
  return {
    width: size,
    height: Math.round(size * 0.66),
    cx,
    cy,
    r,
    track: arc(Math.PI, 2 * Math.PI),
    value: Math.abs(angle - 1.5 * Math.PI) < 0.001 ? '' : arc(Math.min(angle, 1.5 * Math.PI), Math.max(angle, 1.5 * Math.PI)),
    needle: at(r - 22, angle),
    tick: { x1: cx, y1: cy - r - 14, x2: cx, y2: cy - r + 14 },
    labels: { left: { x: cx - r, y: cy + 24 }, even: { x: cx, y: cy - r - 20 }, right: { x: cx + r, y: cy + 24 } }
  };
}

export interface Headline {
  value: string;
  unit: string;
  direction: 'under' | 'over' | 'even';
}

/** The big number: "241" with "kcal a day under", the same either way and never a warning. */
export function headline(balance: number): Headline {
  const rounded = Math.round(Math.abs(balance));
  if (rounded === 0) {
    return { value: '0', unit: 'kcal a day, even', direction: 'even' };
  }
  const direction = balance < 0 ? 'under' : 'over';
  return { value: group(rounded), unit: `kcal a day ${direction}`, direction };
}

/** "about 0.22 kg a week · food logged on 5 of 7 days". */
export function subLine(week: EnergyWeek): string {
  const parts: string[] = [];
  if (week.weeklyKgEquivalent !== null) {
    parts.push(`about ${Math.abs(week.weeklyKgEquivalent).toFixed(2)} kg a week`);
  }
  parts.push(`food logged on ${week.daysLogged} of 7 days`);
  return parts.join(' · ');
}

/** What a screen reader gets for the dial. */
export function dialSummary(balance: number): string {
  const text = headline(balance);
  return text.direction === 'even'
    ? 'The daily average is even.'
    : `The daily average is ${text.value} kcal ${text.direction}, on a dial from 1,000 under to 1,000 over.`;
}

// ---------------------------------------------------------------- the two bars

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  /** Width as a percentage of the longer bar. */
  percent: number;
  showLabel: boolean;
}

export interface EnergyBars {
  eatenTotal: number;
  usedTotal: number;
  eaten: BarSegment[];
  used: BarSegment[];
  /** The gap between the two bars: where it starts, how wide, and its words. Null when they match. */
  bracket: { left: number; width: number; label: string; align: 'start' | 'center' | 'end' } | null;
}

const MEAL_LABELS: readonly [keyof NonNullable<EnergyWeek['mealSplit']>, string][] = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snack', 'Snacks'],
  ['other', 'Other']
];
/** A segment at least this wide (percent) has room for its name inside. */
const LABEL_FROM = 16;

function segments(parts: { key: string; label: string; value: number | null }[], longest: number): BarSegment[] {
  return parts
    .filter((part): part is { key: string; label: string; value: number } => part.value !== null && part.value > 0)
    .map((part) => {
      const percent = (part.value / longest) * 100;
      return { ...part, percent, showLabel: percent >= LABEL_FROM };
    });
}

/** Where the words under the bracket sit: centred on the gap, but pinned to an edge near it so they never leave the card. */
function labelAlign(centre: number): 'start' | 'center' | 'end' {
  return centre > 75 ? 'end' : centre < 10 ? 'start' : 'center';
}

/** The eaten and used bars on one scale, or null when the week has no average to draw. */
export function energyBars(week: EnergyWeek): EnergyBars | null {
  const average = week.average;
  if (!average || average.eaten === null || average.used === null) {
    return null;
  }
  const longest = Math.max(average.eaten, average.used);
  if (longest <= 0) {
    return null;
  }
  const split = week.mealSplit;
  const eaten = split
    ? segments(MEAL_LABELS.map(([key, label]) => ({ key, label, value: split[key] })), longest)
    : segments([{ key: 'eaten', label: 'Eaten', value: average.eaten }], longest);
  const used = segments(
    [
      { key: 'resting', label: `Resting × ${week.restingFactor}`, value: average.resting },
      { key: 'workouts', label: 'Workouts', value: average.workouts }
    ],
    longest
  );
  const gap = average.used - average.eaten;
  const rounded = Math.round(Math.abs(gap));
  const bracket =
    rounded === 0
      ? null
      : {
          left: (Math.min(average.eaten, average.used) / longest) * 100,
          width: (Math.abs(gap) / longest) * 100,
          label: `${group(rounded)} ${gap > 0 ? 'under' : 'over'}`,
          align: labelAlign(Math.min(average.eaten, average.used) / longest * 100 + (Math.abs(gap) / longest) * 50)
        };
  return { eatenTotal: average.eaten, usedTotal: average.used, eaten, used, bracket };
}

export function barsSummary(bars: EnergyBars): string {
  const gap = bars.bracket ? `, ${bars.bracket.label}` : '';
  return `Eaten ${group(bars.eatenTotal)} kcal a day, used ${group(bars.usedTotal)} kcal a day${gap}.`;
}

// ---------------------------------------------------------------- each day

export interface DayColumn {
  date: string;
  label: string;
  logged: boolean;
  /** True when the workout calories of the day were estimated, shown as an approximate sign. */
  estimated: boolean;
  /** Today, still going: what was eaten so far is drawn lighter and the label says "so far". */
  today: boolean;
  /** The shadow: what the day used, as a percentage of the chart height. */
  shadow: number;
  /** What was eaten, drawn inside the shadow; null for a day that was not logged. */
  eaten: number | null;
  note: string;
}

export interface DayColumns {
  top: number;
  /** The height of each gridline as a percentage, with its kcal value. */
  grid: { kcal: number; percent: number }[];
  columns: DayColumn[];
}

const weekdayOf = (iso: string): string => new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parseIsoDate(iso));

/** What a day used: resting plus workouts. A day the server left without a resting figure uses the week's. */
export function usedOf(day: EnergyDay, week: EnergyWeek): number {
  const resting = day.resting ?? (week.bmrKcal === null ? 0 : week.bmrKcal * week.restingFactor);
  return resting + (day.workouts ?? 0);
}

export function dayColumns(week: EnergyWeek): DayColumns {
  const peak = Math.max(0, ...week.days.map((day) => Math.max(usedOf(day, week), day.eaten ?? 0)));
  const top = Math.max(2000, Math.ceil(peak / 500) * 500);
  const grid: DayColumns['grid'] = [];
  for (let kcal = 1000; kcal <= top; kcal += 1000) {
    grid.push({ kcal, percent: (kcal / top) * 100 });
  }
  const columns = week.days.map((day): DayColumn => {
    const logged = day.logged && day.eaten !== null;
    return {
      date: day.date,
      label: weekdayOf(day.date),
      logged,
      estimated: day.workoutsEstimated,
      today: day.today,
      shadow: (usedOf(day, week) / top) * 100,
      eaten: logged ? ((day.eaten ?? 0) / top) * 100 : null,
      note: day.today && logged ? 'so far' : logged && day.balance !== null ? signedKcal(day.balance) : 'not logged'
    };
  });
  return { top, grid, columns };
}

export function daysSummary(columns: readonly DayColumn[]): string {
  const logged = columns.filter((column) => column.logged && !column.today).length;
  const notes = columns.map((column) => `${column.label} ${column.note}`).join(', ');
  return `Each day of the week, food logged on ${logged} of ${columns.length} days. ${notes}.`;
}

// ---------------------------------------------------------------- adding up

export interface RunningPoint {
  x: number;
  y: number;
  /** False for a day with no food log, drawn as a hollow dot on the line. */
  logged: boolean;
  value: number;
  label: string;
}

export interface RunningChart {
  points: RunningPoint[];
  line: string;
  area: string;
  zeroY: number;
  /** The total at the end of the week, or null when nothing was logged. */
  end: { text: string; x: number; y: number } | null;
}

/** A vertical scale that always holds zero, with room for labels above and below. */
export function verticalScale(values: readonly number[], height: number, padTop: number, padBottom: number): (value: number) => number {
  let low = Math.min(0, ...values);
  let high = Math.max(0, ...values);
  if (high === low) {
    low = -1;
    high = 1;
  }
  const span = height - padTop - padBottom;
  return (value) => padTop + (span * (high - value)) / (high - low);
}

/**
 * The running total of the week as a line from a start of zero through the seven days. A day with
 * no food log keeps the total of the day before, so the line steps flat and the dot is hollow.
 */
export function runningChart(week: EnergyWeek, width: number, height: number): RunningChart {
  const padX = 10;
  const count = week.days.length;
  // The line stops at yesterday: today is not finished and the days after it have not happened.
  const firstToday = week.days.findIndex((day) => day.today);
  const counted = firstToday < 0 ? week.days : week.days.slice(0, firstToday);
  const x = (index: number): number => padX + ((width - padX * 2) * index) / Math.max(count, 1);
  const totals: { value: number; logged: boolean }[] = [{ value: 0, logged: true }];
  for (const day of counted) {
    const previous = totals[totals.length - 1].value;
    const logged = day.logged && day.runningTotal !== null;
    totals.push({ value: logged ? (day.runningTotal ?? previous) : previous, logged });
  }
  const y = verticalScale(
    totals.map((total) => total.value),
    height,
    14,
    28
  );
  const points = totals.map(
    (total, index): RunningPoint => ({
      x: x(index),
      y: y(total.value),
      logged: total.logged,
      value: total.value,
      label: index === 0 ? 'Start' : weekdayOf(counted[index - 1].date)
    })
  );
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${fixed(point.x)} ${fixed(point.y)}`).join(' ');
  const last = points[points.length - 1];
  const area = `${line} L${fixed(last.x)} ${fixed(y(0))} L${fixed(points[0].x)} ${fixed(y(0))} Z`;
  const anyLogged = counted.some((day) => day.logged);
  return {
    points,
    line,
    area,
    zeroY: y(0),
    end: anyLogged ? { text: `${signedKcal(last.value)} kcal`, x: last.x, y: last.y } : null
  };
}

export function runningSummary(chart: RunningChart, week: EnergyWeek): string {
  const stop = week.days.findIndex((day) => day.today);
  const logged = (stop < 0 ? week.days : week.days.slice(0, stop)).filter((day) => day.logged).length;
  return chart.end
    ? `Running total of the week, ${chart.end.text} after ${logged} logged days. Days without a food log add nothing.`
    : 'Running total of the week, no food logged yet.';
}

// ---------------------------------------------------------------- the last eight weeks

export interface WeeksChart {
  expected: string;
  expectedDots: { x: number; y: number }[];
  /** One path for each unbroken run of weigh-ins. */
  actual: string[];
  /** Weigh-ins that stand alone between two weeks without one. */
  actualDots: { x: number; y: number }[];
  zeroY: number;
}

/** The food log against the scale. A week without a weigh-in breaks the scale line instead of dropping it to zero. */
export function weeksChart(weeks: readonly EnergyWeekPoint[], width: number, height: number): WeeksChart {
  const padX = 10;
  const x = (index: number): number => padX + ((width - padX * 2) * index) / Math.max(weeks.length - 1, 1);
  const values = weeks.flatMap((week) => [week.expectedKgChange, week.actualKgChange]).filter((value): value is number => value !== null);
  const y = verticalScale(values, height, 8, 8);
  const expectedPoints = weeks.flatMap((week, index) => (week.expectedKgChange === null ? [] : [{ x: x(index), y: y(week.expectedKgChange) }]));
  const runs: { x: number; y: number }[][] = [];
  weeks.forEach((week, index) => {
    if (week.actualKgChange === null) {
      runs.push([]);
      return;
    }
    if (runs.length === 0) {
      runs.push([]);
    }
    runs[runs.length - 1].push({ x: x(index), y: y(week.actualKgChange) });
  });
  const filled = runs.filter((run) => run.length > 0);
  return {
    expected: expectedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${fixed(point.x)} ${fixed(point.y)}`).join(' '),
    expectedDots: expectedPoints,
    actual: filled.filter((run) => run.length > 1).map((run) => run.map((point, index) => `${index === 0 ? 'M' : 'L'}${fixed(point.x)} ${fixed(point.y)}`).join(' ')),
    actualDots: filled.filter((run) => run.length === 1).map((run) => run[0]),
    zeroY: y(0)
  };
}

/** A change in kilograms with its sign: "-1.9 kg". */
export function kgText(value: number): string {
  // Rounded on the size, so -1.85 and 1.85 both read 1.9.
  const size = Math.round(Math.abs(value) * 10) / 10;
  return size === 0 ? '0.0 kg' : `${value < 0 ? MINUS : '+'}${size.toFixed(1)} kg`;
}

export interface LogVsScale {
  log: string | null;
  scale: string | null;
}

/** "Log says -1.9 kg, scale says -3.0 kg" from the newest figures of each. */
export function logVsScale(weeks: readonly EnergyWeekPoint[]): LogVsScale | null {
  const latest = (pick: (week: EnergyWeekPoint) => number | null): number | null => {
    for (let index = weeks.length - 1; index >= 0; index--) {
      const value = pick(weeks[index]);
      if (value !== null) {
        return value;
      }
    }
    return null;
  };
  const log = latest((week) => week.expectedKgChange);
  const scale = latest((week) => week.actualKgChange);
  return log === null && scale === null ? null : { log: log === null ? null : kgText(log), scale: scale === null ? null : kgText(scale) };
}

export function weeksSummary(figures: LogVsScale | null): string {
  if (!figures) {
    return 'The last 8 weeks: no food log or weigh-ins yet.';
  }
  return `The last 8 weeks: log says ${figures.log ?? 'nothing yet'}, scale says ${figures.scale ?? 'nothing yet'}.`;
}
