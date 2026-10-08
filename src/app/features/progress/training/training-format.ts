/** Number and date wording shared by the Training pages, written the way the boards write it. */

/** The minus sign of the boards, so a negative figure reads as one number. */
export const MINUS = '−';

const DAY_MS = 86_400_000;

/** A date key as UTC midnight, so day arithmetic never meets a daylight-saving shift. */
function parse(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) {
    return null;
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = parse(day);
  return date ? iso(new Date(date.getTime() + days * DAY_MS)) : day;
}

/** Whole days from `a` to `b`, positive when `b` is later. */
export function daysBetween(a: string, b: string): number {
  const from = parse(a);
  const to = parse(b);
  return from && to ? Math.round((to.getTime() - from.getTime()) / DAY_MS) : 0;
}

/** Monday is 0 and Sunday 6. */
export function weekdayOf(day: string): number {
  const date = parse(day);
  return date ? (date.getUTCDay() + 6) % 7 : 0;
}

export function mondayOf(day: string): string {
  return addDays(day, -weekdayOf(day));
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "8 Sept". */
export function shortDate(day: string): string {
  const date = parse(day);
  return date ? DAY_MONTH.format(date) : '';
}

/** "6 Sept to 3 Oct". */
export function rangeLabel(from: string, to: string): string {
  return `${shortDate(from)} to ${shortDate(to)}`;
}

/** "September 2026". */
export function monthLabel(day: string): string {
  const date = parse(day);
  return date ? MONTH_YEAR.format(date) : '';
}

/** A weight with one decimal, the ".0" left off: 67.5, 80. */
export function kg(value: number): string {
  const text = (Math.round(value * 10) / 10).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** The one rounding used on every board for a percent: half rounds down, so 12.5% shows as 12%. */
export function roundPct(value: number): number {
  return Math.ceil(value - 0.5);
}

export function signed(value: number, text: string): string {
  if (value === 0) {
    return text;
  }
  return `${value < 0 ? MINUS : '+'}${text}`;
}

export function signedPct(value: number): string {
  const rounded = roundPct(value);
  return signed(rounded, `${Math.abs(rounded)}%`);
}

export function signedKg(value: number): string {
  return signed(Math.round(value * 10) / 10, `${Math.abs(Math.round(value * 10) / 10).toFixed(1)} kg`);
}

/** "4 h 50 min", "50 min", "2 h". */
export function hm(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) {
    return `${h} h ${m} min`;
  }
  return h ? `${h} h` : `${m} min`;
}

/** The hero's short time: "11 h 50", "45 min". */
export function heroTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) {
    return `${m} min`;
  }
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function grouped(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}

/** A pace in seconds a kilometre as "5:50". */
export function pace(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The change of a compared figure as the hero writes it, or an empty string with no comparison. */
export function heroChange(value: number | null, previous: number | null, kind: 'count' | 'minutes' | 'pct'): string {
  if (value === null || previous === null) {
    return '';
  }
  const delta = value - previous;
  if (kind === 'pct') {
    return previous > 0 ? signedPct((delta / previous) * 100) : '';
  }
  if (kind === 'minutes') {
    return delta === 0 ? 'no change' : signed(delta, heroTime(Math.abs(delta)));
  }
  return delta === 0 ? 'no change' : signed(delta, String(Math.abs(Math.round(delta))));
}

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A value of a highlight's series written in its unit: "93.3 kg", "5:50", "720". */
export function unitValue(value: number, unit: string): string {
  const key = unit.toLowerCase();
  if (key === 'kg') {
    return `${kg(value)} kg`;
  }
  if (key.includes('sec') && key.includes('km')) {
    return pace(value);
  }
  return `${grouped(value)}${unit && !key.includes('load') ? ` ${unit}` : ''}`;
}
