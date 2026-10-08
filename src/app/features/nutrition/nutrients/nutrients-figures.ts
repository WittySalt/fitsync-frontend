import { whole } from '../diary/diary-figures';
import { addDays } from '../diary/diary-time';
import { NutrientDayValue, NutrientGroup, NutrientTileData, PeriodKey } from './nutrients.models';

export const PERIODS: readonly { key: PeriodKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 }
];

export const DEFAULT_PERIOD: PeriodKey = '7d';

/**
 * The period named in the URL query, `?period=`. The links write `today`, `7d` and `30d`, and a
 * hand-typed `1`, `7`, `30`, `7days` or `30 days` reads the same; anything else is the default.
 */
export function parsePeriod(value: string | null | undefined): PeriodKey {
  const key = (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key === 'today' || key === '1' || key === '1d' || key === '1day') {
    return 'today';
  }
  if (key === '30' || key === '30d' || key === '30days') {
    return '30d';
  }
  return key === '7' || key === '7d' || key === '7days' ? '7d' : DEFAULT_PERIOD;
}

/** The first and last local day of a period ending today, and how many days that is. */
export function periodRange(key: PeriodKey, today: string): { from: string; to: string; days: number } {
  const days = key === '90d' ? 90 : (PERIODS.find((period) => period.key === key)?.days ?? 7);
  return { from: addDays(today, 1 - days), to: today, days };
}

export function periodEyebrow(key: PeriodKey): string {
  return key === 'today' ? 'Today' : `Your last ${key === '7d' ? 7 : key === '30d' ? 30 : 90} days`;
}

/**
 * The period of a nutrients page from its query. `?range=30|90` is what Progress writes and wins
 * over `?period=`; without it the period reads as before.
 */
export function periodFromQuery(period: string | null | undefined, range: string | null | undefined): PeriodKey {
  if (range === '90') {
    return '90d';
  }
  return range === '30' ? '30d' : parsePeriod(period);
}

/** The query that names a period in a link: `range=90` for 90 days, `period=` for the others. */
export function periodQuery(key: PeriodKey): Record<string, string> {
  return key === '90d' ? { range: '90' } : { period: key };
}

export const GROUP_ORDER: readonly NutrientGroup[] = ['FAT_SOLUBLE', 'WATER_SOLUBLE', 'MAJOR_MINERAL', 'TRACE_MINERAL', 'LIMIT'];

export const GROUP_LABEL: Record<NutrientGroup, string> = {
  FAT_SOLUBLE: 'Fat-soluble vitamins',
  WATER_SOLUBLE: 'B vitamins and vitamin C',
  MAJOR_MINERAL: 'Major minerals',
  TRACE_MINERAL: 'Trace minerals',
  LIMIT: 'Keep under'
};

/** The colour token of a group. The limits are grey, the others are data colours of their own. */
export function groupColour(group: NutrientGroup): string {
  switch (group) {
    case 'FAT_SOLUBLE':
      return 'var(--nutrient-fat-soluble)';
    case 'WATER_SOLUBLE':
      return 'var(--nutrient-water-soluble)';
    case 'MAJOR_MINERAL':
      return 'var(--nutrient-major-mineral)';
    case 'TRACE_MINERAL':
      return 'var(--nutrient-trace-mineral)';
    default:
      return 'var(--text-muted)';
  }
}

export type TileState = 'unknown' | 'below' | 'reached' | 'under' | 'over';

/** How a tile reads: unknown without data, reached at the daily amount, under or over a limit. */
export function tileState(nutrient: NutrientTileData): TileState {
  if (nutrient.share === null) {
    return 'unknown';
  }
  if (nutrient.groupCode === 'LIMIT') {
    return nutrient.share > 1 ? 'over' : 'under';
  }
  return nutrient.share >= 1 ? 'reached' : 'below';
}

/** How far a tile is filled from the bottom, 0 to 100. */
export function tileFill(nutrient: NutrientTileData): number {
  return nutrient.share === null ? 0 : Math.min(Math.max(nutrient.share, 0), 1) * 100;
}

export function sharePercent(nutrient: NutrientTileData): number | null {
  return nutrient.share === null ? null : Math.round(nutrient.share * 100);
}

