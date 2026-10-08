import {
  browserTimezone,
  dateKeyInZone,
  dayBoundsInZone,
  instantFromWallTime,
  profileTimezone,
  startOfDayInZone,
  wallTimeInZone
} from './zone-time';

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

  it('writes an instant as the wall clock of the zone, for a datetime-local input', () => {
    const instant = new Date('2026-06-18T20:15:00Z');
    expect(wallTimeInZone(instant, 'Pacific/Auckland')).toBe('2026-06-19T08:15');
    expect(wallTimeInZone(instant, 'America/Los_Angeles')).toBe('2026-06-18T13:15');
  });

  it('reads a wall-clock time back as the instant it means in the zone, across a clock change', () => {
    expect(instantFromWallTime('2026-06-19T08:15', 'Pacific/Auckland').toISOString()).toBe('2026-06-18T20:15:00.000Z');
    expect(instantFromWallTime('2026-06-18T13:15', 'America/Los_Angeles').toISOString()).toBe('2026-06-18T20:15:00.000Z');
    // New Zealand moves to daylight time at 2:00 on 27 Sept 2026, so 9:00 that day is UTC+13.
    expect(instantFromWallTime('2026-09-27T09:00', 'Pacific/Auckland').toISOString()).toBe('2026-09-26T20:00:00.000Z');
    expect(Number.isNaN(instantFromWallTime('', 'Pacific/Auckland').getTime())).toBeTrue();
  });

  it('round-trips a wall-clock time through its instant', () => {
    for (const zone of ['Pacific/Auckland', 'America/Los_Angeles', 'Asia/Singapore']) {
      expect(wallTimeInZone(instantFromWallTime('2026-03-08T07:45', zone), zone)).toBe('2026-03-08T07:45');
    }
  });
});
