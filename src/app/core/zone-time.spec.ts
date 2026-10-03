import { browserTimezone, dateKeyInZone, dayBoundsInZone, profileTimezone, startOfDayInZone } from './zone-time';

describe('zone-time', () => {
  it('reads the calendar day an instant has in a zone, which can differ from UTC', () => {
    const instant = new Date('2026-10-02T17:30:00Z');
    expect(dateKeyInZone(instant, 'Asia/Singapore')).toBe('2026-10-03');
    expect(dateKeyInZone(instant, 'America/Los_Angeles')).toBe('2026-10-02');
    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-10-02');
  });

  it('finds the instant a day starts in a zone, east and west of UTC', () => {
    expect(startOfDayInZone('2026-10-03', 'Asia/Singapore').toISOString()).toBe('2026-10-02T16:00:00.000Z');
    expect(startOfDayInZone('2026-10-03', 'America/Los_Angeles').toISOString()).toBe('2026-10-03T07:00:00.000Z');
  });

  it('follows daylight saving time, so a day can be 23 or 25 hours long', () => {
    const spring = dayBoundsInZone('2026-03-08', 'America/Los_Angeles');
    expect((spring.to.getTime() + 1 - spring.from.getTime()) / 3_600_000).toBe(23);
    const autumn = dayBoundsInZone('2026-11-01', 'America/Los_Angeles');
    expect((autumn.to.getTime() + 1 - autumn.from.getTime()) / 3_600_000).toBe(25);
  });

  it('ends a day one millisecond before the next one starts', () => {
    const bounds = dayBoundsInZone('2026-10-03', 'Asia/Singapore');
    expect(bounds.to.toISOString()).toBe('2026-10-03T15:59:59.999Z');
  });

  it('falls back to the browser zone for a missing or unknown zone name', () => {
    expect(profileTimezone('Europe/London')).toBe('Europe/London');
    expect(profileTimezone(null)).toBe(browserTimezone());
    expect(profileTimezone('Not/AZone')).toBe(browserTimezone());
    expect(dateKeyInZone(new Date('2026-10-02T17:30:00Z'), 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
