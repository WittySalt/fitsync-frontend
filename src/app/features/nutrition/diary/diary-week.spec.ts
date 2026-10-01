import { dayTiles, weekDots, weekFigures } from './diary-week';
import { rangeDay } from './diary-testing';
import { weekOf } from './diary-time';

const TODAY = '2026-10-02'; // a Friday
const DATES = weekOf(TODAY);

describe('dayTiles', () => {
  it('gives seven tiles Monday first and marks past, today and future', () => {
    const tiles = dayTiles([], DATES, TODAY, 2100);
    expect(tiles.map((tile) => tile.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(tiles.map((tile) => tile.state)).toEqual(['past', 'past', 'past', 'past', 'today', 'future', 'future']);
    expect(tiles.every((tile) => !tile.logged && tile.fill === 0)).toBeTrue();
  });

  it('fills a tile by calories over target, capped at full, with the kcal as caption', () => {
    const tiles = dayTiles(
      [rangeDay('2026-09-28', { totalCalories: 1050 }), rangeDay('2026-09-29', { totalCalories: 2800 })],
      DATES,
      TODAY,
      2100
    );
    expect(tiles[0].fill).toBeCloseTo(0.5);
    expect(tiles[0].caption).toBe('1,050');
    expect(tiles[1].fill).toBe(1);
  });

  it('says Today for today and nothing for a future day, and uses the fallback target when the day has none', () => {
    const tiles = dayTiles([rangeDay(TODAY, { totalCalories: 1050, targetCalories: null })], DATES, TODAY, 2100);
    expect(tiles[4].caption).toBe('Today');
    expect(tiles[4].fill).toBeCloseTo(0.5);
    expect(tiles[5].caption).toBe('');
  });

  it('judges only past logged days against a tenth either side of the target', () => {
    const tiles = dayTiles(
      [
        rangeDay('2026-09-28', { totalCalories: 2050 }),
        rangeDay('2026-09-29', { totalCalories: 1700 }),
        rangeDay('2026-09-30', { totalCalories: 2400 }),
        rangeDay(TODAY, { totalCalories: 2100 })
      ],
      DATES,
      TODAY,
      null
    );
    expect(tiles.map((tile) => tile.onTarget)).toEqual([true, false, false, false, false, false, false]);
  });

  it('leaves a tile empty when there is no target to fill against', () => {
    const tiles = dayTiles([rangeDay('2026-09-28', { targetCalories: null })], DATES, TODAY, null);
    expect(tiles[0].fill).toBe(0);
    expect(tiles[0].onTarget).toBeFalse();
  });
});

describe('weekFigures', () => {
  it('counts logged days among the past days and averages them, leaving today out', () => {
    const days = [
      rangeDay('2026-09-28', { totalCalories: 2050 }),
      rangeDay('2026-09-29', { totalCalories: 1980 }),
      rangeDay('2026-09-30', { totalCalories: 2280 }),
      rangeDay('2026-10-01', { totalCalories: 1720 }),
      rangeDay(TODAY, { totalCalories: 900 })
    ];
    const figures = weekFigures(dayTiles(days, DATES, TODAY, 2100));
    expect(figures.daysLogged).toBe('4 of 4');
    expect(figures.onTarget).toBe(3);
    expect(figures.kcalPerDay).toBe(2008);
  });

  it('has no average before any past day was logged', () => {
    const figures = weekFigures(dayTiles([], DATES, TODAY, 2100));
    expect(figures.daysLogged).toBe('0 of 4');
    expect(figures.kcalPerDay).toBeNull();
  });
});

describe('weekDots', () => {
  const days = [
    rangeDay('2026-09-28', { fiberMet: true, sugarWithin: false }),
    rangeDay('2026-09-29', { fiberMet: false, sugarWithin: true }),
    rangeDay('2026-09-30', { logged: false, fiberMet: null }),
    rangeDay(TODAY, { fiberMet: true })
  ];

  it('is true on target, false missed, null for an unlogged day, today and days ahead', () => {
    expect(weekDots(days, DATES, TODAY, 'FIBER')).toEqual([true, false, null, null, null, null, null]);
    expect(weekDots(days, DATES, TODAY, 'SUGAR')).toEqual([false, true, null, null, null, null, null]);
  });

  it('gives no dots for a code it does not know', () => {
    expect(weekDots(days, DATES, TODAY, 'IRON')).toEqual([]);
  });

  it('keeps null when the flag itself is missing', () => {
    expect(weekDots([rangeDay('2026-09-28', { potassiumMet: null })], DATES, TODAY, 'POTASSIUM')[0]).toBeNull();
  });
});