/** What a screen reader says for a tile, such as "Vitamin D, 34% of the daily amount". */
export function tileLabel(nutrient: NutrientTileData): string {
  const percent = sharePercent(nutrient);
  if (percent === null) {
    return `${nutrient.displayName}, no data yet`;
  }
  if (nutrient.groupCode === 'LIMIT') {
    return `${nutrient.displayName}, ${percent}% of the daily limit${nutrient.share !== null && nutrient.share > 1 ? ', over' : ''}`;
  }
  return `${nutrient.displayName}, ${percent}% of the daily amount`;
}

/** A figure the way a label prints it: whole from 100 up, one decimal below, two below 1. */
export function figureText(value: number): string {
  const size = Math.abs(value);
  if (size >= 100) {
    return whole(value);
  }
  const places = size < 1 ? 100 : 10;
  return String(Math.round(value * places) / places);
}

/** An amount with its unit, such as "5.1 µg". */
export function amountWithUnit(value: number, unit: string): string {
  return `${figureText(value)} ${unit}`.trim();
}

/** "5.1 of 15 µg", or an empty string without data. */
export function amountOfReference(nutrient: NutrientTileData): string {
  if (nutrient.averageAmount === null) {
    return '';
  }
  return `${figureText(nutrient.averageAmount)} of ${amountWithUnit(nutrient.reference, nutrient.unit)}`;
}

/** The nutrients of the table in groups, in the order the server sent them. */
export function groupNutrients(nutrients: readonly NutrientTileData[]): { group: NutrientGroup; items: NutrientTileData[] }[] {
  return GROUP_ORDER.map((group) => ({ group, items: nutrients.filter((item) => item.groupCode === group) })).filter(
    (block) => block.items.length > 0
  );
}

/** The nutrients in the order the table shows them, which the previous and next arrows follow. */
export function tableOrder(nutrients: readonly NutrientTileData[]): NutrientTileData[] {
  return groupNutrients(nutrients).flatMap((block) => block.items);
}

export function neighbours(order: readonly NutrientTileData[], code: string): { previous: NutrientTileData | null; next: NutrientTileData | null } {
  const index = order.findIndex((item) => item.code === code);
  if (index < 0) {
    return { previous: null, next: null };
  }
  return { previous: order[index - 1] ?? null, next: order[index + 1] ?? null };
}

/** The vitamins and minerals, which the petals show; the limits have no petal. */
export function petalNutrients(nutrients: readonly NutrientTileData[]): NutrientTileData[] {
  return tableOrder(nutrients).filter((item) => item.groupCode !== 'LIMIT');
}

export interface ReachSummary {
  reached: number;
  total: number;
  /** The three furthest below their daily amount, lowest first. Unknown nutrients are not in it. */
  lowest: NutrientTileData[];
}

export function reachSummary(nutrients: readonly NutrientTileData[]): ReachSummary {
  const petals = petalNutrients(nutrients);
  const known = petals.filter((item) => item.share !== null);
  const short = known.filter((item) => (item.share ?? 0) < 1).sort((a, b) => (a.share ?? 0) - (b.share ?? 0));
  return { reached: known.length - short.length, total: petals.length, lowest: short.slice(0, 3) };
}

/** The sentence of the hero, or an empty string when nothing is known to say. */
export function heroLine(summary: ReachSummary, period: PeriodKey): string {
  if (summary.total === 0 || (summary.reached === 0 && summary.lowest.length === 0)) {
    return '';
  }
  const onAverage = period === 'today' ? '' : ' on average';
  const head = `${summary.reached} of ${summary.total} reached${onAverage}.`;
  const worst = summary.lowest[0];
  return worst ? `${head} ${worst.displayName} is the furthest short.` : `${head} Every nutrient is reached.`;
}

export interface Petal {
  code: string;
  symbol: string;
  /** The outline of the petal; empty for a nutrient with no data. */
  path: string;
  labelX: number;
  labelY: number;
  reached: boolean;
  /** Where the petal ends, as a distance from the centre. */
  radius: number;
}

export interface PetalGeometry {
  size: number;
  centre: number;
  innerRadius: number;
  /** The radius of the dashed ring that marks 100%. */
  ringRadius: number;
  petals: Petal[];
}

export const PETAL_CAP = 2;

