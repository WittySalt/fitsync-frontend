import { DraftSegment } from '../plan-draft';
import {
  addSegment,
  hiitSegments,
  MAX_SEGMENTS,
  moveSegment,
  pairCaption,
  pairRoles,
  removeSegment,
  repeatRow,
  setPairRounds,
  setSegmentKind,
  setSegmentMinutes,
  sportSegments,
  stepSegmentMinutes,
  sumLine,
  unpair
} from './segment-list-math';
import { defaultSegments, segmentTotal, toBlocks } from './segment-math';

const kinds = (list: DraftSegment[]) => list.map((row) => row.kind);
const mins = (list: DraftSegment[]) => list.map((row) => row.minutes);

describe('segment list arithmetic', () => {
  describe('the defaults', () => {
    it('gives a cardio day warm-up 5, steady for the rest and cool-down 5', () => {
      expect(mins(defaultSegments(45))).toEqual([5, 35, 5]);
    });

    it('gives the HIIT type warm-up 5, Work 1 and Easy 2 eight times, cool-down 5', () => {
      const hiit = hiitSegments();
      expect(kinds(hiit)).toEqual(['WARMUP', 'WORK', 'EASY', 'COOLDOWN']);
      expect(mins(hiit)).toEqual([5, 1, 2, 5]);
      expect(hiit[1].rounds).toBe(8);
      expect(hiit[2].rounds).toBe(8);
      expect(segmentTotal(hiit)).toBe(34);
      expect(pairCaption(hiit, 1)).toBe('Work 1 · Easy 2 × 8');
    });

    it('gives a sport day warm-up 10, play for the rest and cool-down 5', () => {
      const sport = sportSegments(60);
      expect(mins(sport)).toEqual([10, 45, 5]);
      expect(sport[1].label).toBe('Play');
      expect(segmentTotal(sport)).toBe(60);
      expect(sportSegments(12).length).toBe(1);
    });
  });

  describe('free rows', () => {
    it('lets a person delete the warm-up and keep a single steady segment', () => {
      let list = defaultSegments(45);
      list = removeSegment(list, 0);
      list = removeSegment(list, 1);
      expect(kinds(list)).toEqual(['STEADY']);
      expect(removeSegment(list, 0)).toEqual([]);
    });

    it('adds a row at the end, steady when the list is empty and easy after that', () => {
      expect(kinds(addSegment([]))).toEqual(['STEADY']);
      expect(kinds(addSegment(defaultSegments(45)))).toEqual(['WARMUP', 'STEADY', 'COOLDOWN', 'EASY']);
      expect(addSegment(defaultSegments(45))[3].minutes).toBe(5);
      expect(addSegment([], true)[0].label).toBe('Play');
    });

    it('stops at the most rows the server takes', () => {
      const full = Array.from({ length: MAX_SEGMENTS }, () => defaultSegments(20)[1]);
      expect(addSegment(full).length).toBe(MAX_SEGMENTS);
    });

    it('changes the kind and the label with it, in any order', () => {
      const list = setSegmentKind(defaultSegments(45), 0, 'WORK');
      expect(list[0].kind).toBe('WORK');
      expect(list[0].label).toBe('Work');
      expect(setSegmentKind(list, 1, 'STEADY', true)[1].label).toBe('Play');
    });

    it('sets minutes to a whole number from 1 to 600 and ignores what is not a number', () => {
      const list = defaultSegments(45);
      expect(setSegmentMinutes(list, 1, 12.6)[1].minutes).toBe(13);
      expect(setSegmentMinutes(list, 1, 0)[1].minutes).toBe(1);
      expect(setSegmentMinutes(list, 1, 9000)[1].minutes).toBe(600);
      expect(setSegmentMinutes(list, 1, NaN)).toEqual(list);
    });

    it('changes the total when the minutes change, one step at a time', () => {
      const list = defaultSegments(45);
      expect(segmentTotal(stepSegmentMinutes(list, 1, 1))).toBe(46);
      expect(segmentTotal(stepSegmentMinutes(list, 0, -1))).toBe(44);
      expect(stepSegmentMinutes(list, 9, 1)).toEqual(list);
      expect(stepSegmentMinutes(setSegmentMinutes(list, 0, 1), 0, -1)[0].minutes).toBe(1);
    });

    it('moves a row to a new place and keeps the total', () => {
      const moved = moveSegment(defaultSegments(45), 2, 0);
      expect(kinds(moved)).toEqual(['COOLDOWN', 'WARMUP', 'STEADY']);
      expect(segmentTotal(moved)).toBe(45);
      expect(moveSegment(defaultSegments(45), 0, 9)).toEqual(defaultSegments(45));
      expect(moveSegment(defaultSegments(45), 1, 1)).toEqual(defaultSegments(45));
    });
  });

  describe('repeating a pair', () => {
    it('repeats a row with the next one and writes the rounds on both', () => {
      const list = repeatRow(defaultSegments(45), 1, 6);
      expect(list[1].rounds).toBe(6);
      expect(list[2].rounds).toBe(6);
      expect(pairRoles(list)).toEqual([null, 'first', 'second']);
      expect(segmentTotal(list)).toBe(5 + 6 * (35 + 5));
    });

    it('adds an easy row to pair with when the last row is repeated', () => {
      const list = repeatRow([defaultSegments(45)[1]], 0, 3);
      expect(kinds(list)).toEqual(['STEADY', 'EASY']);
      expect(list.every((row) => row.rounds === 3)).toBeTrue();
    });

    it('draws the pair as one block on the timeline', () => {
      const blocks = toBlocks(repeatRow(setSegmentKind(setSegmentKind(defaultSegments(45), 1, 'WORK'), 2, 'EASY'), 1, 4));
      expect(blocks.map((block) => block.kind)).toEqual(['WARMUP', 'INTERVALS']);
    });

    it('changes the rounds from either row, within 2 and 20', () => {
      const list = repeatRow(defaultSegments(45), 0, 4);
      expect(setPairRounds(list, 1, 9).map((row) => row.rounds)).toEqual([9, 9, null]);
      expect(setPairRounds(list, 0, 99)[0].rounds).toBe(20);
      expect(setPairRounds(list, 0, 0)[0].rounds).toBe(2);
      expect(setPairRounds(list, 2, 5)).toEqual(list);
    });

    it('stops repeating both rows together', () => {
      const list = repeatRow(defaultSegments(45), 0, 4);
      expect(unpair(list, 1).every((row) => row.rounds === null)).toBeTrue();
      expect(unpair(defaultSegments(45), 0)).toEqual(defaultSegments(45));
    });

    it('lets the other half stop repeating when one half is removed', () => {
      const list = removeSegment(repeatRow(defaultSegments(45), 0, 4), 0);
      expect(list.length).toBe(2);
      expect(list.every((row) => row.rounds === null)).toBeTrue();
    });

    it('breaks a pair that is moved, and leaves a pair alone that is repeated again', () => {
      const list = repeatRow(defaultSegments(45), 0, 4);
      expect(moveSegment(list, 0, 2).every((row) => row.rounds === null)).toBeTrue();
      expect(repeatRow(list, 0, 7)).toEqual(list);
    });
  });

  describe('the sum line', () => {
    it('says what the rows add up to', () => {
      expect(sumLine(45, 45)).toEqual({ text: 'Adds up to 45 min', useMinutes: null });
      expect(sumLine(45, null)).toEqual({ text: 'Adds up to 45 min', useMinutes: null });
    });

    it('says so when the day is another length, and offers the sum', () => {
      expect(sumLine(40, 45)).toEqual({ text: 'Adds up to 40 min; the day is 45 min', useMinutes: 40 });
    });
  });
});
