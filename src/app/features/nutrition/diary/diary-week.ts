import { RangeDay } from './diary.models';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A day of the week card. */
export interface DayTile {
  date: string;
  weekday: string;
  state: 'past' | 'today' | 'future';
  logged: boolean;
  kcal: number;
  /** How full the tile is, 0 to 1: the day's kcal over its target. */
  fill: number;
  /** Whole kcal for a past day that was logged, "Today" for today, otherwise empty. */
  caption: string;
  /** The day was logged and came within a tenth of its target. Only past days are judged. */
  onTarget: boolean;
}

/** The seven tiles of a week. A date with no entry in the range is a day with nothing logged. */
export function dayTiles(days: readonly RangeDay[], dates: readonly string[], today: string, fallbackTarget: number | null): DayTile[] {
  return dates.map((date, index) => {
    const day = days.find((entry) => entry.date === date);
    const state: DayTile['state'] = date === today ? 'today' : date < today ? 'past' : 'future';
    const logged = day?.logged === true;
    const kcal = logged ? (day?.totalCalories ?? 0) : 0;
    const target = day?.targetCalories ?? fallbackTarget;
    const share = target !== null && target > 0 ? kcal / target : 0;
    return {
      date,
      weekday: WEEKDAYS[index % 7],
      state,
      logged,
      kcal,
      fill: Math.min(share, 1),
      caption: state === 'today' ? 'Today' : state === 'past' && logged ? Math.round(kcal).toLocaleString('en-GB') : '',
      onTarget: state === 'past' && logged && share >= 0.9 && share <= 1.1
    };
  });
}

export interface WeekFigures {
  /** "4 of 4": the logged days among the days before today. */
  daysLogged: string;
  onTarget: number;
  /** Average kcal over the logged days before today, or null when there is none. */
  kcalPerDay: number | null;
}

/** Today is left out of every figure because its total is still growing. */
export function weekFigures(tiles: readonly DayTile[]): WeekFigures {
  const past = tiles.filter((tile) => tile.state === 'past');
  const logged = past.filter((tile) => tile.logged);
  return {
    daysLogged: `${logged.length} of ${past.length}`,
    onTarget: logged.filter((tile) => tile.onTarget).length,
    kcalPerDay: logged.length ? Math.round(logged.reduce((sum, tile) => sum + tile.kcal, 0) / logged.length) : null
  };
}

/** The balance codes the week dots are drawn for, and the range field that says whether each day was on target. */
const DOT_FIELD: Record<string, keyof RangeDay> = {
  FIBER: 'fiberMet',
  POTASSIUM: 'potassiumMet',
  SUGAR: 'sugarWithin',
  SAT_FAT: 'saturatedFatWithin',
  SODIUM: 'sodiumWithin'
};

/**
 * Seven dots for one balance line: true on target, false missed, null not yet. Today and the days
 * ahead stay null whatever the backend says, because a day that is not over cannot be judged.
 * An unknown code gives no dots.
 */
export function weekDots(days: readonly RangeDay[], dates: readonly string[], today: string, code: string): (boolean | null)[] {
  const field = DOT_FIELD[code];
  if (!field) {
    return [];
  }
  return dates.map((date) => {
    const day = days.find((entry) => entry.date === date);
    if (!day || !day.logged || date >= today) {
      return null;
    }
    const value = day[field];
    return typeof value === 'boolean' ? value : null;
  });
}
