import { trainingFixture } from '../training-fixture.spec';
import { calendarPage, logStats } from './calendar-grid';
import { formPosition, loadChart, minutesTop, seriesChart, smallTrend, stepChart } from './chart-geometry';

describe('training chart geometry', () => {
  it('writes the start and end of a small trend beside its first and last points', () => {
    const chart = smallTrend([81.7, 87.5, 93.3], 260, 44, '81.7 kg', '93.3 kg');
    expect(chart).not.toBeNull();
    expect(chart!.start.anchor).toBe('end');
    expect(chart!.start.x).toBeLessThan(chart!.first.x);
    expect(chart!.end.x).toBeGreaterThan(chart!.last.x);
    expect(chart!.last.y).toBeLessThan(chart!.first.y);
    expect(smallTrend([1], 100, 40, 'a', 'b')).toBeNull();
  });

  it('steps the total time up on each session and ends with its total', () => {
    const chart = stepChart([{ date: '2026-09-08', minutes: 50 }, { date: '2026-09-15', minutes: 45 }], '2026-09-06', '2026-10-03', 300);
    expect(chart.endLabel).toBe('1 h 35 min');
    expect(chart.d.match(/V/g)?.length).toBe(2);
    expect(chart.grid.map((line) => line.label)).toEqual(['0', '2.5 h', '5 h']);
    expect(minutesTop(245)).toBe(300);
  });

  it('draws a lift with records filled, the dashed best before and labels clear of it', () => {
    const lift = trainingFixture().lifts[0];
    const chart = seriesChart(lift.e1rm, { bestBefore: lift.bestBefore })!;
    expect(chart.dots.map((dot) => dot.record)).toEqual([false, true, true]);
    expect(chart.before?.label).toBe('best before, 85 kg');
    expect(chart.first.text).toBe('81.7');
    expect(chart.last.text).toBe('93.3');
    expect(chart.grid.every((line) => line.label.endsWith(' kg'))).toBeTrue();
    expect(chart.dates[chart.dates.length - 1].text).toMatch(/^2 Oct$/);
    expect(seriesChart([])).toBeNull();
  });

  it('marks this week as so far and stacks the kinds', () => {
    const load = trainingFixture().load;
    const chart = loadChart(load, '2026-10-01')!;
    expect(chart.soFar?.text).toBe('this week so far');
    expect(chart.columns[2].current).toBeTrue();
    expect(chart.columns[0].bars.map((bar) => bar.kind)).toEqual(['STRENGTH', 'CARDIO', 'SPORT']);
    expect(chart.fitness.split(' ').length).toBe(3);
    expect(loadChart({ weeks: [], fitness: [], fatigue: [], form: null }, '2026-10-01')).toBeNull();
    expect(formPosition('FRESH', 1070, 600)).toBeGreaterThan(50);
    expect(formPosition('TIRED', null, null)).toBe(15);
  });
});

describe('training calendar', () => {
  it('lays four weeks over Monday to Sunday rows with days outside the period faded', () => {
    const progress = trainingFixture();
    const page = calendarPage(progress.period.from, progress.period.to, progress.calendar);
    expect(page.pages).toBe(1);
    expect(page.cells.length % 7).toBe(0);
    expect(page.cells[0].date).toBe('2026-08-31');
    expect(page.cells[0].state).toBe('outside');
    const trained = page.cells.find((cell) => cell.date === '2026-09-08')!;
    expect(trained.state).toBe('trained');
    expect(trained.sessionId).toBe('s-1');
    expect(page.cells.find((cell) => cell.date === '2026-09-15')?.record).toBeTrue();
    expect(page.cells.find((cell) => cell.date === '2026-10-01')?.label).toMatch(/^1 Oct$/);
  });

  it('pages a long period by month and starts on the last', () => {
    const page = calendarPage('2025-10-05', '2026-10-03', []);
    expect(page.pages).toBe(13);
    expect(page.title).toBe('October 2026');
    expect(calendarPage('2025-10-05', '2026-10-03', [], 0).title).toBe('October 2025');
  });

  it('works out the log figures from the trained days', () => {
    const progress = trainingFixture();
    const stats = logStats(progress.period.from, progress.period.to, progress.calendar)!;
    expect(stats.daysTrained).toBe('3 of 28');
    expect(stats.longestBreak).toBe('16 days');
    expect(stats.mostRegular).toBe('Tue');
    expect(stats.neverTrained).toContain('Monday');
    expect(logStats('2026-09-06', '2026-10-03', [])).toBeNull();
  });
});
