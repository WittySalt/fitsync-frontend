import { clockLabel, dateLabel, dayPeriodFor, minutesOfDay, periodLabel } from './brief-time';

const TZ = 'Asia/Singapore';

describe('dayPeriodFor', () => {
  it('is NIGHT one minute before the morning boundary (04:59 SGT)', () => {
    expect(dayPeriodFor(new Date('2026-09-26T20:59:00Z'), TZ)).toBe('NIGHT');
  });

  it('is MORNING exactly at 05:00 SGT', () => {
    expect(dayPeriodFor(new Date('2026-09-26T21:00:00Z'), TZ)).toBe('MORNING');
  });

  it('is MORNING at the last minute before noon (11:59 SGT)', () => {
    expect(dayPeriodFor(new Date('2026-09-27T03:59:00Z'), TZ)).toBe('MORNING');
  });

  it('is AFTERNOON exactly at 12:00 SGT', () => {
    expect(dayPeriodFor(new Date('2026-09-27T04:00:00Z'), TZ)).toBe('AFTERNOON');
  });

  it('is AFTERNOON at the last minute before evening (16:59 SGT)', () => {
    expect(dayPeriodFor(new Date('2026-09-27T08:59:00Z'), TZ)).toBe('AFTERNOON');
  });

  it('is EVENING exactly at 17:00 SGT', () => {
    expect(dayPeriodFor(new Date('2026-09-27T09:00:00Z'), TZ)).toBe('EVENING');
  });

  it('is EVENING at the last minute before night (21:59 SGT)', () => {
    expect(dayPeriodFor(new Date('2026-09-27T13:59:00Z'), TZ)).toBe('EVENING');
  });

  it('is NIGHT exactly at 22:00 SGT', () => {
    expect(dayPeriodFor(new Date('2026-09-27T14:00:00Z'), TZ)).toBe('NIGHT');
  });

  it('falls back to the device timezone when given an invalid timezone', () => {
    expect(() => dayPeriodFor(new Date('2026-09-27T04:00:00Z'), 'Not/AZone')).not.toThrow();
  });
});

describe('periodLabel', () => {
  it('renders each period with a capital first letter', () => {
    expect(periodLabel('MORNING')).toBe('Morning');
    expect(periodLabel('AFTERNOON')).toBe('Afternoon');
    expect(periodLabel('EVENING')).toBe('Evening');
    expect(periodLabel('NIGHT')).toBe('Night');
  });
});

describe('clockLabel', () => {
  it('renders 24-hour time as HH:mm', () => {
    expect(clockLabel(new Date('2026-09-27T00:10:00Z'), TZ)).toBe('08:10');
  });

  it('pads single-digit hours and minutes', () => {
    expect(clockLabel(new Date('2026-09-26T21:05:00Z'), TZ)).toBe('05:05');
  });
});

describe('dateLabel', () => {
  it('renders weekday, day and short month with September as Sept', () => {
    expect(dateLabel(new Date('2026-09-27T00:10:00Z'), TZ)).toBe('Sunday 27 Sept');
  });

  it('does not abbreviate September to "Sep"', () => {
    expect(dateLabel(new Date('2026-09-27T00:10:00Z'), TZ)).not.toContain('Sep ');
  });
});

describe('minutesOfDay', () => {
  it('counts minutes from local midnight in the given timezone', () => {
    // 00:10 UTC is 08:10 in Singapore.
    expect(minutesOfDay(new Date('2026-09-27T00:10:00Z'), 'Asia/Singapore')).toBe(8 * 60 + 10);
    expect(minutesOfDay(new Date('2026-09-27T16:00:00Z'), 'Asia/Singapore')).toBe(0);
  });
});
