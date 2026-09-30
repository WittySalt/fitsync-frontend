import { CoachDailyCount } from './admin-api.service';
import { barWidthPercent, buildDayBars, chartAltText, chartRangeLabel, largestCount } from './coach-quality.chart';

function day(date: string, overrides: Partial<CoachDailyCount> = {}): CoachDailyCount {
  return { date, answers: 0, passed: 0, rejected: 0, refused: 0, modelUnavailable: 0, ...overrides };
}

describe('coach quality chart', () => {
  const week: CoachDailyCount[] = [
    day('2026-09-24', { answers: 5, passed: 4, rejected: 1 }),
    day('2026-09-25', { answers: 15, passed: 7, rejected: 2, refused: 1, modelUnavailable: 5 }),
    day('2026-09-26')
  ];

  it('scales every bar to the largest daily total', () => {
    const bars = buildDayBars(week, 150);

    expect(bars[1].total).toBe(15);
    expect(bars[1].segments.map((segment) => [segment.kind, segment.heightPx])).toEqual([
      ['passed', 70],
      ['rejected', 20],
      ['refused', 10],
      ['unavailable', 50]
    ]);
    expect(bars[0].segments.map((segment) => [segment.kind, segment.heightPx])).toEqual([
      ['passed', 40],
      ['rejected', 10]
    ]);
  });

  it('stacks passed at the bottom and unavailable at the top', () => {
    const kinds = buildDayBars(week)[1].segments.map((segment) => segment.kind);

    expect(kinds).toEqual(['passed', 'rejected', 'refused', 'unavailable']);
  });

  it('gives an empty day no segments and keeps a thin segment visible', () => {
    const bars = buildDayBars([day('2026-09-24', { answers: 1000, passed: 999, rejected: 1 }), day('2026-09-25')]);

    expect(bars[1].segments).toEqual([]);
    expect(bars[0].segments[1].heightPx).toBe(3);
  });

  it('handles a period without days or answers', () => {
    expect(buildDayBars([])).toEqual([]);
    expect(buildDayBars([day('2026-09-24')])[0].segments).toEqual([]);
  });

  it('prints the date as 24 Sept with Sep written as Sept', () => {
    expect(buildDayBars(week).map((bar) => bar.label)).toEqual(['24 Sept', '25 Sept', '26 Sept']);
  });

  it('labels every date for a week and every seventh date for a longer range', () => {
    const weekBars = buildDayBars(Array.from({ length: 7 }, (_, index) => day(`2026-09-${String(20 + index)}`)));
    const monthBars = buildDayBars(Array.from({ length: 30 }, (_, index) => day(`2026-09-${String(index + 1).padStart(2, '0')}`)));

    expect(weekBars.every((bar) => bar.showLabel)).toBeTrue();
    expect(monthBars.filter((bar) => bar.showLabel).map((bar) => bar.label)).toEqual(['1 Sept', '8 Sept', '15 Sept', '22 Sept', '29 Sept']);
  });

  it('describes the chart in words', () => {
    expect(chartAltText(buildDayBars(week))).toBe('Answers by day: 24 Sept 5, 25 Sept 15, 26 Sept 0.');
    expect(chartAltText([])).toBe('Answers by day: no days in this period.');
  });

  it('names the dates the chart covers', () => {
    expect(chartRangeLabel(buildDayBars(week))).toBe('24 to 26 Sept');
    expect(chartRangeLabel([])).toBe('');
  });

  it('sizes rule bars against the largest count', () => {
    const rows = [{ count: 2 }, { count: 1 }, { count: 1 }];

    expect(largestCount(rows)).toBe(2);
    expect(largestCount([])).toBe(0);
    expect(barWidthPercent(2, 2)).toBe(100);
    expect(barWidthPercent(1, 2)).toBe(50);
    expect(barWidthPercent(1, 0)).toBe(0);
  });
});
