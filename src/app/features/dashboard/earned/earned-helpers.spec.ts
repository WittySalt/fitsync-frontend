import { AnalyticsAchievement } from '../../../core/analytics.models';
import { DAY_KIND_GLYPHS } from '../brief/day-kind-icons';
import { comparisonLine, countLine, earnedDateLabel, glyphFor, orderBadges, RING_RADIUS, ringArc, toBadgeViews } from './earned-helpers';

function badge(code: string, progress: number, unlockedAt: string | null = null): AnalyticsAchievement {
  return { code, title: code, unlocked: unlockedAt !== null, unlockedAt, progress: unlockedAt ? 1 : progress };
}

describe('earned helpers', () => {
  describe('orderBadges', () => {
    it('puts earned badges first, newest first, then the others by progress', () => {
      const ordered = orderBadges([
        badge('STREAK_7', 0.43),
        badge('FIRST_WORKOUT', 1, '2026-08-01T00:00:00Z'),
        badge('WORKOUTS_10', 0.8),
        badge('FIRST_MEAL_LOGGED', 1, '2026-08-20T00:00:00Z'),
        badge('PR_FIRST', 0)
      ]);

      expect(ordered.map((entry) => entry.code)).toEqual([
        'FIRST_MEAL_LOGGED',
        'FIRST_WORKOUT',
        'WORKOUTS_10',
        'STREAK_7',
        'PR_FIRST'
      ]);
    });

    it('keeps the server order for ties', () => {
      const ordered = orderBadges([badge('B', 0.5), badge('A', 0.5), badge('C', 0.5)]);
      expect(ordered.map((entry) => entry.code)).toEqual(['B', 'A', 'C']);

      const earned = orderBadges([
        badge('X', 1, '2026-08-01T00:00:00Z'),
        badge('Y', 1, '2026-08-01T00:00:00Z')
      ]);
      expect(earned.map((entry) => entry.code)).toEqual(['X', 'Y']);
    });

    it('places an earned badge without a readable date after the dated ones', () => {
      const undated: AnalyticsAchievement = { code: 'U', title: 'U', unlocked: true, unlockedAt: null, progress: 1 };
      const ordered = orderBadges([undated, badge('D', 1, '2026-08-01T00:00:00Z')]);
      expect(ordered.map((entry) => entry.code)).toEqual(['D', 'U']);
    });

    it('does not change the list it was given', () => {
      const input = [badge('B', 0.1), badge('A', 0.9)];
      orderBadges(input);
      expect(input.map((entry) => entry.code)).toEqual(['B', 'A']);
    });
  });

  describe('countLine', () => {
    it('writes the workout counts from the progress', () => {
      expect(countLine('WORKOUTS_50', 0.66)).toBe('33 of 50');
      expect(countLine('WORKOUTS_10', 0.8)).toBe('8 of 10');
      expect(countLine('WORKOUTS_100', 0.08)).toBe('8 of 100');
    });

    it('writes the streaks in days', () => {
      expect(countLine('STREAK_7', 2 / 7)).toBe('2 of 7 days');
      expect(countLine('STREAK_30', 0.1)).toBe('3 of 30 days');
    });

    it('says Not yet for the first-time badges, the record badge and unknown codes', () => {
      for (const code of ['FIRST_WORKOUT', 'FIRST_MEAL_LOGGED', 'FIRST_WEIGHT_LOGGED', 'PR_FIRST', 'SOMETHING_NEW']) {
        expect(countLine(code, 0)).toBe('Not yet');
      }
    });

    it('never prints NaN for a progress that is not a number', () => {
      expect(countLine('WORKOUTS_50', Number.NaN)).toBe('0 of 50');
    });
  });

  describe('ringArc', () => {
    const circumference = 2 * Math.PI * RING_RADIUS;

    it('draws nothing at 0', () => {
      expect(ringArc(0).length).toBe(0);
    });

    it('draws half the circle at 0.5', () => {
      const arc = ringArc(0.5);
      expect(arc.circumference).toBeCloseTo(circumference, 6);
      expect(arc.length).toBeCloseTo(circumference / 2, 6);
    });

    it('draws the whole circle at 1 and never more', () => {
      expect(ringArc(1).length).toBeCloseTo(circumference, 6);
      expect(ringArc(3).length).toBeCloseTo(circumference, 6);
      expect(ringArc(-1).length).toBe(0);
      expect(ringArc(Number.NaN).length).toBe(0);
    });

    it('follows the radius it is given', () => {
      expect(ringArc(1, 10).circumference).toBeCloseTo(2 * Math.PI * 10, 6);
    });
  });

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

  describe('earnedDateLabel', () => {
    it('reads the instant in the given timezone and writes Sept for September', () => {
      expect(earnedDateLabel('2026-08-20T03:00:00Z', 'Asia/Singapore')).toBe('20 Aug');
      expect(earnedDateLabel('2026-09-24T18:30:00Z', 'Asia/Singapore')).toBe('25 Sept');
      expect(earnedDateLabel('2026-09-24T18:30:00Z', 'UTC')).toBe('24 Sept');
    });

    it('is empty for a missing or unreadable instant and survives an unknown timezone', () => {
      expect(earnedDateLabel(null, 'UTC')).toBe('');
      expect(earnedDateLabel('not a date', 'UTC')).toBe('');
      expect(earnedDateLabel('2026-08-20T03:00:00Z', 'Not/AZone')).toBe('20 Aug');
    });
  });

  describe('toBadgeViews', () => {
    it('builds the accessible names from the state', () => {
      const views = toBadgeViews(
        [
          { code: 'WORKOUTS_10', title: '10 workouts', unlocked: true, unlockedAt: '2026-08-20T03:00:00Z', progress: 1 },
          { code: 'WORKOUTS_50', title: '50 workouts', unlocked: false, unlockedAt: null, progress: 0.66 },
          { code: 'PR_FIRST', title: 'First record', unlocked: false, unlockedAt: null, progress: 0 }
        ],
        'Asia/Singapore'
      );

      expect(views.map((view) => view.accessibleName)).toEqual([
        '10 workouts, earned 20 Aug',
        '50 workouts, 33 of 50',
        'First record, not yet'
      ]);
    });

    it('gives an unknown code a plain star, its server title and Not yet', () => {
      const [view] = toBadgeViews([{ code: 'NEW_ONE', title: 'Brand new', unlocked: false, unlockedAt: null, progress: 0 }], 'UTC');

      expect(view.title).toBe('Brand new');
      expect(view.countLabel).toBe('Not yet');
      expect(view.glyph).toBe(glyphFor('NEW_ONE'));
      expect(view.glyph.length).toBe(1);
    });

    it('uses the same dumbbell for the four workout counts and a different glyph for each other kind', () => {
      const workout = DAY_KIND_GLYPHS.STRENGTH;
      for (const code of ['FIRST_WORKOUT', 'WORKOUTS_10', 'WORKOUTS_50', 'WORKOUTS_100']) {
        expect(glyphFor(code)).toBe(workout);
      }
      const others = ['STREAK_7', 'FIRST_MEAL_LOGGED', 'FIRST_WEIGHT_LOGGED', 'PR_FIRST'].map((code) => glyphFor(code));
      expect(glyphFor('STREAK_30')).toBe(glyphFor('STREAK_7'));
      expect(new Set([workout, ...others]).size).toBe(5);
    });

    it('draws a full ring for an earned badge', () => {
      const [view] = toBadgeViews([badge('FIRST_WORKOUT', 1, '2026-08-01T00:00:00Z')], 'UTC');
      expect(view.ring.length).toBeCloseTo(view.ring.circumference, 6);
    });
  });
});
