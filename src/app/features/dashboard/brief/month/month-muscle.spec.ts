import { DayKind, MonthDayInsight } from '../../../../core/fitsync.models';
import { buildMuscleRows, daysOfGroup, muscleChartTitle } from './month-muscle';

const day = (date: string, kind: DayKind, muscles: string[], record = false): MonthDayInsight => ({
  date,
  kind,
  label: kind,
  sessions: 1,
  minutes: 45,
  muscles,
  record
});

function lines(days: MonthDayInsight[], total?: number, group = 'CHEST'): string[] {
  return buildMuscleRows(days, group, '2026-09', total).map((row) => (row.note ? `${row.headline} ${row.note}` : row.headline));
}

describe('muscle lines', () => {
  const chest = [
    day('2026-09-03', 'STRENGTH', ['CHEST', 'ARMS']),
    day('2026-09-07', 'STRENGTH', ['CHEST']),
    day('2026-09-10', 'STRENGTH', ['CHEST', 'CORE']),
    day('2026-09-14', 'STRENGTH', ['CHEST'])
  ];

  it('says how many sessions, that they were all on strength days, and on which dates', () => {
    expect(lines(chest)[0]).toBe('Four sessions, all on strength days. 3, 7, 10 and 14 September.');
  });

  it('names two kinds of day, and counts three or more, so that the headline fits one line', () => {
    const mixed = [...chest, day('2026-09-20', 'CARDIO', ['CHEST', 'CARDIO']), day('2026-09-22', 'SPORT', ['CHEST'])];
    expect(lines(mixed)[0]).toBe('Six sessions, on three kinds of day. 3, 7, 10, 14, 20 and 22 September.');
    expect(lines([chest[0], day('2026-09-05', 'CARDIO', ['CHEST'])])[0]).toBe('Two sessions, strength and cardio. 3 and 5 September.');
  });

  it('gives the span instead of the dates from the seventh day on, and counts in digits above twelve', () => {
    const many = Array.from({ length: 13 }, (_, index) => day(`2026-09-${String(index + 2).padStart(2, '0')}`, 'STRENGTH', ['CHEST']));
    expect(lines(many)[0]).toBe('13 sessions, all on strength days. From 2 to 14 September.');
    expect(lines(many.slice(0, 7))[0]).toBe('Seven sessions, all on strength days. From 2 to 8 September.');
  });

  it('takes the count of the month when it is larger than the number of days', () => {
    expect(lines(chest, 5)[0]).toBe('Five sessions, all on strength days. 3, 7, 10 and 14 September.');
    expect(lines(chest, 2)[0]).toBe('Four sessions, all on strength days. 3, 7, 10 and 14 September.');
  });

  it('says one session in the singular and has no gap to give', () => {
    expect(lines([chest[0]])).toEqual(['One session, all on strength days. 3 September.']);
  });

  it('gives the average and the longest gap in days', () => {
    expect(lines(chest)[1]).toBe('Four days apart on average. The longest gap was four days.');
    expect(lines([chest[0], chest[1], day('2026-09-12', 'STRENGTH', ['CHEST'])])[1]).toBe('Five days apart on average. The longest gap was five days.');
    expect(lines([day('2026-09-03', 'STRENGTH', ['CHEST']), day('2026-09-04', 'STRENGTH', ['CHEST'])])[1]).toBe('One day apart on average. The longest gap was one day.');
  });

  it('counts the days that set a record, with their dates', () => {
    const days = [day('2026-09-03', 'STRENGTH', ['CHEST'], true), chest[1], day('2026-09-12', 'STRENGTH', ['CHEST'], true)];
    expect(lines(days)[2]).toBe('Two of these days set a record. 3 and 12 September.');
    expect(lines([day('2026-09-03', 'STRENGTH', ['CHEST'], true), chest[1]])[2]).toBe('One of these days set a record. 3 September.');
  });

  it('leaves the record line out when no day set one', () => {
    expect(buildMuscleRows(chest, 'CHEST', '2026-09').length).toBe(2);
  });

  it('keeps the dates of the record line out when there are too many to fit', () => {
    const many = Array.from({ length: 8 }, (_, index) => day(`2026-09-${String(index + 2).padStart(2, '0')}`, 'STRENGTH', ['CHEST'], true));
    expect(lines(many)[2]).toBe('Eight of these days set a record.');
  });

  it('puts the days in date order whatever the order of the response', () => {
    expect(lines([chest[3], chest[0], chest[2], chest[1]])[0]).toContain('3, 7, 10 and 14 September.');
  });

  it('gives nothing for a group that no day trained', () => {
    expect(buildMuscleRows(chest, 'LEGS', '2026-09')).toEqual([]);
  });

  it('ignores a day that is not a training day', () => {
    expect(daysOfGroup([day('2026-09-03', 'REST', ['CHEST']), chest[0]], 'CHEST').map((entry) => entry.date)).toEqual(['2026-09-03']);
  });

  it('never says what is missing, compares or asks for anything', () => {
    const all = lines([chest[0], day('2026-09-12', 'STRENGTH', ['CHEST'], true)]).join(' ');
    expect(all).not.toMatch(/\b(missed|missing|only|should|try|must|need|didn't|than|others)\b/i);
  });
});

describe('muscleChartTitle', () => {
  it('names the group and its sessions, in the singular for one', () => {
    expect(muscleChartTitle({ group: 'CHEST', label: 'Chest', sessions: 8 })).toBe('Chest, 8 sessions');
    expect(muscleChartTitle({ group: 'CHEST', label: 'Chest', sessions: 1 })).toBe('Chest, 1 session');
  });
});
