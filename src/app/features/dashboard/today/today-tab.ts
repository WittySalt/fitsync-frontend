export type TodayTab = 'food' | 'body' | 'goals';

export const TODAY_TABS: readonly { key: TodayTab; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'body', label: 'Body' },
  { key: 'goals', label: 'Goals' }
];

/** The one storage key holding the tab the person picked and the day they picked it. */
export const TODAY_TAB_STORAGE_KEY = 'fitsync.todayCard.tab';

const DAY_MS = 86_400_000;

export interface TodayTabInput {
  /** The date or instant of the latest weight, or null when there is none. */
  latestWeightOn: string | null;
  mealsLoggedToday: number;
  now: Date;
}

/** The device-local calendar day of a moment as YYYY-MM-DD. */
export function localDateKey(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const day = String(moment.getDate()).padStart(2, '0');
  return `${moment.getFullYear()}-${month}-${day}`;
}

/**
 * The calendar day a date-only value names, or the device-local day of an instant. A date-only
 * value is taken as it is, because reading it through a timezone would move it to another day.
 */
export function dayKeyOf(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Only an ISO instant is read. A display string such as "5 Jul" parses under V8's legacy rules
  // and lands in the year 2001, so anything else is treated as not being a date at all.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return null;
  }
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? null : localDateKey(moment);
}

/** Whole calendar days from one day key to another, negative when the second is earlier. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

/**
 * The tab the card opens on when the person has not chosen one. Body opens on the morning after a
 * weigh-in and once the last weigh-in is over a week old, and also when there is no weight at all
 * but food is already logged, so that an empty Food tab is not the reason to stay there.
 */
export function ruleTab({ latestWeightOn, mealsLoggedToday, now }: TodayTabInput): TodayTab {
  const weightDay = dayKeyOf(latestWeightOn);
  if (weightDay === null) {
    return mealsLoggedToday > 0 ? 'body' : 'food';
  }
  const age = daysBetweenKeys(weightDay, localDateKey(now));
  if (age === 1 && now.getHours() < 12) {
    return 'body';
  }
  return age > 7 ? 'body' : 'food';
}

function isTab(value: unknown): value is TodayTab {
  return value === 'food' || value === 'body' || value === 'goals';
}

/** Reads the picked tab back, but only when it was picked on the same local day. */
export function readRememberedTab(now: Date, storage: () => Storage = () => localStorage): TodayTab | null {
  try {
    const raw = storage().getItem(TODAY_TAB_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const stored = JSON.parse(raw) as { date?: unknown; tab?: unknown } | null;
    return stored?.date === localDateKey(now) && isTab(stored.tab) ? stored.tab : null;
  } catch {
    return null;
  }
}

/** Remembers the picked tab for the rest of the local day. A storage that refuses is ignored. */
export function rememberTab(now: Date, tab: TodayTab, storage: () => Storage = () => localStorage): void {
  try {
    storage().setItem(TODAY_TAB_STORAGE_KEY, JSON.stringify({ date: localDateKey(now), tab }));
  } catch {
    // The choice then lasts only until the page is left, which is an acceptable loss.
  }
}

/** The tab to open on: the one picked earlier today, otherwise what the rule says. */
export function defaultTodayTab(input: TodayTabInput, storage: () => Storage = () => localStorage): TodayTab {
  return readRememberedTab(input.now, storage) ?? ruleTab(input);
}

/**
 * The tab index a key moves to inside a tab list, or null for a key that does nothing there.
 * Arrows wrap around and Home and End go to the ends.
 */
export function tabIndexForKey(key: string, current: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
