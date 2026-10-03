const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const KEY = /^(\d{4})-(\d{2})-(\d{2})/;

type Day = [year: number, month: number, day: number];

/** A date key (or the date part of an ISO instant) read as a calendar day. */
function parts(key: string | null | undefined): Day | null {
  const match = key ? KEY.exec(key) : null;
  if (!match) {
    return null;
  }
  const day: Day = [Number(match[1]), Number(match[2]), Number(match[3])];
  return day[1] >= 1 && day[1] <= 12 && day[2] >= 1 && day[2] <= 31 ? day : null;
}

function format(date: Day, withYear: boolean): string {
  const label = `${date[2]} ${MONTHS[date[1] - 1]}`;
  return withYear ? `${label} ${date[0]}` : label;
}

/**
 * "3 Oct", the short date the energy card and the coach use. A day in another year than
 * `reference` carries the year ("11 Dec 2027"). Empty when the key is not a date.
 */
export function shortDateLabel(key: string | null | undefined, reference: Date = new Date()): string {
  const date = parts(key);
  return date ? format(date, date[0] !== reference.getFullYear()) : '';
}

/**
 * Two days as one phrase: "21 to 27 Sept" inside a month, "28 Sept to 3 Oct" across two, and
 * "3 Oct" for a single day. A range that crosses New Year names both years. Empty when either
 * key is not a date.
 */
export function dateRangeLabel(from: string | null | undefined, to: string | null | undefined, reference: Date = new Date()): string {
  const first = parts(from);
  const last = parts(to);
  if (!first || !last) {
    return '';
  }
  const crossesYear = first[0] !== last[0];
  const thisYear = !crossesYear && first[0] === reference.getFullYear();
  const start = format(first, crossesYear || !thisYear);
  const end = format(last, crossesYear || !thisYear);
  if (start === end) {
    return start;
  }
  return thisYear && first[1] === last[1] ? `${first[2]} to ${end}` : `${start} to ${end}`;
}

/** A YYYY-MM-DD key as a local calendar date, so a day is never moved by the zone's offset. */
export function parseLocalDate(key: string): Date {
  const date = parts(key);
  return date ? new Date(date[0], date[1] - 1, date[2]) : new Date(Number.NaN);
}
