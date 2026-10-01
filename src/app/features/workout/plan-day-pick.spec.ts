import { WorkoutPlanDay } from '../../core/fitsync.models';
import { dayToStart, isoWeekdayIn, isoWeekdayOfDateKey, planDayOn } from './plan-day-pick';

function day(planDayId: string, dayOfWeek: number): WorkoutPlanDay {
  return { planDayId, dayOfWeek, kind: 'STRENGTH', title: planDayId, sportActivity: null, sportLabel: null, estimatedDurationMinutes: 30, exercises: [] };
}

describe('plan day helpers', () => {
  it('names the weekday of an instant in a timezone, Monday as 1', () => {
    // 2026-10-01 is a Thursday in Singapore, and still Wednesday in Honolulu.
    const at = new Date('2026-10-01T02:00:00Z');
    expect(isoWeekdayIn('Asia/Singapore', at)).toBe(4);
    expect(isoWeekdayIn('Pacific/Honolulu', at)).toBe(3);
    expect(isoWeekdayIn('Asia/Singapore', new Date('2026-10-04T02:00:00Z'))).toBe(7);
  });

  it('falls back to the browser day for an unknown timezone', () => {
    const at = new Date('2026-10-01T12:00:00');
    expect(isoWeekdayIn('Not/AZone', at)).toBe(4);
  });

  it('reads the weekday of a date key without any timezone shift', () => {
    expect(isoWeekdayOfDateKey('2026-10-01')).toBe(4);
    expect(isoWeekdayOfDateKey('2026-10-04')).toBe(7);
    expect(isoWeekdayOfDateKey('2026-09-28')).toBe(1);
    expect(isoWeekdayOfDateKey('nonsense')).toBeNull();
  });

  it('finds the plan day on a weekday', () => {
    const days = [day('a', 1), day('b', 4)];
    expect(planDayOn(days, 4)?.planDayId).toBe('b');
    expect(planDayOn(days, 5)).toBeNull();
    expect(planDayOn(days, null)).toBeNull();
    expect(planDayOn(null, 4)).toBeNull();
  });

  it('starts today when the plan has a day for it, else the next one, wrapping past Sunday', () => {
    const days = [day('mon', 1), day('wed', 3), day('fri', 5)];
    expect(dayToStart(days, 3)?.planDayId).toBe('wed');
    expect(dayToStart(days, 4)?.planDayId).toBe('fri');
    expect(dayToStart(days, 6)?.planDayId).toBe('mon');
    expect(dayToStart([], 3)).toBeNull();
    expect(dayToStart(undefined, 3)).toBeNull();
  });
});
