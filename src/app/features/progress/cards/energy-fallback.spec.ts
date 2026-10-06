import { EnergyStatus, EnergyWeek } from '../energy/energy.models';
import { barsWeek } from './energy-fallback';

function week(weekStart: string, status: EnergyStatus, daysLogged: number, eaten: number | null, used: number | null = 2200): EnergyWeek {
  return {
    weekStart,
    weekEnd: weekStart,
    status,
    daysLogged,
    bmrKcal: 1700,
    bmrEstimated: false,
    restingFactor: 1.2,
    average: eaten === null ? null : { eaten, resting: 2000, workouts: used === null ? null : used - 2000, used, balance: used === null ? null : eaten - used },
    mealSplit: null,
    weeklyKgEquivalent: null,
    days: [],
    weeks: []
  };
}

describe('the week the Food card draws', () => {
  const reference = new Date(2026, 9, 3);

  it('draws this week when it can be read', () => {
    const now = week('2026-09-28', 'OK', 4, 2000);
    expect(barsWeek(now, [week('2026-09-21', 'OK', 6, 1900)], reference)).toEqual({ week: now, label: 'This week' });
  });

  it('falls back to the last full week, named by its Monday, when this week is too young', () => {
    const last = week('2026-09-21', 'OK', 6, 1900);
    const result = barsWeek(week('2026-09-28', 'TOO_FEW_DAYS', 1, 1800), [null, last, week('2026-09-14', 'OK', 7, 2100)], reference)!;
    expect(result.week).toBe(last);
    expect(result.label).toBe('Week of 21 Sept');
    expect(barsWeek(null, [last], reference)!.label).toBe('Week of 21 Sept');
  });

  it('averages the weeks that were logged, by their days, when no week is full', () => {
    const result = barsWeek(week('2026-09-28', 'TOO_FEW_DAYS', 1, 1800), [week('2026-09-21', 'TOO_FEW_DAYS', 2, 2000), week('2026-09-14', 'TOO_FEW_DAYS', 1, 2300), null], reference)!;
    expect(result.label).toBe('4-week average');
    expect(result.week.status).toBe('OK');
    expect(Math.round(result.week.average!.eaten!)).toBe(2100);
    expect(result.week.daysLogged).toBe(3);
  });

  it('draws nothing when no week has a figure', () => {
    expect(barsWeek(null, [null, week('2026-09-21', 'NO_PROFILE', 0, null)], reference)).toBeNull();
  });
});
