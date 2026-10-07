import { nutrientsDays } from './food-nutrients-range';

describe('nutrientsDays', () => {
  it('reads 30 days at 4 weeks and 90 days at 3 months, with no caption', () => {
    expect(nutrientsDays('4w')).toEqual({ days: 30, caption: null });
    expect(nutrientsDays('3m')).toEqual({ days: 90, caption: null });
  });

  it('reads the last 90 days at 1 year and says so', () => {
    expect(nutrientsDays('1y')).toEqual({ days: 90, caption: 'Last 3 months' });
  });
});
