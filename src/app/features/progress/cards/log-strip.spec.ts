import { logGeometry } from './training-figures';

describe('the 28-day log geometry', () => {
  const days = [
    { date: '2026-10-02', kind: 'STRENGTH' as const, minutes: 50, record: true, sessionId: null },
    { date: '2026-10-03', kind: 'SPORT' as const, minutes: 60, record: false, sessionId: null }
  ];

  it('lays four week rows of 7 tiles at the 300 px design width, the last row holding today', () => {
    const g = logGeometry('2026-10-03', days, 300);
    expect(g.cells.length).toBe(28);
    expect(g.pitch).toBe(36);
    expect(g.tile).toBe(32);
    expect(g.weeks.map((week) => week.label)).toEqual(['7 Sept', '14 Sept', '21 Sept', '28 Sept']);
    expect(g.initials.join('')).toBe('MTWTFSS');
  });

  it('marks trained days with their kind and day number, records, today and the days to come', () => {
    const g = logGeometry('2026-10-03', days, 300);
    const cell = (date: string) => g.cells.find((item) => item.date === date)!;
    expect(cell('2026-10-02')).toEqual(jasmine.objectContaining({ kind: 'STRENGTH', record: true, day: '2', today: false }));
    expect(cell('2026-10-03')).toEqual(jasmine.objectContaining({ kind: 'SPORT', today: true, day: '3' }));
    expect(cell('2026-10-01').kind).toBeNull();
    expect(cell('2026-10-04').future).toBeTrue();
    expect(cell('2026-10-03').future).toBeFalse();
  });
});
