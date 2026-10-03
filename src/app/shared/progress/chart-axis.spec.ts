import { dropColliding, fromFirstData, periodForWeeks, timeAxisLabels, weekAxisLabels, weekLabelMarks } from './chart-axis';

/** Mondays from `first`, one a week. */
function weeks(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`);
  return Array.from({ length: count }, (_, k) => new Date(start + k * 7 * 86_400_000).toISOString().slice(0, 10));
}

describe('weekAxisLabels', () => {
  it('names every week for four weeks', () => {
    const labels = weekAxisLabels(weeks('2026-09-07', 4), '4w');
    expect(labels.map((l) => l.text)).toEqual(['7 Sept', '14 Sept', '21 Sept', '28 Sept']);
  });

  it('names every second week for three months, counted back from the last, with month names at month starts', () => {
    const run = weeks('2026-07-06', 13);
    const labels = weekAxisLabels(run, '3m');
    // The last week is always named; the month names stand where a month starts.
    expect(labels.at(-1)?.index).toBe(12);
    expect(labels.filter((l) => l.month).map((l) => l.text)).toEqual(['Aug', 'Sept']);
    const plain = labels.filter((l) => !l.month).map((l) => l.index);
    expect(plain.every((index) => (12 - index) % 2 === 0)).toBeTrue();
  });

  it('names month starts only for a year, and January carries its year', () => {
    const run = weeks('2025-10-06', 52);
    const labels = weekAxisLabels(run, '1y');
    expect(labels.every((l) => l.month)).toBeTrue();
    expect(labels.length).toBe(11);
    expect(labels.map((l) => l.text)).toContain('Jan 2026');
    expect(labels.map((l) => l.text)).toContain('Nov');
  });

  it('reads the period from the number of weeks', () => {
    expect([4, 5, 13, 52].map(periodForWeeks)).toEqual(['4w', '4w', '3m', '1y']);
  });
});

describe('dropColliding', () => {
  it('drops a label that would touch the one before it, left to right', () => {
    const kept = dropColliding([
      { x: 10, text: '7 Sept', anchor: 'middle' as const },
      { x: 30, text: '14 Sept', anchor: 'middle' as const },
      { x: 120, text: '21 Sept', anchor: 'middle' as const }
    ]);
    expect(kept.map((l) => l.text)).toEqual(['7 Sept', '21 Sept']);
  });

  it('keeps labels that have room, and respects the side a label grows towards', () => {
    const kept = dropColliding([
      { x: 0, text: 'Start', anchor: 'start' as const },
      { x: 200, text: 'End', anchor: 'end' as const },
      { x: 100, text: 'Middle', anchor: 'middle' as const }
    ]);
    expect(kept.map((l) => l.text)).toEqual(['Start', 'Middle', 'End']);
  });

  it('places a kept month name before the week date beside it', () => {
    const kept = dropColliding([
      { x: 100, text: '28 Sept', anchor: 'middle' as const },
      { x: 112, text: 'Oct', anchor: 'middle' as const, keep: true }
    ]);
    expect(kept.map((l) => l.text)).toEqual(['Oct']);
  });
});

describe('weekLabelMarks', () => {
  it('thins a crowded axis so no two labels touch', () => {
    const run = weeks('2025-10-06', 52);
    const marks = weekLabelMarks(run, (index) => 40 + index * 4, '4w');
    for (let k = 1; k < marks.length; k += 1) {
      expect(marks[k].x - marks[k - 1].x).toBeGreaterThan(30);
    }
    expect(marks.length).toBeLessThan(15);
  });
});

describe('timeAxisLabels', () => {
  const x = (from: string, to: string) => (key: string) => ((Date.parse(key) - Date.parse(from)) / (Date.parse(to) - Date.parse(from))) * 600;

  it('names the Mondays for a month, newest included', () => {
    const labels = timeAxisLabels('2026-09-06', '2026-10-03', x('2026-09-06', '2026-10-03'));
    expect(labels.map((l) => l.text)).toEqual(['7 Sept', '14 Sept', '21 Sept', '28 Sept']);
  });

  it('names months at month starts for a year', () => {
    const labels = timeAxisLabels('2025-10-05', '2026-10-03', x('2025-10-05', '2026-10-03'));
    expect(labels.map((l) => l.text)).toContain('Jan 2026');
    expect(labels.every((l) => !/^\d/.test(l.text))).toBeTrue();
  });
});

describe('fromFirstData', () => {
  it('starts at the first week with data', () => {
    const run = [{ v: null }, { v: null }, { v: 3 }, { v: null }, { v: 5 }];
    expect(fromFirstData(run, (w) => w.v !== null).length).toBe(3);
  });

  it('keeps a run with no data at all', () => {
    expect(fromFirstData([{ v: null }, { v: null }], (w) => w.v !== null).length).toBe(2);
  });
});
