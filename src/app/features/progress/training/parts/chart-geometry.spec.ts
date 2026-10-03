import { trainingFixture } from '../training-fixture.spec';
import { calendarPage, logStats } from './calendar-grid';
import { formPosition, loadChart, minutesTop, seriesChart } from './chart-geometry';

describe('training chart geometry', () => {
  it('puts minute scales on whole hours', () => {
    expect(minutesTop(245)).toBe(300);
    expect(minutesTop(10)).toBe(60);
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
    expect(chart.hasCurrent).toBeTrue();
    expect(chart.columns[2].current).toBeTrue();
    expect(chart.columns[0].bars.map((bar) => bar.kind)).toEqual(['STRENGTH', 'CARDIO', 'SPORT']);
    expect(chart.fitness.split(' ').length).toBe(3);
    expect(loadChart({ weeks: [], fitness: [], fatigue: [], form: null }, '2026-10-01')).toBeNull();
    expect(formPosition('FRESH', 1070, 600)).toBeGreaterThan(50);
    expect(formPosition('TIRED', null, null)).toBe(15);
  });
});

describe('training chart axes', () => {
  it('draws at the width it is given, so text is never scaled', () => {
    const load = trainingFixture().load;
    expect(loadChart(load, '2026-10-01', 420)!.width).toBe(420);
    const lift = trainingFixture().lifts[0];
    const narrow = seriesChart(lift.e1rm, { width: 260 })!;
    expect(narrow.width).toBe(260);
    expect(narrow.x1).toBeLessThanOrEqual(260);
  });

  it('starts the load at the first week with load and names weeks that do not touch', () => {
    const load = trainingFixture().load;
    const empty = { ...load.weeks[0], total: 0, byKind: { STRENGTH: 0, CARDIO: 0, SPORT: 0, MOBILITY: 0 } };
    const chart = loadChart({ ...load, weeks: [empty, ...load.weeks] }, '2026-10-01')!;
    expect(chart.columns.length).toBe(load.weeks.length);
    for (let k = 1; k < chart.labels.length; k += 1) {
      expect(chart.labels[k].x - chart.labels[k - 1].x).toBeGreaterThan(30);
    }
  });

  it('always writes the first and last date of a series, and drops a date between that would touch them', () => {
    const lift = trainingFixture().lifts[0];
    const chart = seriesChart(lift.e1rm, { width: 200 })!;
    expect(chart.dates[0].anchor).toBe('start');
    expect(chart.dates[chart.dates.length - 1].anchor).toBe('end');
    for (let k = 1; k < chart.dates.length; k += 1) {
      expect(chart.dates[k].x).toBeGreaterThan(chart.dates[k - 1].x);
    }
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
