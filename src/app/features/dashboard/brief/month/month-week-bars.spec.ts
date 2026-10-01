import { BARS_HEIGHT, BARS_WIDTH, buildWeekBars, describeWeekBars } from './month-week-bars';
import { septemberInsight } from './month-fixtures.spec';

describe('month week bars', () => {
  const { weeks, monthStart } = septemberInsight();

  it('draws one bar for each week with the count above and the first day inside the month below', () => {
    const chart = buildWeekBars(weeks, monthStart)!;
    expect(chart.bars.map((bar) => bar.sessions)).toEqual([3, 4, 4, 4, 2]);
    expect(chart.bars.map((bar) => bar.label)).toEqual(['1', '7', '14', '21', '28']);
    expect(chart.max).toBe(4);
  });

  it('marks the weeks that are not over', () => {
    const chart = buildWeekBars(weeks, monthStart)!;
    expect(chart.bars.map((bar) => bar.complete)).toEqual([true, true, true, true, false]);
  });

  it('stacks the kinds from the bottom up and scales the tallest bar to the plot', () => {
    const chart = buildWeekBars(weeks, monthStart)!;
    const tall = chart.bars[1];
    expect(tall.segments.map((segment) => segment.kind)).toEqual(['strength', 'cardio', 'sport']);
    expect(tall.segments.map((segment) => segment.count)).toEqual([2, 1, 1]);
    // Each segment sits on top of the one before, and the first sits on the base line.
    expect(tall.segments[0].y + tall.segments[0].height).toBeCloseTo(chart.baseY, 1);
    expect(tall.segments[1].y + tall.segments[1].height).toBeCloseTo(tall.segments[0].y, 1);
    const total = tall.segments.reduce((sum, segment) => sum + segment.height, 0);
    expect(total).toBeCloseTo(chart.baseY - tall.countY - 6, 1);
    // A bar of two sessions is half the height of one of four.
    const small = chart.bars[4];
    expect(small.segments.reduce((sum, segment) => sum + segment.height, 0)).toBeCloseTo(total / 2, 1);
  });

  it('gives a week a segment for sessions that fit no kind and none for a week without sessions', () => {
    const chart = buildWeekBars(
      [
        { ...weeks[0], sessions: 3, strengthSessions: 1, cardioSessions: 0, mobilitySessions: 0, sportSessions: 0 },
        { ...weeks[1], sessions: 0, strengthSessions: 0, cardioSessions: 0, mobilitySessions: 0, sportSessions: 0 }
      ],
      monthStart
    )!;
    expect(chart.bars[0].segments.map((segment) => segment.kind)).toEqual(['strength', 'other']);
    expect(chart.bars[1].segments).toEqual([]);
    expect(chart.kinds).toEqual(['strength', 'other']);
  });

  it('keeps every bar and label inside the drawing', () => {
    for (let count = 1; count <= 6; count += 1) {
      const many = Array.from({ length: count }, (_, index) => ({ ...weeks[1], weekStart: `2026-09-${String(7 + index).padStart(2, '0')}` }));
      const chart = buildWeekBars(many, monthStart)!;
      for (const bar of chart.bars) {
        expect(bar.x).toBeGreaterThanOrEqual(0);
        expect(bar.x + bar.width).toBeLessThanOrEqual(BARS_WIDTH);
        expect(bar.countY).toBeGreaterThan(0);
      }
      expect(chart.baseY + 20).toBeLessThanOrEqual(BARS_HEIGHT);
    }
  });

  it('lists only the kinds that appear', () => {
    expect(buildWeekBars(weeks, monthStart)!.kinds).toEqual(['strength', 'cardio', 'mobility', 'sport']);
  });

  it('draws nothing without weeks', () => {
    expect(buildWeekBars([], monthStart)).toBeNull();
  });

  it('describes the chart in words', () => {
    expect(describeWeekBars(weeks.slice(0, 2), monthStart, '2026-09')).toBe(
      'Sessions by week: week of 1 September, 3 sessions; week of 7 September, 4 sessions'
    );
    expect(describeWeekBars([{ ...weeks[0], sessions: 1 }], monthStart, '2026-09')).toBe('Sessions by week: week of 1 September, 1 session');
  });
});
