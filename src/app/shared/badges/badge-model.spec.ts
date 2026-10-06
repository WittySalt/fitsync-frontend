import { BADGES, FOOTPRINT, TODAY, node } from '../../core/me-fixtures.spec';
import {
  PATH_SLOTS,
  daysToLog,
  doorFor,
  evidenceLine,
  gapLine,
  gapSentence,
  laterLine,
  lineEarnedSlots,
  nextUpLine,
  paceSentence,
  pathNodes,
  ringUnit,
  weekCells
} from './badge-model';

const paths = BADGES.themes.flatMap((theme) => theme.paths);
const byCode = (code: string) => paths.flatMap((path) => path.nodes).find((entry) => entry.code === code)!;

describe('badge model', () => {
  describe('node states', () => {
    it('marks earned, next and later along the first path of Showing up', () => {
      expect(pathNodes(paths[0]).map((entry) => [entry.node.code, entry.state])).toEqual([
        ['FIRST_WORKOUT', 'earned'],
        ['WORKOUTS_10', 'earned'],
        ['WORKOUTS_50', 'next'],
        ['WORKOUTS_100', 'later']
      ]);
    });

    it('keeps a second node that has not been started as later, as Protein month is', () => {
      const protein = paths.find((path) => path.nodes.some((entry) => entry.code === 'PROTEIN_MONTH'))!;
      expect(pathNodes(protein).map((entry) => entry.state)).toEqual(['earned', 'later']);
    });

    it('makes the first node next on a path nobody has begun', () => {
      const fresh = { nodes: [node('FIRST_COOK', 'First cook', 'IN_THE_KITCHEN', [0, 1, 'cooks']), node('TEN_COOKS', 'Ten cooks', 'IN_THE_KITCHEN', [0, 10, 'cooks'])] };
      expect(pathNodes(fresh).map((entry) => entry.state)).toEqual(['next', 'later']);
    });

    it('puts nodes on consecutive slots of a five-slot grid so every path lines up', () => {
      for (const path of paths) {
        const slots = pathNodes(path).map((entry) => entry.slot);
        expect(slots).toEqual(slots.map((_, index) => index));
        expect(slots.length).toBeLessThanOrEqual(PATH_SLOTS);
      }
    });

    it('draws the green line up to the last earned node', () => {
      expect(lineEarnedSlots(pathNodes(paths[0]))).toBe(1);
      expect(lineEarnedSlots(pathNodes({ nodes: [byCode('WORKOUTS_50')] }))).toBe(-1);
    });

    it('keeps a ring between 0 and 1 and full for an earned node', () => {
      expect(ringUnit(byCode('WORKOUTS_50'))).toBeCloseTo(0.62, 2);
      expect(ringUnit(byCode('FIRST_WORKOUT'))).toBe(1);
      expect(ringUnit(node('X', 'X', 'T', [9, 0, 'x']))).toBe(0);
    });
  });

  describe('gap sentences', () => {
    it('says how many workouts to go and how long it takes at the pace of four a week', () => {
      expect(gapSentence(byCode('WORKOUTS_50'), TODAY, 4)).toBe('19 to go · about 5 weeks at your pace');
      expect(paceSentence(byCode('WORKOUTS_50'), TODAY, 4)).toBe('At four a week, about five weeks');
    });

    it('prefers the pace the server sent over the preference', () => {
      expect(gapSentence({ ...byCode('WORKOUTS_50'), pace: 2 }, TODAY, 4)).toBe('19 to go · about 10 weeks at your pace');
    });

    it('gives only the count when there is no pace', () => {
      expect(gapSentence(byCode('FIVE_RECORDS'), TODAY, 4)).toBe('2 to go');
      expect(gapSentence(byCode('WORKOUTS_50'), TODAY, null)).toBe('19 to go');
      expect(paceSentence(byCode('WORKOUTS_50'), TODAY, null)).toBe('');
    });

    it('names the days to log for a consecutive-days badge, counted from tomorrow', () => {
      // Tuesday 6 Oct: two days to go are tomorrow and Thursday.
      expect(gapSentence(byCode('SEVEN_DAYS_LOGGED'), TODAY, 4)).toBe('2 to go · log tomorrow and Thursday');
      expect(daysToLog(1, TODAY)).toBe('tomorrow');
      expect(daysToLog(3, TODAY)).toBe('tomorrow, Thursday and Friday');
      expect(daysToLog(4, TODAY)).toBe('');
      expect(daysToLog(2, 'not a date')).toBe('');
    });

    it('counts weeks in their own unit', () => {
      expect(gapSentence(byCode('FOUR_FULL_WEEKS'), TODAY, 4)).toBe('3 weeks to go');
    });

    it('writes the ratio of the bodyweight bench as it is', () => {
      expect(gapLine(byCode('BODYWEIGHT_BENCH'), TODAY, 4)).toEqual({ headline: '0.42 of 1.00', detail: '× body weight', pace: null });
    });

    it('uses what the badge takes for a first-time badge on an empty account', () => {
      const first = node('FIRST_WORKOUT', 'First workout', 'SHOWING_UP', [0, 1, 'workouts'], null, { how: 'One session finished' });
      expect(nextUpLine(first, TODAY, 4)).toBe('One session finished');
      expect(nextUpLine(byCode('WORKOUTS_50'), TODAY, 4)).toBe('19 to go · about 5 weeks at your pace');
    });

    it('writes the line under a later node as a count, or its description', () => {
      expect(laterLine(byCode('THIRTY_DAYS_LOGGED'))).toBe('26 of 30');
      expect(laterLine(byCode('PROTEIN_MONTH'))).toBe('every logged day of a month');
      expect(laterLine(byCode('BODYWEIGHT_BENCH'))).toBe('0.42 of 1.00 × body weight');
    });
  });

  describe('week evidence', () => {
    it('lays out the seven days of the week and marks the trained ones from the footprint', () => {
      const cells = weekCells('2026-09-21', FOOTPRINT.days);
      expect(cells.map((cell) => cell.day)).toEqual(['21', '22', '23', '24', '25', '26', '27']);
      expect(cells.map((cell) => cell.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      expect(cells.map((cell) => cell.trained)).toEqual([true, false, false, true, true, true, false]);
    });

    it('gives no cells for a week start that is not a date', () => {
      expect(weekCells('', FOOTPRINT.days)).toEqual([]);
    });

    it('writes the evidence line from the week when the server sent none', () => {
      const cells = weekCells('2026-09-21', FOOTPRINT.days);
      expect(evidenceLine(byCode('FULL_WEEK'), cells)).toBe('4 sessions in the week of 21 Sept');
      expect(evidenceLine({ ...byCode('FULL_WEEK'), evidence: { weekStart: null, sessionId: null, recordId: null, line: 'Four of four planned sessions' } }, [])).toBe('Four of four planned sessions');
      expect(evidenceLine(byCode('FIRST_COOK'), [])).toBe('First cook (how)');
    });
  });

  describe('doors', () => {
    it('sends lifting evidence to the Training log and food evidence to the Diary', () => {
      expect(doorFor('SHOWING_UP', 'earned')).toEqual({ label: 'From your Training log', link: '/progress/training', fragment: 'log' });
      expect(doorFor('EATING_WELL', 'earned')).toEqual({ label: 'From your Diary', link: '/nutrition' });
      expect(doorFor('SHOWING_UP', 'next')).toEqual({ label: 'Your sessions', link: '/workout', query: { tab: 'history' } });
      expect(doorFor('SOMETHING_NEW', 'earned')).toBeNull();
    });
  });
});
