import { DraftSegment, SEGMENT_LABELS, SegmentKind } from '../plan-draft';
import { segment } from './segment-math';

/**
 * The operations of the segment list. A day's shape is a free list: any rows in any order, with
 * one row or many. Two neighbouring rows that carry the same round count repeat together, which
 * the list calls a pair. Unlike dragging on the timeline, these change the total.
 */

export const MIN_SEGMENT_MINUTES = 1;
export const MAX_SEGMENT_MINUTES = 600;
export const MAX_SEGMENTS = 30;
export const MAX_PAIR_ROUNDS = 20;
export const DEFAULT_PAIR_ROUNDS = 4;
export const KIND_OPTIONS: readonly SegmentKind[] = ['WARMUP', 'STEADY', 'WORK', 'EASY', 'COOLDOWN'];

/** A sport day's steady stretch is called Play. */
export function labelFor(kind: SegmentKind, play: boolean): string {
  return play && kind === 'STEADY' ? 'Play' : SEGMENT_LABELS[kind];
}

/** Warm-up 5, Work 1 and Easy 2 eight times, cool-down 5: the shape of the HIIT type. */
export function hiitSegments(): DraftSegment[] {
  return [segment('WARMUP', 5), { ...segment('WORK', 1), rounds: 8 }, { ...segment('EASY', 2), rounds: 8 }, segment('COOLDOWN', 5)];
}

/** Warm-up 10, play for the rest, cool-down 5; under 18 minutes (less than 3 of play) it is one play stretch. */
export function sportSegments(total: number): DraftSegment[] {
  const minutes = Math.max(1, Math.round(total));
  if (minutes < 18) {
    return [{ ...segment('STEADY', minutes), label: 'Play' }];
  }
  return [segment('WARMUP', 10), { ...segment('STEADY', minutes - 15), label: 'Play' }, segment('COOLDOWN', 5)];
}

export type PairRole = 'first' | 'second' | null;

/** Whether a row is the first or the second of a repeated pair, read left to right. */
export function pairRoles(segments: readonly DraftSegment[]): PairRole[] {
  const roles: PairRole[] = segments.map(() => null);
  for (let i = 0; i < segments.length - 1; i += 1) {
    const rounds = segments[i].rounds;
    if (rounds && rounds === segments[i + 1].rounds) {
      roles[i] = 'first';
      roles[i + 1] = 'second';
      i += 1;
    }
  }
  return roles;
}

function clampMinutes(value: number): number {
  return Math.max(MIN_SEGMENT_MINUTES, Math.min(MAX_SEGMENT_MINUTES, Math.round(value)));
}

function withRow(segments: readonly DraftSegment[], index: number, change: Partial<DraftSegment>): DraftSegment[] {
  return segments.map((row, at) => (at === index ? { ...row, ...change } : row));
}

/** Clears the rounds of both rows of the pair a row belongs to. */
export function unpair(segments: readonly DraftSegment[], index: number): DraftSegment[] {
  const roles = pairRoles(segments);
  if (roles[index] === null) {
    return [...segments];
  }
  const first = roles[index] === 'first' ? index : index - 1;
  return segments.map((row, at) => (at === first || at === first + 1 ? { ...row, rounds: null } : row));
}

export function addSegment(segments: readonly DraftSegment[], play = false): DraftSegment[] {
  if (segments.length >= MAX_SEGMENTS) {
    return [...segments];
  }
  const kind: SegmentKind = segments.length === 0 ? 'STEADY' : 'EASY';
  return [...segments, { ...segment(kind, 5), label: labelFor(kind, play) }];
}

/** Takes a row out. If it was half of a pair, the other half stops repeating. */
export function removeSegment(segments: readonly DraftSegment[], index: number): DraftSegment[] {
  return unpair(segments, index).filter((_, at) => at !== index);
}

export function setSegmentKind(segments: readonly DraftSegment[], index: number, kind: SegmentKind, play = false): DraftSegment[] {
  return withRow(segments, index, { kind, label: labelFor(kind, play) });
}

export function setSegmentMinutes(segments: readonly DraftSegment[], index: number, minutes: number): DraftSegment[] {
  return Number.isFinite(minutes) ? withRow(segments, index, { minutes: clampMinutes(minutes) }) : [...segments];
}

export function stepSegmentMinutes(segments: readonly DraftSegment[], index: number, by: number): DraftSegment[] {
  return segments[index] ? setSegmentMinutes(segments, index, segments[index].minutes + by) : [...segments];
}

/** Moves a row to a new place. A pair is broken by the move, since its halves are no longer neighbours. */
export function moveSegment(segments: readonly DraftSegment[], from: number, to: number): DraftSegment[] {
  if (from === to || from < 0 || to < 0 || from >= segments.length || to >= segments.length) {
    return [...segments];
  }
  const loose = unpair(segments, from);
  const next = [...loose];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

/**
 * Makes a row and the next one repeat. When there is no free next row (the last row, or one whose
 * next row is already in a pair), an Easy row of two minutes is added to pair with. A row that is
 * already half of a pair is left as it is.
 */
export function repeatRow(segments: readonly DraftSegment[], index: number, rounds = DEFAULT_PAIR_ROUNDS, play = false): DraftSegment[] {
  if (!segments[index] || pairRoles(segments)[index] !== null) {
    return [...segments];
  }
  let list = [...segments];
  if (index === list.length - 1 || pairRoles(list)[index + 1] !== null) {
    if (list.length >= MAX_SEGMENTS) {
      return list;
    }
    list.splice(index + 1, 0, { ...segment('EASY', 2), label: labelFor('EASY', play) });
  }
  list = list.map((row, at) => (at === index || at === index + 1 ? { ...row, rounds: Math.max(2, rounds) } : row));
  return list;
}

export function setPairRounds(segments: readonly DraftSegment[], index: number, rounds: number): DraftSegment[] {
  const roles = pairRoles(segments);
  if (roles[index] === null || !Number.isFinite(rounds)) {
    return [...segments];
  }
  const first = roles[index] === 'first' ? index : index - 1;
  const count = Math.max(2, Math.min(MAX_PAIR_ROUNDS, Math.round(rounds)));
  return segments.map((row, at) => (at === first || at === first + 1 ? { ...row, rounds: count } : row));
}

/** "Work 1 · Easy 2 × 8" for a pair, written from its first row's index. */
export function pairCaption(segments: readonly DraftSegment[], first: number): string {
  const a = segments[first];
  const b = segments[first + 1];
  return a && b ? `${a.label} ${a.minutes} · ${b.label} ${b.minutes} × ${a.rounds}` : '';
}

/** The line under the list: what the rows add up to, and what to do when that is not the day's length. */
export interface SumLine {
  text: string;
  /** The minutes the "Use ... min" link would set, or null when the sum already matches. */
  useMinutes: number | null;
}

export function sumLine(total: number, dayMinutes: number | null): SumLine {
  if (dayMinutes === null || dayMinutes === total) {
    return { text: `Adds up to ${total} min`, useMinutes: null };
  }
  return { text: `Adds up to ${total} min; the day is ${dayMinutes} min`, useMinutes: total };
}
