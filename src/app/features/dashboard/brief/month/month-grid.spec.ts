import { MonthDayInsight } from '../../../../core/fitsync.models';
import {
  CELL_HEIGHT_DEFAULT,
  CELL_HEIGHT_SIX_ROWS,
  MonthCell,
  MonthGrid,
  MonthGridInput,
  buildMonthGrid,
  dateKeyInTimezone,
  daysInMonth,
  describeDate,
  monthOfDate,
  monthTitle,
  shiftMonth,
  shortDate,
  weekdayIndex
} from './month-grid';

function day(date: string, overrides: Partial<MonthDayInsight> = {}): MonthDayInsight {
  return { date, kind: 'CARDIO', label: 'Cardio', sessions: 1, minutes: 35, muscles: ['CARDIO'], record: false, ...overrides };
}

function build(overrides: Partial<MonthGridInput> = {}): MonthGrid {
  return buildMonthGrid({
    month: '2026-09',
    days: [],
    weighIns: new Set<string>(),
    referenceDate: '2026-09-27',
    firstSessionDate: '2026-08-03',
    ...overrides
  });
}

function cellOf(grid: MonthGrid, dateKey: string): MonthCell {
  const cell = grid.rows.flatMap((row) => row.cells).find((entry) => entry?.dateKey === dateKey);
  if (!cell) {
    throw new Error(`No cell for ${dateKey}`);
  }
  return cell;
}

