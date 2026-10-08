import { shortDateLabel } from '../../../shared/date-label';
import { EnergyAverage, EnergyWeek, MealSplit } from '../energy/energy.models';

/** The week the Food card's bars draw, with the words that say which week it is. */
export interface BarsWeek {
  week: EnergyWeek;
  label: string;
}

type Field = 'eaten' | 'resting' | 'workouts' | 'used' | 'balance';
const FIELDS: readonly Field[] = ['eaten', 'resting', 'workouts', 'used', 'balance'];
const MEALS: readonly (keyof MealSplit)[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

/** An average of the weeks, each counted by the days it logged. */
function weighted<T extends string>(weeks: readonly EnergyWeek[], keys: readonly T[], read: (week: EnergyWeek) => Record<T, number | null> | null): Record<T, number | null> {
  const out = {} as Record<T, number | null>;
  for (const key of keys) {
    let sum = 0;
    let days = 0;
    for (const week of weeks) {
      const value = read(week)?.[key] ?? null;
      if (value !== null) {
        sum += value * week.daysLogged;
        days += week.daysLogged;
      }
    }
    out[key] = days > 0 ? sum / days : null;
  }
  return out;
}

/**
 * What the Food card's bars show when the week that holds today is too young to read: the latest
 * earlier week with enough logged days, named by its Monday; and when no earlier week has enough,
 * the average of the weeks that were logged at all, named "4-week average". Null when there is
 * nothing to draw. `earlier` runs from the week before this one backwards.
 */
export function barsWeek(current: EnergyWeek | null, earlier: readonly (EnergyWeek | null)[], reference: Date = new Date()): BarsWeek | null {
  if (current && current.status === 'OK') {
    return { week: current, label: 'This week' };
  }
  const fullWeek = earlier.find((week): week is EnergyWeek => week !== null && week.status === 'OK');
  if (fullWeek) {
    return { week: fullWeek, label: `Week of ${shortDateLabel(fullWeek.weekStart, reference)}` };
  }
  const logged = earlier.filter((week): week is EnergyWeek => week !== null && week.status !== 'NO_PROFILE' && week.daysLogged > 0 && week.average !== null);
  if (logged.length === 0) {
    return null;
  }
  const average = weighted(logged, FIELDS, (week) => week.average as EnergyAverage as Record<Field, number | null>) as EnergyAverage;
  const hasSplit = logged.every((week) => week.mealSplit !== null);
  // `earlier` runs newest first, so the last logged week is the oldest and starts the average.
  const oldest = logged[logged.length - 1];
  return {
    week: {
      ...oldest,
      weekStart: oldest.weekStart,
      weekEnd: logged[0].weekEnd,
      status: 'OK',
      daysLogged: logged.reduce((total, week) => total + week.daysLogged, 0),
      average,
      mealSplit: hasSplit ? (weighted(logged, MEALS, (week) => week.mealSplit as Record<keyof MealSplit, number | null>) as MealSplit) : null,
      days: [],
      weeks: []
    },
    label: '4-week average'
  };
}
