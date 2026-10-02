import { EnergyDay, EnergyWeek } from './energy.models';

const RESTING = 1968;

const BALANCES: (number | null)[] = [-438, 12, -118, null, -298, null, -363];
const DATES = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

/** The week of the board: 5 of 7 days logged, 241 kcal a day under. */
export function days(): EnergyDay[] {
  let total = 0;
  return DATES.map((date, index): EnergyDay => {
    const balance = BALANCES[index];
    const workouts = index === 1 ? 600 : index === 4 ? 300 : 0;
    if (balance === null) {
      return { date, logged: false, eaten: null, resting: RESTING, workouts: 0, workoutsEstimated: false, today: false, balance: null, runningTotal: null };
    }
    total += balance;
    return {
      date,
      logged: true,
      eaten: RESTING + workouts + balance,
      resting: RESTING,
      workouts,
      workoutsEstimated: index === 4,
      today: false,
      balance,
      runningTotal: total
    };
  });
}

export function energyWeek(overrides: Partial<EnergyWeek> = {}): EnergyWeek {
  return {
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    status: 'OK',
    daysLogged: 5,
    bmrKcal: 1640,
    bmrEstimated: false,
    restingFactor: 1.2,
    average: { eaten: 2123, resting: RESTING, workouts: 396, used: 2364, balance: -241 },
    mealSplit: { breakfast: 480, lunch: 690, dinner: 760, snack: 193, other: 0 },
    weeklyKgEquivalent: -0.22,
    days: days(),
    weeks: [
      { weekStart: '2026-08-10', expectedKgChange: -0.15, actualKgChange: -0.3 },
      { weekStart: '2026-08-17', expectedKgChange: -0.45, actualKgChange: null },
      { weekStart: '2026-08-24', expectedKgChange: -0.55, actualKgChange: -0.7 },
      { weekStart: '2026-08-31', expectedKgChange: -0.8, actualKgChange: -1.2 },
      { weekStart: '2026-09-07', expectedKgChange: -1.15, actualKgChange: null },
      { weekStart: '2026-09-14', expectedKgChange: -1.35, actualKgChange: -2.0 },
      { weekStart: '2026-09-21', expectedKgChange: -1.63, actualKgChange: -2.6 },
      { weekStart: '2026-09-28', expectedKgChange: -1.85, actualKgChange: -3.0 }
    ],
    ...overrides
  };
}

/** The board week seen on its Friday: Friday is today, with what was eaten so far, and the days after it have not happened. */
export function weekOnFriday(): EnergyWeek {
  const all = days().map((day, index): EnergyDay => {
    if (index === 4) {
      return { ...day, today: true, balance: null, runningTotal: null };
    }
    return index > 4 ? { ...day, logged: false, eaten: null, balance: null, runningTotal: null } : day;
  });
  return energyWeek({ days: all, daysLogged: 3 });
}

/** The same week as the server would send it. */
export function energyWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const week = energyWeek();
  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    status: 'OK',
    daysLogged: 5,
    bmrKcal: 1640,
    bmrEstimated: false,
    restingFactor: 1.2,
    average: week.average,
    mealSplit: week.mealSplit,
    weeklyKgEquivalent: -0.22,
    days: week.days,
    weeks: week.weeks,
    ...overrides
  };
}