/**
 * The petals of the chart. One petal per nutrient, equal slices of the circle, each reaching out
 * from the inner circle by its share of the daily amount, capped at 200%. A nutrient with no data
 * has a slot and a label but no petal.
 */
export function petalGeometry(shares: readonly { code: string; symbol: string; share: number | null }[], size: number): PetalGeometry {
  const centre = size / 2;
  const innerRadius = size * 0.16;
  const ringRadius = size * 0.34;
  const outer = size * 0.44;
  const count = shares.length;
  const step = count === 0 ? 0 : (2 * Math.PI) / count;
  const at = (radius: number, angle: number): [number, number] => [centre + radius * Math.cos(angle), centre + radius * Math.sin(angle)];
  const fixed = (value: number): string => value.toFixed(1);

  const petals = shares.map((item, index): Petal => {
    // Starts at twelve o'clock; each petal leaves 8% of its slice clear on both sides so neighbours never touch.
    const start = -Math.PI / 2 + index * step + step * 0.08;
    const end = start + step * 0.84;
    const capped = item.share === null ? 0 : Math.min(Math.max(item.share, 0), PETAL_CAP);
    const radius = Math.min(innerRadius + (ringRadius - innerRadius) * capped, outer);
    const [x0, y0] = at(innerRadius, start);
    const [x1, y1] = at(radius, start);
    const [x2, y2] = at(radius, end);
    const [x3, y3] = at(innerRadius, end);
    const [labelX, labelY] = at(outer + size * 0.05, (start + end) / 2);
    const path =
      item.share === null
        ? ''
        : `M${fixed(x0)} ${fixed(y0)} L${fixed(x1)} ${fixed(y1)} A${fixed(radius)} ${fixed(radius)} 0 0 1 ${fixed(x2)} ${fixed(y2)} ` +
          `L${fixed(x3)} ${fixed(y3)} A${fixed(innerRadius)} ${fixed(innerRadius)} 0 0 0 ${fixed(x0)} ${fixed(y0)} Z`;
    return { code: item.code, symbol: item.symbol, path, labelX, labelY, reached: item.share !== null && item.share >= 1, radius };
  });
  return { size, centre, innerRadius, ringRadius, petals };
}

/** The text a screen reader gets in place of the petal chart. */
export function petalSummary(summary: ReachSummary, period: PeriodKey): string {
  const line = heroLine(summary, period);
  const lowest = summary.lowest.map((item) => `${item.displayName} ${sharePercent(item)}%`).join(', ');
  const base = line || 'No nutrient data for this period yet.';
  return lowest ? `${base} Lowest: ${lowest}.` : base;
}

/** Where the daily amount sits on the day bars: bars reach up to 120% of it. */
export const BAR_TOP = 1.2;

export interface DayBar {
  date: string;
  /** Height as a percentage of the chart, 0 for a day that was not logged. */
  height: number;
  logged: boolean;
  reached: boolean;
}

/** One bar for each day. A day that was not logged gets no height, so it reads as empty rather than low. */
export function dayBars(days: readonly NutrientDayValue[]): DayBar[] {
  return days.map((day) => {
    const share = day.logged && day.share !== null ? Math.max(day.share, 0) : null;
    return {
      date: day.date,
      height: share === null ? 0 : (Math.min(share, BAR_TOP) / BAR_TOP) * 100,
      logged: share !== null,
      reached: share !== null && share >= 1
    };
  });
}

/** The text that stands in for the day bars: how many days were logged and how many reached the daily amount. */
export function dayBarsSummary(name: string, days: readonly NutrientDayValue[]): string {
  const bars = dayBars(days);
  const logged = bars.filter((bar) => bar.logged).length;
  const reached = bars.filter((bar) => bar.reached).length;
  return `${name} each day: logged on ${logged} of ${bars.length} days, daily amount reached on ${reached}.`;
}

/** The top sources as they read on the side panel, three at most. */
export function topSources<T>(sources: readonly T[], count = 3): T[] {
  return sources.slice(0, count);
}

/** A name in the middle of a sentence: "Vitamin D" reads "vitamin D". */
export function lowerFirst(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** The name on a tile: the full display name, except "Saturated fat", which is "Sat. fat" there. */
export function tileName(nutrient: NutrientTileData): string {
  return nutrient.displayName === 'Saturated fat' ? 'Sat. fat' : nutrient.displayName;
}
