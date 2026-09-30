import { formatClock, formatLocalDateTime, isDateKeyUpTo, looksLikeEmail, relativeAge, titleCase } from './admin-format';

describe('admin format helpers', () => {
  describe('titleCase', () => {
    it('writes a code with a capital first letter', () => {
      expect(titleCase('STRENGTH')).toBe('Strength');
      expect(titleCase('MOBILITY')).toBe('Mobility');
    });

    it('turns underscores into spaces and tolerates empty text', () => {
      expect(titleCase('AUTH_PROVIDER')).toBe('Auth provider');
      expect(titleCase('')).toBe('');
      expect(titleCase('  cardio ')).toBe('Cardio');
    });
  });

  describe('relativeAge', () => {
    const now = new Date('2026-09-30T12:00:00Z');

    it('counts minutes below an hour', () => {
      expect(relativeAge('2026-09-30T11:57:00Z', now)).toBe('3 min');
      expect(relativeAge('2026-09-30T11:59:59Z', now)).toBe('0 min');
      expect(relativeAge('2026-09-30T11:00:01Z', now)).toBe('59 min');
    });

    it('counts hours below a day', () => {
      expect(relativeAge('2026-09-30T11:00:00Z', now)).toBe('1 h');
      expect(relativeAge('2026-09-30T10:00:00Z', now)).toBe('2 h');
      expect(relativeAge('2026-09-29T12:00:01Z', now)).toBe('23 h');
    });

    it('counts days from a day upwards', () => {
      expect(relativeAge('2026-09-29T12:00:00Z', now)).toBe('1 d');
      expect(relativeAge('2026-09-26T12:00:00Z', now)).toBe('4 d');
    });

    it('treats a future instant as no time at all and returns null for text that is not a date', () => {
      expect(relativeAge('2026-09-30T12:05:00Z', now)).toBe('0 min');
      expect(relativeAge('yesterday', now)).toBeNull();
      expect(relativeAge('', now)).toBeNull();
    });
  });

  describe('formatClock', () => {
    it('writes hours and minutes on a 24 hour clock in the local timezone', () => {
      const date = new Date(2026, 8, 30, 14, 5);

      expect(formatClock(date)).toBe('14:05');
      expect(formatClock(date.toISOString())).toBe('14:05');
    });

    it('never writes 24 for midnight and returns null for text that is not a date', () => {
      expect(formatClock(new Date(2026, 8, 30, 0, 7))).toBe('00:07');
      expect(formatClock('not a time')).toBeNull();
    });
  });

  describe('formatLocalDateTime', () => {
    it('gives a full local date and time with the seconds', () => {
      expect(formatLocalDateTime(new Date(2026, 8, 30, 9, 4, 5).toISOString())).toMatch(/^30 Sep[a-z]* 2026, 09:04:05$/);
    });

    it('returns null for text that is not a date', () => {
      expect(formatLocalDateTime('')).toBeNull();
    });
  });

  describe('isDateKeyUpTo', () => {
    it('accepts today and earlier days', () => {
      expect(isDateKeyUpTo('2026-09-30', '2026-09-30')).toBeTrue();
      expect(isDateKeyUpTo('2026-01-01', '2026-09-30')).toBeTrue();
    });

    it('rejects later days, empty text and impossible dates', () => {
      expect(isDateKeyUpTo('2026-10-01', '2026-09-30')).toBeFalse();
      expect(isDateKeyUpTo('', '2026-09-30')).toBeFalse();
      expect(isDateKeyUpTo('2026-13-40', '2026-09-30')).toBeFalse();
      expect(isDateKeyUpTo('30/09/2026', '2026-09-30')).toBeFalse();
    });
  });

  describe('looksLikeEmail', () => {
    it('accepts an ordinary address', () => {
      expect(looksLikeEmail('member@example.com')).toBeTrue();
    });

    it('rejects empty text, missing parts, spaces and more than 120 characters', () => {
      expect(looksLikeEmail('')).toBeFalse();
      expect(looksLikeEmail('member')).toBeFalse();
      expect(looksLikeEmail('member@example')).toBeFalse();
      expect(looksLikeEmail('mem ber@example.com')).toBeFalse();
      expect(looksLikeEmail(`${'a'.repeat(110)}@example.com`)).toBeFalse();
    });
  });
});
