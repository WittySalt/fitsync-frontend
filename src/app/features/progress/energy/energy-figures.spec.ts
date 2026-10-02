import {
  DIAL_LIMIT,
  barsSummary,
  dayColumns,
  daysSummary,
  dialAngle,
  dialGeometry,
  dialSummary,
  energyBars,
  headline,
  kgText,
  logVsScale,
  runningChart,
  runningSummary,
  shiftWeek,
  signedKcal,
  subLine,
  thisMonday,
  usedOf,
  verticalScale,
  weekLabel,
  weeksChart,
  weeksSummary
} from './energy-figures';
import { energyWeek } from './energy-testing.spec';

describe('energy figures', () => {
  describe('the dial angle', () => {
    it('puts 1,000 under at the left end, even at the top and 1,000 over at the right end', () => {
      expect(dialAngle(-DIAL_LIMIT)).toBeCloseTo(Math.PI);
      expect(dialAngle(0)).toBeCloseTo(1.5 * Math.PI);
      expect(dialAngle(DIAL_LIMIT)).toBeCloseTo(2 * Math.PI);
    });

    it('moves the needle left of the top for under and right of it for over', () => {
      expect(dialAngle(-241)).toBeLessThan(1.5 * Math.PI);
      expect(dialAngle(-241)).toBeCloseTo(Math.PI + (Math.PI * 759) / 2000);
      expect(dialAngle(312)).toBeGreaterThan(1.5 * Math.PI);
    });

    it('stops at either end past 1,000', () => {
      expect(dialAngle(-5000)).toBeCloseTo(Math.PI);
      expect(dialAngle(5000)).toBeCloseTo(2 * Math.PI);
    });

    it('draws the needle straight up at even and fills nothing at the far left', () => {
      const even = dialGeometry(210, 0);
      expect(even.needle.x).toBeCloseTo(even.cx);
      expect(even.needle.y).toBeLessThan(even.cy);
      expect(dialGeometry(210, -1000).value).toBe('');
      expect(dialGeometry(210, -241).value).toContain('A');
    });

    it('has a text for screen readers', () => {
      expect(dialSummary(-241)).toBe('The daily average is 241 kcal under, on a dial from 1,000 under to 1,000 over.');
      expect(dialSummary(0)).toBe('The daily average is even.');
    });
  });

  describe('the big number', () => {
    it('reads under and over in the same way', () => {
      expect(headline(-241)).toEqual({ value: '241', unit: 'kcal a day under', direction: 'under' });
      expect(headline(312)).toEqual({ value: '312', unit: 'kcal a day over', direction: 'over' });
    });

    it('rounds, separates thousands and calls a rounded zero even', () => {
      expect(headline(-1234.6).value).toBe('1,235');
      expect(headline(0.3)).toEqual({ value: '0', unit: 'kcal a day, even', direction: 'even' });
    });

    it('writes the sub line', () => {
      expect(subLine(energyWeek())).toBe('about 0.22 kg a week · food logged on 5 of 7 days');
      expect(subLine(energyWeek({ weeklyKgEquivalent: null, daysLogged: 3 }))).toBe('food logged on 3 of 7 days');
      expect(subLine(energyWeek({ weeklyKgEquivalent: 0.31 }))).toContain('about 0.31 kg a week');
    });
  });

  describe('weeks', () => {
    it('labels a week and steps by whole weeks', () => {
      expect(weekLabel('2026-09-28', '2026-10-04')).toMatch(/^28 Sep(t)? to 4 Oct$/);
      expect(shiftWeek('2026-09-28', -1)).toBe('2026-09-21');
      expect(shiftWeek('2026-09-28', 1)).toBe('2026-10-05');
    });

    it('finds the Monday of this week', () => {
      expect(thisMonday('2026-10-02')).toBe('2026-09-28');
      expect(thisMonday('2026-09-28')).toBe('2026-09-28');
      expect(thisMonday('2026-10-04')).toBe('2026-09-28');
    });

    it('signs a kcal figure', () => {
      expect(signedKcal(-438)).toBe('−438');
      expect(signedKcal(12)).toBe('+12');
      expect(signedKcal(0)).toBe('0');
      expect(signedKcal(-1205)).toBe('−1,205');
    });
  });

  describe('the two bars', () => {
    it('puts both bars on one scale with the longer at full width', () => {
      const bars = energyBars(energyWeek());
      expect(bars?.usedTotal).toBe(2364);
      const used = bars?.used.reduce((sum, part) => sum + part.percent, 0) ?? 0;
      expect(used).toBeCloseTo(((1968 + 396) / 2364) * 100);
      const eaten = bars?.eaten.reduce((sum, part) => sum + part.percent, 0) ?? 0;
      expect(eaten).toBeCloseTo((2123 / 2364) * 100);
    });

    it('splits what was eaten by meal and what was used into resting and workouts', () => {
      const bars = energyBars(energyWeek());
      expect(bars?.eaten.map((part) => part.label)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);
      expect(bars?.used.map((part) => part.label)).toEqual(['Resting × 1.2', 'Workouts']);
    });

    it('adds an Other segment only when meals without a type are above zero', () => {
      const split = { breakfast: 480, lunch: 690, dinner: 760, snack: 193 };
      expect(energyBars(energyWeek({ mealSplit: { ...split, other: 0 } }))?.eaten.map((part) => part.key)).not.toContain('other');
      const withOther = energyBars(energyWeek({ mealSplit: { ...split, other: 120 } }));
      expect(withOther?.eaten.map((part) => part.label)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Other']);
    });

    it('names a segment inside it only when it has room', () => {
      const bars = energyBars(energyWeek());
      expect(bars?.eaten.find((part) => part.key === 'breakfast')?.showLabel).toBeTrue();
      expect(bars?.eaten.find((part) => part.key === 'snack')?.showLabel).toBeFalse();
    });

    it('brackets the gap and says under when more was used than eaten', () => {
      const bars = energyBars(energyWeek());
      expect(bars?.bracket?.label).toBe('241 under');
      expect(bars?.bracket?.left).toBeCloseTo((2123 / 2364) * 100);
      expect(bars?.bracket?.width).toBeCloseTo((241 / 2364) * 100);
    });

    it('says over when more was eaten than used', () => {
      const over = energyWeek({ average: { eaten: 2400, resting: 1968, workouts: 120, used: 2088, balance: 312 } });
      const bars = energyBars(over);
      expect(bars?.bracket?.label).toBe('312 over');
      expect(bars?.bracket?.left).toBeCloseTo((2088 / 2400) * 100);
    });

    it('has no bracket when the bars match, and draws one bar for the whole when there is no split by meal', () => {
      expect(energyBars(energyWeek({ average: { eaten: 2000, resting: 1800, workouts: 200, used: 2000, balance: 0 } }))?.bracket).toBeNull();
      expect(energyBars(energyWeek({ mealSplit: null }))?.eaten.map((part) => part.key)).toEqual(['eaten']);
    });

    it('draws nothing without an average', () => {
      expect(energyBars(energyWeek({ average: null }))).toBeNull();
    });

    it('has a text summary', () => {
      expect(barsSummary(energyBars(energyWeek())!)).toBe('Eaten 2,123 kcal a day, used 2,364 kcal a day, 241 under.');
    });
  });

  describe('each day', () => {
    const columns = () => dayColumns(energyWeek());

    it('has a column for each day, Monday first, with the balance under it', () => {
      const result = columns().columns;
      expect(result.length).toBe(7);
      expect(result[0].label).toBe('Mon');
      expect(result[0].note).toBe('−438');
      expect(result[1].note).toBe('+12');
    });

    it('draws an unlogged day as an empty shadow that says it was not logged', () => {
      const thursday = columns().columns[3];
      expect(thursday.logged).toBeFalse();
      expect(thursday.eaten).toBeNull();
      expect(thursday.note).toBe('not logged');
      expect(thursday.shadow).toBeGreaterThan(0);
    });

    it('draws what was eaten inside what was used', () => {
      const tuesday = columns().columns[1];
      expect(tuesday.eaten).not.toBeNull();
      expect(tuesday.eaten!).toBeLessThanOrEqual(tuesday.shadow + 1);
    });

    it('marks the day with estimated workout calories', () => {
      expect(columns().columns.filter((column) => column.estimated).map((column) => column.label)).toEqual(['Fri']);
    });

    it('scales to the biggest day in steps of 500 with a gridline at each 1,000', () => {
      expect(columns().top).toBe(3000);
      expect(columns().grid.map((line) => line.kcal)).toEqual([1000, 2000, 3000]);
    });

    it('uses the resting figure of the week for a day the server sent none for', () => {
      const week = energyWeek();
      expect(usedOf({ ...week.days[0], resting: null, workouts: 100 }, week)).toBeCloseTo(1640 * 1.2 + 100);
      expect(usedOf({ ...week.days[0], resting: null, workouts: null }, energyWeek({ bmrKcal: null }))).toBe(0);
    });

    it('has a text summary', () => {
      expect(daysSummary(columns().columns)).toContain('food logged on 5 of 7 days');
      expect(daysSummary(columns().columns)).toContain('Thu not logged');
    });
  });

  describe('adding up', () => {
    const chart = () => runningChart(energyWeek(), 600, 170);

    it('starts at zero and runs through the seven days', () => {
      expect(chart().points.length).toBe(8);
      expect(chart().points[0].value).toBe(0);
      expect(chart().points[0].y).toBeCloseTo(chart().zeroY);
    });

    it('adds up only the logged days and keeps the total flat across an unlogged one', () => {
      const values = chart().points.map((point) => point.value);
      expect(values).toEqual([0, -438, -426, -544, -544, -842, -842, -1205]);
    });

    it('draws an unlogged day as a hollow dot', () => {
      expect(chart().points.map((point) => point.logged)).toEqual([true, true, true, true, false, true, false, true]);
    });

    it('goes down for under and ends with the total in words', () => {
      expect(chart().points[7].y).toBeGreaterThan(chart().zeroY);
      expect(chart().end?.text).toBe('−1,205 kcal');
    });

    it('goes up for over', () => {
      const over = energyWeek({ days: energyWeek().days.map((day) => (day.logged ? { ...day, runningTotal: 300 } : day)) });
      const result = runningChart(over, 600, 170);
      expect(result.points[7].y).toBeLessThan(result.zeroY);
    });

    it('has no end label and a flat line when nothing was logged', () => {
      const empty = energyWeek({ days: energyWeek().days.map((day) => ({ ...day, logged: false, eaten: null, balance: null, runningTotal: null })) });
      const result = runningChart(empty, 600, 170);
      expect(result.end).toBeNull();
      expect(new Set(result.points.map((point) => point.value))).toEqual(new Set([0]));
      expect(runningSummary(result, empty)).toBe('Running total of the week, no food logged yet.');
    });

    it('has a text summary', () => {
      expect(runningSummary(chart(), energyWeek())).toContain('−1,205 kcal after 5 logged days');
    });

    it('keeps zero inside a vertical scale', () => {
      const y = verticalScale([-100, -50], 100, 10, 10);
      expect(y(0)).toBeCloseTo(10);
      expect(y(-100)).toBeCloseTo(90);
      expect(verticalScale([], 100, 0, 0)(0)).toBeCloseTo(50);
    });
  });

  describe('the last 8 weeks', () => {
    const chart = () => weeksChart(energyWeek().weeks, 600, 110);

    it('draws the food log as one dashed line with a dot a week', () => {
      expect(chart().expected.startsWith('M')).toBeTrue();
      expect(chart().expectedDots.length).toBe(8);
    });

    it('breaks the scale line at a week without a weigh-in instead of dropping to zero', () => {
      expect(chart().actual.length).toBe(2);
      expect(chart().actualDots.length).toBe(1);
    });

    it('draws no scale line when there is no weigh-in', () => {
      const weeks = energyWeek().weeks.map((week) => ({ ...week, actualKgChange: null }));
      expect(weeksChart(weeks, 600, 110).actual).toEqual([]);
      expect(weeksChart(weeks, 600, 110).actualDots).toEqual([]);
    });

    it('reads the newest figures of each for "Log says x kg, scale says y kg"', () => {
      expect(logVsScale(energyWeek().weeks)).toEqual({ log: '−1.9 kg', scale: '−3.0 kg' });
    });

    it('uses the newest weigh-in when the last week has none', () => {
      const weeks = energyWeek().weeks.map((week, index) => (index === 7 ? { ...week, actualKgChange: null } : week));
      expect(logVsScale(weeks)?.scale).toBe('−2.6 kg');
    });

    it('says what is missing', () => {
      const noScale = energyWeek().weeks.map((week) => ({ ...week, actualKgChange: null }));
      expect(logVsScale(noScale)?.scale).toBeNull();
      expect(weeksSummary(logVsScale(noScale))).toContain('scale says nothing yet');
      expect(logVsScale([])).toBeNull();
      expect(weeksSummary(null)).toBe('The last 8 weeks: no food log or weigh-ins yet.');
    });

    it('signs kilograms', () => {
      expect(kgText(-1.85)).toBe('−1.9 kg');
      expect(kgText(0.4)).toBe('+0.4 kg');
      expect(kgText(0.04)).toBe('0.0 kg');
    });
  });
});
