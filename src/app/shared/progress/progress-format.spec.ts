import { daysBetween, formatNumber, hasEarlier, hoursAndMinutes, isDateKey, lastDays, periodEyebrow, pointLabel, shiftDay, signed, textWidth, trendWord } from './progress-format';
import { arr, bool, compared, list, mapDotDays, mapHighlights, mapSeries, mapSummaryLines, num, obj, str } from './progress-mappers';

describe('progress format', () => {
  it('writes signed numbers with a true minus sign and no sign on zero', () => {
    expect(signed(-0.41, 2)).toBe('−0.41');
    expect(signed(1.6)).toBe('+1.6');
    expect(signed(0)).toBe('0.0');
    expect(signed(-0.004, 2)).toBe('0.00');
  });

  it('groups thousands and keeps the asked digits', () => {
    expect(formatNumber(2123)).toBe('2,123');
    expect(formatNumber(71.2, 1)).toBe('71.2');
  });

  it('labels date keys as short dates and leaves other labels alone', () => {
    expect(pointLabel('2026-09-06', new Date(2026, 9, 3))).toBe('6 Sept');
    expect(pointLabel('Food log')).toBe('Food log');
    expect(isDateKey('2026-09-06')).toBeTrue();
    expect(isDateKey('6 Sept')).toBeFalse();
  });

  it('writes trend words in lower case', () => {
    expect(trendWord('UP')).toBe('up');
    expect(trendWord('faster')).toBe('faster');
    expect(trendWord(null)).toBe('');
  });

  it('writes minutes as hours and minutes', () => {
    expect(hoursAndMinutes(45)).toBe('45 min');
    expect(hoursAndMinutes(70)).toBe('1 h 10');
    expect(hoursAndMinutes(120)).toBe('2 h');
  });

  it('counts days and moves keys by calendar days', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(lastDays(28, '2026-10-03')).toEqual({ from: '2026-09-06', to: '2026-10-03' });
    expect(daysBetween('2026-09-06', '2026-10-03')).toBe(27);
    expect(textWidth('abc')).toBeGreaterThan(0);
  });
});

describe('progress mappers', () => {
  it('reads plain values defensively', () => {
    expect(obj([])).toBeNull();
    expect(obj({ a: 1 })).toEqual({ a: 1 });
    expect(arr('x')).toEqual([]);
    expect(num(Number.NaN)).toBeNull();
    expect(num(3)).toBe(3);
    expect(str('  ')).toBeNull();
    expect(bool('true')).toBeFalse();
    expect(compared({ value: 2 }, num)).toEqual({ value: 2, previous: null });
    expect(list([{ a: 1 }, 'x', null], (item) => item)).toEqual([{ a: 1 }]);
  });

  it('keeps highlights with a code and a title, at most four', () => {
    const wire = [
      { code: 'LIFT_UP', title: 'Up', series: [{ label: '2026-09-08', value: 80 }, { label: 'bad' }], unit: 'kg', context: 'c' },
      { code: 'X' },
      ...Array.from({ length: 5 }, (_, i) => ({ code: `C${i}`, title: `T${i}` }))
    ];
    const highlights = mapHighlights(wire);
    expect(highlights.length).toBe(4);
    expect(highlights[0]).toEqual({ code: 'LIFT_UP', title: 'Up', series: [{ label: '2026-09-08', value: 80 }], unit: 'kg', context: 'c' });
    expect(highlights[1].unit).toBe('');
  });

  it('reads series, summary lines and day states', () => {
    expect(mapSeries([{ weekStart: '2026-09-07', avg: 2 }], 'weekStart', 'avg')).toEqual([{ label: '2026-09-07', value: 2 }]);
    expect(mapSummaryLines([{ text: 'Volume 1.9 t', trend: 'STEADY' }, { trend: 'UP' }])).toEqual([{ text: 'Volume 1.9 t', trend: 'STEADY' }]);
    expect(mapDotDays([{ date: '2026-09-04', state: 'MET' }, { date: '2026-09-05', state: 'ODD' }])).toEqual([{ date: '2026-09-04', state: 'MET' }]);
  });
});

describe('period wording', () => {
  const reference = new Date(2026, 9, 3);

  it('writes the eyebrow with the period in words and the dates', () => {
    expect(periodEyebrow('Goal', '4w', '2026-09-06', '2026-10-03', reference)).toBe('GOAL · THE LAST 4 WEEKS · 6 SEPT TO 3 OCT');
  });

  it('carries the year on both dates when the period crosses New Year', () => {
    expect(periodEyebrow('Food', '1y', '2025-10-05', '2026-10-03', reference)).toBe('FOOD · THE LAST YEAR · 5 OCT 2025 TO 3 OCT 2026');
  });

  it('compares only with an earlier figure that is there and not zero', () => {
    expect(hasEarlier(10, 8)).toBeTrue();
    expect(hasEarlier(10, null)).toBeFalse();
    expect(hasEarlier(10, 0)).toBeFalse();
    expect(hasEarlier(null, 8)).toBeFalse();
  });
});
