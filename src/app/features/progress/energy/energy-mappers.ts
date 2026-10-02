import { list, num, text } from '../../nutrition/diary/diary-mappers';
import { EnergyAverage, EnergyDay, EnergyStatus, EnergyWeek, EnergyWeekPoint, MealSplit } from './energy.models';

type Wire = Record<string, unknown>;

const STATUSES: readonly EnergyStatus[] = ['OK', 'NO_PROFILE', 'TOO_FEW_DAYS'];
/** Fewer logged days than this and the week says nothing yet. */
export const MIN_LOGGED_DAYS = 3;

function object(value: unknown): Wire | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Wire) : null;
}

function mapAverage(raw: unknown): EnergyAverage | null {
  const wire = object(raw);
  return wire
    ? {
        eaten: num(wire['eaten']),
        resting: num(wire['resting']),
        workouts: num(wire['workouts']),
        used: num(wire['used']),
        balance: num(wire['balance'])
      }
    : null;
}

function mapSplit(raw: unknown): MealSplit | null {
  const wire = object(raw);
  return wire
    ? { breakfast: num(wire['breakfast']), lunch: num(wire['lunch']), dinner: num(wire['dinner']), snack: num(wire['snack']) }
    : null;
}

function mapDay(raw: Wire): EnergyDay | null {
  const date = text(raw['date']);
  if (!date) {
    return null;
  }
  const eaten = num(raw['eaten']);
  return {
    date,
    logged: raw['logged'] === true && eaten !== null,
    eaten,
    resting: num(raw['resting']),
    workouts: num(raw['workouts']),
    workoutsEstimated: raw['workoutsEstimated'] === true,
    balance: num(raw['balance']),
    runningTotal: num(raw['runningTotal'])
  };
}

function mapPoint(raw: Wire): EnergyWeekPoint | null {
  const weekStart = text(raw['weekStart']);
  return weekStart ? { weekStart, expectedKgChange: num(raw['expectedKgChange']), actualKgChange: num(raw['actualKgChange']) } : null;
}

/**
 * The status the page acts on. An answer with a status the page does not know is judged by what it
 * holds: no resting figure means no profile, fewer than three logged days means too few days.
 */
function statusOf(raw: Wire, daysLogged: number, bmr: number | null): EnergyStatus {
  const known = STATUSES.find((status) => status === raw['status']);
  if (known) {
    return known;
  }
  if (bmr === null) {
    return 'NO_PROFILE';
  }
  return daysLogged < MIN_LOGGED_DAYS ? 'TOO_FEW_DAYS' : 'OK';
}

/** A week of energy, or null when the answer has no week start to anchor it. */
export function mapEnergyWeek(raw: Wire): EnergyWeek | null {
  const weekStart = text(raw['weekStart']);
  if (!weekStart) {
    return null;
  }
  const daysLogged = num(raw['daysLogged']) ?? 0;
  const bmr = num(raw['bmrKcal']);
  return {
    weekStart,
    weekEnd: text(raw['weekEnd']) ?? weekStart,
    status: statusOf(raw, daysLogged, bmr),
    daysLogged,
    bmrKcal: bmr,
    bmrEstimated: raw['bmrEstimated'] === true,
    restingFactor: num(raw['restingFactor']) ?? 1.2,
    average: mapAverage(raw['average']),
    mealSplit: mapSplit(raw['mealSplit']),
    weeklyKgEquivalent: num(raw['weeklyKgEquivalent']),
    days: list(raw['days']).map(mapDay).filter((day): day is EnergyDay => day !== null),
    weeks: list(raw['weeks']).map(mapPoint).filter((point): point is EnergyWeekPoint => point !== null)
  };
}