describe('month grid', () => {
  it('starts the weeks on Monday, with blank cells before the first date and after the last', () => {
    // 1 September 2026 is a Tuesday and the 30th is a Wednesday.
    const grid = build();
    expect(grid.rows.length).toBe(5);
    expect(grid.rows[0].cells[0]).toBeNull();
    expect(grid.rows[0].cells[1]?.dateKey).toBe('2026-09-01');
    expect(grid.rows[4].cells[2]?.dateKey).toBe('2026-09-30');
    expect(grid.rows[4].cells.slice(3)).toEqual([null, null, null, null]);
    expect(grid.rows.every((row) => row.cells.length === 7)).toBeTrue();
  });

  it('uses cells of 45 px for five rows', () => {
    expect(build().cellHeight).toBe(CELL_HEIGHT_DEFAULT);
    expect(CELL_HEIGHT_DEFAULT).toBe(45);
  });

  it('uses cells of 36 px for a month of six rows', () => {
    // 1 August 2026 is a Saturday, so the 31 days run over six weeks.
    const grid = build({ month: '2026-08', referenceDate: '2026-09-27' });
    expect(grid.rows.length).toBe(6);
    expect(grid.cellHeight).toBe(CELL_HEIGHT_SIX_ROWS);
    expect(CELL_HEIGHT_SIX_ROWS).toBe(36);
  });

  it('keeps cells of 45 px for a February of four rows', () => {
    // February 2027 starts on a Monday and has 28 days.
    const grid = build({ month: '2027-02', referenceDate: '2027-03-05', firstSessionDate: '2026-08-03' });
    expect(grid.rows.length).toBe(4);
    expect(grid.cellHeight).toBe(45);
    expect(grid.rows.flatMap((row) => row.cells).every((cell) => cell !== null)).toBeTrue();
  });

  it('marks the row of the reference date as the current week', () => {
    const grid = build();
    expect(grid.rows.map((row) => row.current)).toEqual([false, false, false, true, false]);
    expect(grid.rows[3].cells.some((cell) => cell?.dateKey === '2026-09-27')).toBeTrue();
  });

  it('marks no row as current when the reference date is in another month', () => {
    const grid = build({ referenceDate: '2026-10-01' });
    expect(grid.rows.some((row) => row.current)).toBeFalse();
  });

  it('draws a listed training day as trained, with its kind, minutes and record', () => {
    const grid = build({ days: [day('2026-09-03', { record: true })] });
    const cell = cellOf(grid, '2026-09-03');
    expect(cell.state).toBe('trained');
    expect(cell.kind).toBe('CARDIO');
    expect(cell.minutes).toBe(35);
    expect(cell.record).toBeTrue();
  });

  it('leaves a listed day that is not a training kind as an ordinary day', () => {
    const grid = build({ days: [day('2026-09-03', { kind: 'OPEN' })] });
    expect(cellOf(grid, '2026-09-03').state).toBe('empty');
  });

  it('blanks the dates before the first session and reports that the legend needs its item', () => {
    const grid = build({ firstSessionDate: '2026-09-13' });
    expect(cellOf(grid, '2026-09-12').state).toBe('before');
    expect(cellOf(grid, '2026-09-13').state).toBe('empty');
    expect(grid.hasBefore).toBeTrue();
  });

  it('does not report dates before the first session for a month after it', () => {
    expect(build().hasBefore).toBeFalse();
    expect(build({ firstSessionDate: null }).hasBefore).toBeFalse();
  });

  it('draws the dates after the reference date as future and the date itself as today', () => {
    const grid = build();
    expect(cellOf(grid, '2026-09-26').state).toBe('empty');
    expect(cellOf(grid, '2026-09-27').today).toBeTrue();
    expect(cellOf(grid, '2026-09-27').state).toBe('empty');
    expect(cellOf(grid, '2026-09-28').state).toBe('future');
    expect(cellOf(grid, '2026-09-26').today).toBeFalse();
  });

  it('draws every date of a past month as past', () => {
    const grid = build({ month: '2026-08', referenceDate: '2026-09-27' });
    expect(grid.rows.flatMap((row) => row.cells).filter((cell) => cell?.state === 'future').length).toBe(0);
  });

  it('keeps a trained day trained when it is today', () => {
    const grid = build({ days: [day('2026-09-27')] });
    const cell = cellOf(grid, '2026-09-27');
    expect(cell.state).toBe('trained');
    expect(cell.today).toBeTrue();
  });

  it('carries the weigh-ins into the cells that have one', () => {
    const grid = build({ weighIns: new Set(['2026-09-05', '2026-09-20']) });
    expect(cellOf(grid, '2026-09-05').weighIn).toBeTrue();
    expect(cellOf(grid, '2026-09-06').weighIn).toBeFalse();
  });

  describe('accessible names', () => {
    it('names a training day with its kind, minutes and record', () => {
      const grid = build({ days: [day('2026-09-03', { record: true })] });
      expect(cellOf(grid, '2026-09-03').ariaLabel).toBe('Thursday 3 September, cardio, 35 min, record');
    });

    it('names an empty day', () => {
      expect(cellOf(build(), '2026-09-04').ariaLabel).toBe('Friday 4 September, nothing logged');
    });

    it('names today, a future day, a day before joining and a weigh-in', () => {
      const grid = build({ firstSessionDate: '2026-09-13', weighIns: new Set(['2026-09-27']) });
      expect(cellOf(grid, '2026-09-27').ariaLabel).toBe('Sunday 27 September, today, nothing logged, weigh-in');
      expect(cellOf(grid, '2026-09-29').ariaLabel).toBe('Tuesday 29 September, upcoming');
      expect(cellOf(grid, '2026-09-02').ariaLabel).toBe('Wednesday 2 September, before you joined');
    });

    it('leaves the minutes out when none were recorded', () => {
      const grid = build({ days: [day('2026-09-03', { minutes: 0 })] });
      expect(cellOf(grid, '2026-09-03').ariaLabel).toBe('Thursday 3 September, cardio');
    });
  });

  describe('date helpers', () => {
    it('counts the days of a month', () => {
      expect(daysInMonth('2026-09')).toBe(30);
      expect(daysInMonth('2026-02')).toBe(28);
      expect(daysInMonth('2028-02')).toBe(29);
    });

    it('moves between months across a year', () => {
      expect(shiftMonth('2026-01', -1)).toBe('2025-12');
      expect(shiftMonth('2026-12', 1)).toBe('2027-01');
      expect(monthOfDate('2026-09-27')).toBe('2026-09');
    });

    it('writes the title, the dates and the weekday index', () => {
      expect(monthTitle('2026-09')).toBe('September 2026');
      expect(describeDate('2026-09-03')).toBe('Thursday 3 September');
      expect(shortDate('2026-08-03')).toBe('3 Aug');
      expect(shortDate('2026-09-03')).toBe('3 Sept');
      expect(weekdayIndex('2026-09-07')).toBe(0);
      expect(weekdayIndex('2026-09-13')).toBe(6);
    });

    it('reads an instant as the date on the clock of the timezone', () => {
      expect(dateKeyInTimezone('2026-09-26T17:30:00Z', 'Asia/Singapore')).toBe('2026-09-27');
      expect(dateKeyInTimezone('2026-09-26T17:30:00Z', 'UTC')).toBe('2026-09-26');
      expect(dateKeyInTimezone('2026-09-26T17:30:00Z', 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dateKeyInTimezone('nonsense', 'UTC')).toBeNull();
      expect(dateKeyInTimezone(null, 'UTC')).toBeNull();
    });
  });
});
