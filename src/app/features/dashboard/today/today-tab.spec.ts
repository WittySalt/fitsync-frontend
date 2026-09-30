import {
  dayKeyOf,
  daysBetweenKeys,
  defaultTodayTab,
  localDateKey,
  readRememberedTab,
  rememberTab,
  ruleTab,
  TODAY_TAB_STORAGE_KEY,
  tabIndexForKey
} from './today-tab';

// Wednesday 30 September 2026, built from local parts so the specs hold in any timezone.
const morning = new Date(2026, 8, 30, 8, 10);
const afternoon = new Date(2026, 8, 30, 14, 0);

function memoryStorage(initial: Record<string, string> = {}): { storage: () => Storage; data: Record<string, string> } {
  const data = { ...initial };
  const storage = {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    }
  } as unknown as Storage;
  return { storage: () => storage, data };
}

function throwingStorage(): () => Storage {
  return () => {
    throw new Error('storage is blocked');
  };
}

describe('today tab rule', () => {
  it('opens Body on the morning after a weigh-in', () => {
    expect(ruleTab({ latestWeightOn: '2026-09-29', mealsLoggedToday: 0, now: morning })).toBe('body');
  });

  it('stays on Food in the afternoon after a weigh-in the day before', () => {
    expect(ruleTab({ latestWeightOn: '2026-09-29', mealsLoggedToday: 0, now: afternoon })).toBe('food');
  });

  it('stays on Food when the person was weighed today', () => {
    expect(ruleTab({ latestWeightOn: '2026-09-30', mealsLoggedToday: 2, now: morning })).toBe('food');
  });

  it('opens Body when the last weight is more than seven days old, and not at exactly seven', () => {
    expect(ruleTab({ latestWeightOn: '2026-09-22', mealsLoggedToday: 0, now: afternoon })).toBe('body');
    expect(ruleTab({ latestWeightOn: '2026-09-23', mealsLoggedToday: 0, now: afternoon })).toBe('food');
  });

  it('opens Body with no weight at all once a meal is logged, and Food while nothing is', () => {
    expect(ruleTab({ latestWeightOn: null, mealsLoggedToday: 1, now: afternoon })).toBe('body');
    expect(ruleTab({ latestWeightOn: null, mealsLoggedToday: 0, now: afternoon })).toBe('food');
  });

  it('reads an instant as the local day it falls on', () => {
    const yesterdayEvening = new Date(2026, 8, 29, 21, 30).toISOString();
    expect(ruleTab({ latestWeightOn: yesterdayEvening, mealsLoggedToday: 0, now: morning })).toBe('body');
  });

  it('never opens Goals', () => {
    for (const weight of [null, '2026-09-29', '2026-09-01', '2026-09-30']) {
      for (const meals of [0, 3]) {
        expect(ruleTab({ latestWeightOn: weight, mealsLoggedToday: meals, now: morning })).not.toBe('goals');
      }
    }
  });
});

describe('remembered tab', () => {
  it('wins over the rule when it was picked today', () => {
    const { storage } = memoryStorage({ [TODAY_TAB_STORAGE_KEY]: JSON.stringify({ date: '2026-09-30', tab: 'goals' }) });

    expect(defaultTodayTab({ latestWeightOn: '2026-09-29', mealsLoggedToday: 0, now: morning }, storage)).toBe('goals');
  });

  it('ignores a choice made on another day', () => {
    const { storage } = memoryStorage({ [TODAY_TAB_STORAGE_KEY]: JSON.stringify({ date: '2026-09-29', tab: 'goals' }) });

    expect(readRememberedTab(morning, storage)).toBeNull();
    expect(defaultTodayTab({ latestWeightOn: '2026-09-29', mealsLoggedToday: 0, now: morning }, storage)).toBe('body');
  });

  it('ignores a value that is not a known tab or not JSON', () => {
    expect(readRememberedTab(morning, memoryStorage({ [TODAY_TAB_STORAGE_KEY]: JSON.stringify({ date: '2026-09-30', tab: 'lunch' }) }).storage)).toBeNull();
    expect(readRememberedTab(morning, memoryStorage({ [TODAY_TAB_STORAGE_KEY]: 'not json' }).storage)).toBeNull();
    expect(readRememberedTab(morning, memoryStorage({ [TODAY_TAB_STORAGE_KEY]: 'null' }).storage)).toBeNull();
  });

  it('stores the tab with the local date under a single key', () => {
    const { storage, data } = memoryStorage();

    rememberTab(morning, 'body', storage);

    expect(Object.keys(data)).toEqual([TODAY_TAB_STORAGE_KEY]);
    expect(JSON.parse(data[TODAY_TAB_STORAGE_KEY])).toEqual({ date: '2026-09-30', tab: 'body' });
  });

  it('falls back to the rule and does not throw when storage throws', () => {
    const storage = throwingStorage();

    expect(readRememberedTab(morning, storage)).toBeNull();
    expect(() => rememberTab(morning, 'goals', storage)).not.toThrow();
    expect(defaultTodayTab({ latestWeightOn: '2026-09-29', mealsLoggedToday: 0, now: morning }, storage)).toBe('body');
  });
});

describe('day keys', () => {
  it('writes the local calendar day of a moment', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('keeps a date-only value and rejects nonsense', () => {
    expect(dayKeyOf('2026-09-29')).toBe('2026-09-29');
    expect(dayKeyOf('')).toBeNull();
    expect(dayKeyOf(null)).toBeNull();
    expect(dayKeyOf('not a date')).toBeNull();
  });

  it('counts whole days between two keys', () => {
    expect(daysBetweenKeys('2026-09-29', '2026-09-30')).toBe(1);
    expect(daysBetweenKeys('2026-09-30', '2026-09-29')).toBe(-1);
    expect(daysBetweenKeys('2026-02-27', '2026-03-02')).toBe(3);
  });
});

describe('tab list keys', () => {
  it('moves with the arrows and wraps at both ends', () => {
    expect(tabIndexForKey('ArrowRight', 0, 3)).toBe(1);
    expect(tabIndexForKey('ArrowRight', 2, 3)).toBe(0);
    expect(tabIndexForKey('ArrowLeft', 0, 3)).toBe(2);
    expect(tabIndexForKey('ArrowLeft', 2, 3)).toBe(1);
  });

  it('goes to the ends with Home and End and ignores other keys', () => {
    expect(tabIndexForKey('Home', 2, 3)).toBe(0);
    expect(tabIndexForKey('End', 0, 3)).toBe(2);
    expect(tabIndexForKey('Enter', 0, 3)).toBeNull();
    expect(tabIndexForKey('a', 1, 3)).toBeNull();
  });
});
