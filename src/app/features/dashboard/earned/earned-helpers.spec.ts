import { BADGES, TODAY } from '../../../core/me-fixtures.spec';
import { BadgesModel } from '../../../core/me.models';
import { allBadges, comparisonLine, earnedThisWeek, stripView } from './earned-helpers';

describe('earned helpers', () => {
  describe('comparisonLine', () => {
    it('reports more, less and the same in whole percent', () => {
      expect(comparisonLine(170, 120)).toBe('42% more than by this day last week');
      expect(comparisonLine(100, 120)).toBe('');
      expect(comparisonLine(120, 120)).toBe('the same as by this day last week');
    });

    it('calls a change that rounds to zero the same', () => {
      expect(comparisonLine(1001, 1000)).toBe('the same as by this day last week');
    });

    it('says nothing when last week was empty', () => {
      expect(comparisonLine(170, 0)).toBe('');
      expect(comparisonLine(170, null)).toBe('');
    });

    it('says nothing when this week is empty', () => {
      expect(comparisonLine(0, 120)).toBe('');
      expect(comparisonLine(null, 120)).toBe('');
    });
  });

  describe('the strip', () => {
    it('lists the seventeen badges of the catalogue', () => {
      expect(allBadges(BADGES).length).toBe(17);
    });

    it('says nothing new when nothing was earned since Monday', () => {
      // Tuesday 6 Oct: the week began on 5 Oct, and the newest badge is the first cook of 2 Oct.
      expect(earnedThisWeek(BADGES, TODAY)).toEqual([]);
      expect(stripView(BADGES, TODAY)).toEqual({ badge: null, title: 'No new badges this week', note: '7 of 17 earned' });
    });

    it('shows the badge earned this week', () => {
      const strip = stripView(BADGES, '2026-10-02');
      expect(strip.badge?.code).toBe('FIRST_COOK');
      expect(strip.title).toBe('First cook');
    });

    it('counts the others when more than one was earned', () => {
      // The week of Monday 21 Sept holds the full week of 27 Sept; add a second one on the same Sunday.
      const model: BadgesModel = {
        ...BADGES,
        themes: BADGES.themes.map((theme, index) =>
          index === 0 ? theme : { ...theme, paths: theme.paths.map((path) => ({ nodes: path.nodes.map((entry) => (entry.code === 'FIRST_RECORD' ? { ...entry, earnedOn: '2026-09-23' } : entry)) })) }
        )
      };
      const strip = stripView(model, '2026-09-27');
      expect(strip.badge?.code).toBe('FULL_WEEK');
      expect(strip.title).toBe('A full week and 1 more');
    });

    it('does not count a badge dated after today', () => {
      expect(earnedThisWeek(BADGES, '2026-09-26').map((entry) => entry.code)).not.toContain('FULL_WEEK');
    });
  });
});
