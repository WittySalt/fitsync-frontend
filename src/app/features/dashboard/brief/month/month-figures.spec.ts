import { badgesInMonth, buildFigures, fullWeeks, headLine, headTitle, MonthFigure } from './month-figures';
import { monthInsight, septemberInsight } from './month-fixtures.spec';

function figureOf(figures: MonthFigure[], id: MonthFigure['id']): MonthFigure {
  const found = figures.find((figure) => figure.id === id);
  if (!found) {
    throw new Error(`No ${id} figure`);
  }
  return found;
}

function shown(figure: MonthFigure): string {
  return figure.parts.map((part) => (part.unit ? `${part.value} ${part.unit}` : part.value)).join(' ');
}

describe('month figures', () => {
  const badgeDates = ['2026-08-10', '2026-08-20', '2026-08-28', '2026-09-02', '2026-09-15'];

  it('works out the six figures of September against August', () => {
    const figures = buildFigures({ insight: septemberInsight(), weeklyTarget: 4, badgeDates, badgeState: 'ready' });

    expect(figures.map((figure) => figure.id)).toEqual(['sessions', 'time', 'weeks', 'records', 'badges', 'streak']);
    expect(figures.map((figure) => `${shown(figure)} ${figure.caption}`)).toEqual([
      '17 sessions',
      '13 h 35 min trained',
      '3 of 3 full weeks on goal',
      '6 personal records',
      '2 badges earned',
      '3 days longest streak'
    ]);
  });

  it('counts a full week as one that lies inside the month and is over', () => {
    const full = fullWeeks(septemberInsight());
    expect(full.map((week) => week.weekStart)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
  });

  it('counts the weeks that reached the weekly target', () => {
    const insight = septemberInsight();
    insight.weeks[2] = { ...insight.weeks[2], sessions: 3 };
    const weeks = figureOf(buildFigures({ insight, weeklyTarget: 4, badgeDates, badgeState: 'ready' }), 'weeks');
    expect(shown(weeks)).toBe('2 of 3');
    expect(weeks.label).toBe('2 of 3 full weeks on goal');
    expect(weeks.compare).toBeNull();
  });

  it('shows the weeks trained when there is no weekly target', () => {
    const insight = septemberInsight();
    insight.weeks[1] = { ...insight.weeks[1], sessions: 0 };
    const weeks = figureOf(buildFigures({ insight, weeklyTarget: null, badgeDates, badgeState: 'ready' }), 'weeks');
    expect(shown(weeks)).toBe('2');
    expect(weeks.caption).toBe('weeks trained');
  });

  it('shows a dash for the weeks while the month holds no full week', () => {
    const insight = monthInsight({ weeks: [] });
    const weeks = figureOf(buildFigures({ insight, weeklyTarget: 4, badgeDates: [], badgeState: 'ready' }), 'weeks');
    expect(shown(weeks)).toBe('–');
  });

  it('adds an arrow and the difference to the figures of a past month', () => {
    const insight = septemberInsight({
      referenceDate: '2026-10-05',
      totals: { sessions: 17, minutes: 815, records: 4, longestStreakDays: 3 },
      previousTotals: { sessions: 15, minutes: 900, records: 6, longestStreakDays: 3 }
    });
    const figures = buildFigures({ insight, weeklyTarget: 4, badgeDates, badgeState: 'ready' });

    expect(figureOf(figures, 'sessions').compare).toEqual({ direction: 'up', text: '2' });
    expect(figureOf(figures, 'time').compare).toEqual({ direction: 'down', text: '1 h 25 min' });
    expect(figureOf(figures, 'records').compare).toEqual({ direction: 'down', text: '2' });
    // The same streak in both months carries no arrow, and the weeks and the badges carry none at all.
    expect(figureOf(figures, 'streak').compare).toBeNull();
    expect(figureOf(figures, 'weeks').compare).toBeNull();
    expect(figureOf(figures, 'badges').compare).toBeNull();
  });

  it('draws only the upward arrows while the month is still running', () => {
    const insight = septemberInsight({
      totals: { sessions: 17, minutes: 600, records: 4, longestStreakDays: 2 },
      previousTotals: { sessions: 15, minutes: 900, records: 6, longestStreakDays: 3 }
    });
    const figures = buildFigures({ insight, weeklyTarget: 4, badgeDates, badgeState: 'ready' });

    expect(figureOf(figures, 'sessions').compare).toEqual({ direction: 'up', text: '2' });
    expect(figureOf(figures, 'time').compare).toBeNull();
    expect(figureOf(figures, 'records').compare).toBeNull();
    expect(figureOf(figures, 'streak').compare).toBeNull();
    expect(figureOf(figures, 'time').label).toBe('10 h trained');
  });

  it('states last month in the accessible text where an arrow is drawn', () => {
    const figures = buildFigures({ insight: septemberInsight(), weeklyTarget: 4, badgeDates, badgeState: 'ready' });
    expect(figureOf(figures, 'sessions').label).toBe('17 sessions, 15 last month');
    expect(figureOf(figures, 'time').label).toBe('13 h 35 min trained, 12 h 15 min last month');
    expect(figureOf(figures, 'streak').label).toBe('Longest streak 3 days');
  });

  it('draws no arrow and no last month for the first month', () => {
    const insight = septemberInsight({ previousTotals: null });
    const figures = buildFigures({ insight, weeklyTarget: 4, badgeDates, badgeState: 'ready' });
    expect(figures.every((figure) => figure.compare === null)).toBeTrue();
    expect(figureOf(figures, 'sessions').label).toBe('17 sessions');
  });

  it('writes the singular for a count of one', () => {
    const insight = septemberInsight({ totals: { sessions: 1, minutes: 60, records: 1, longestStreakDays: 1 }, previousTotals: null });
    const figures = buildFigures({ insight, weeklyTarget: null, badgeDates: ['2026-09-02'], badgeState: 'ready' });
    expect(figures.map((figure) => `${shown(figure)} ${figure.caption}`)).toEqual([
      '1 session',
      '1 h trained',
      '3 weeks trained',
      '1 personal record',
      '1 badge earned',
      '1 day longest streak'
    ]);
  });

  it('shows zeros for an empty month', () => {
    const insight = monthInsight({ days: [], weeks: [], totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } });
    const figures = buildFigures({ insight, weeklyTarget: null, badgeDates: [], badgeState: 'ready' });
    expect(figures.map((figure) => shown(figure))).toEqual(['0', '0 min', '0', '0', '0', '0 days']);
  });

  it('puts a dash for the badges while they load and leaves the figure out when they failed', () => {
    const loading = buildFigures({ insight: septemberInsight(), weeklyTarget: 4, badgeDates: [], badgeState: 'loading' });
    expect(shown(figureOf(loading, 'badges'))).toBe('–');
    expect(figureOf(loading, 'badges').compare).toBeNull();

    const failed = buildFigures({ insight: septemberInsight(), weeklyTarget: 4, badgeDates: [], badgeState: 'failed' });
    expect(failed.map((figure) => figure.id)).toEqual(['sessions', 'time', 'weeks', 'records', 'streak']);
  });

  it('counts the badges of one month', () => {
    expect(badgesInMonth(badgeDates, '2026-08')).toBe(3);
    expect(badgesInMonth(badgeDates, '2026-09')).toBe(2);
    expect(badgesInMonth([], '2026-09')).toBe(0);
  });

  describe('head', () => {
    it('says so far for the month of the reference date and the plain name for a past month', () => {
      expect(headTitle('2026-09', '2026-09-27')).toBe('September so far');
      expect(headTitle('2026-08', '2026-09-27')).toBe('August');
    });

    it('names the month the person joined in, else the month the arrows compare with, else nothing', () => {
      expect(headLine('2026-09', '2026-09-13', false)).toBe('Since you joined on 13 September.');
      expect(headLine('2026-09', '2026-09-13', true)).toBe('Since you joined on 13 September.');
      expect(headLine('2026-09', '2026-08-03', true)).toBe('Arrows compare with August.');
      expect(headLine('2026-01', '2025-11-03', true)).toBe('Arrows compare with December.');
      expect(headLine('2026-08', '2026-08-03', false)).toBe('Since you joined on 3 August.');
      expect(headLine('2026-09', null, false)).toBeNull();
    });
  });
});
