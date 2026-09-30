import {
  addDaysToKey,
  dateKeyInZone,
  formatMilliseconds,
  formatSeconds,
  passedAnswersLine,
  pivotReadings,
  rangeEndingToday,
  readingLabel,
  readingsNote,
  sharePercent,
  toolCallsNote
} from './coach-quality.format';

describe('coach quality formatting', () => {
  it('rounds shares to whole percents and shows 0% without a total', () => {
    expect(sharePercent(30, 42)).toBe(71);
    expect(sharePercent(4, 42)).toBe(10);
    expect(sharePercent(3, 42)).toBe(7);
    expect(sharePercent(5, 42)).toBe(12);
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(3, 0)).toBe(0);
  });

  it('formats seconds with one decimal and milliseconds as whole numbers', () => {
    expect(formatSeconds(2600)).toBe('2.6 s');
    expect(formatSeconds(7449)).toBe('7.4 s');
    expect(formatSeconds(0)).toBe('0.0 s');
    expect(formatMilliseconds(14)).toBe('14 ms');
    expect(formatMilliseconds(1.4)).toBe('1 ms');
  });

  it('describes the passed answers and their models', () => {
    expect(passedAnswersLine(0, [{ model: 'a', count: 1 }])).toBe('No passed answers in this period.');
    expect(passedAnswersLine(1, [{ model: 'a', count: 1 }])).toBe('1 passed answer, all from a');
    expect(passedAnswersLine(30, [{ model: 'claude-haiku-4-5', count: 30 }])).toBe('30 passed answers, all from claude-haiku-4-5');
    expect(
      passedAnswersLine(30, [
        { model: 'a', count: 5 },
        { model: 'b', count: 25 }
      ])
    ).toBe('30 passed answers, from b and a');
    expect(
      passedAnswersLine(30, [
        { model: 'a', count: 5 },
        { model: 'b', count: 20 },
        { model: 'c', count: 5 }
      ])
    ).toBe('30 passed answers, from 3 models');
    expect(passedAnswersLine(4, [])).toBe('4 passed answers');
  });

  it('summarises the tool calls', () => {
    expect(
      toolCallsNote([
        { tool: 'readFacts', calls: 40, failed: 0, medianMs: 14 },
        { tool: 'searchExercises', calls: 44, failed: 0, medianMs: 10 }
      ])
    ).toBe('84 calls, none failed');
    expect(
      toolCallsNote([
        { tool: 'readFacts', calls: 40, failed: 2, medianMs: 14 },
        { tool: 'searchExercises', calls: 44, failed: 1, medianMs: 10 }
      ])
    ).toBe('84 calls, 3 failed');
    expect(toolCallsNote([{ tool: 'readFacts', calls: 1, failed: 0, medianMs: 1 }])).toBe('1 call, none failed');
    expect(toolCallsNote([])).toBe('0 calls, none failed');
  });

  it('labels a page and its writer', () => {
    expect(readingLabel('WORKOUT', 'MODEL')).toBe('Workout, coach model');
    expect(readingLabel('WORKOUT', 'RULES')).toBe('Workout, fixed rules');
    expect(readingLabel('NUTRITION', 'SOMETHING_NEW')).toBe('Nutrition, something new');
    expect(readingLabel('WORKOUT', '')).toBe('Workout');
  });

  it('pivots readings by outcome and leaves other outcomes out', () => {
    const rows = pivotReadings([
      { surface: 'WORKOUT', source: 'RULES', outcome: 'ACCEPTED', count: 9 },
      { surface: 'WORKOUT', source: 'MODEL', outcome: 'ACCEPTED', count: 6 },
      { surface: 'WORKOUT', source: 'MODEL', outcome: 'REJECTED', count: 1 },
      { surface: 'WORKOUT', source: 'MODEL', outcome: 'SKIPPED', count: 50 },
      { surface: 'NUTRITION', source: 'MODEL', outcome: 'SKIPPED', count: 3 }
    ]);

    expect(rows).toEqual([
      { label: 'Workout, coach model', accepted: 6, rejected: 1 },
      { label: 'Workout, fixed rules', accepted: 9, rejected: 0 }
    ]);
    expect(readingsNote(rows)).toBe('16 readings');
    expect(readingsNote([])).toBe('0 readings');
    expect(readingsNote([{ label: 'x', accepted: 1, rejected: 0 }])).toBe('1 reading');
  });

  it('reads the calendar date of an instant in a timezone', () => {
    const instant = new Date('2026-09-30T20:00:00Z');

    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-09-30');
    expect(dateKeyInZone(instant, 'Asia/Singapore')).toBe('2026-10-01');
    expect(dateKeyInZone(instant, 'America/Los_Angeles')).toBe('2026-09-30');
    expect(dateKeyInZone(instant, 'Not/AZone')).toBe('2026-09-30');
  });

  it('moves a date key across month and year ends', () => {
    expect(addDaysToKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToKey('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('builds a range that ends today and includes both ends', () => {
    const now = new Date('2026-09-30T04:00:00Z');

    expect(rangeEndingToday(7, now, 'Asia/Singapore')).toEqual({ from: '2026-09-24', to: '2026-09-30' });
    expect(rangeEndingToday(30, now, 'UTC')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeEndingToday(90, now, 'UTC')).toEqual({ from: '2026-07-03', to: '2026-09-30' });
  });
});
