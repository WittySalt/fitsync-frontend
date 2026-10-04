import { DraftSegment, SEGMENT_LABELS, SegmentKind } from '../plan-draft';

/**
 * The arithmetic of the cardio segment strip. A day's shape is a list of segments; Work and Easy
 * that share a round count form one interval block on the strip. Every operation keeps the total
 * of the day fixed, which is why dragging a boundary only ever trades minutes between neighbours.
 */

/** One bar of the strip: a single segment, or a Work and Easy pair that repeats. */
export interface SegmentBlock {
  /** Index of the block's first segment in the segment list. */
  start: number;
  /** How many segments the block covers: 1, or 2 for an interval pair. */
  length: number;
  kind: SegmentKind | 'INTERVALS';
  label: string;
  /** All the minutes of the block, rounds included. */
  minutes: number;
  work: number | null;
  easy: number | null;
  rounds: number | null;
}

export const MIN_BLOCK_MINUTES = 1;
export const MAX_ROUNDS = 20;
export const DEFAULT_ROUNDS = 4;

export function segment(kind: SegmentKind, minutes: number, rounds: number | null = null): DraftSegment {
  return { kind, label: SEGMENT_LABELS[kind], minutes, rounds };
}

/** Warm-up 5, steady for the rest, cool-down 5; a day under 12 minutes is one steady stretch. */
export function defaultSegments(total: number): DraftSegment[] {
  const minutes = Math.max(1, Math.round(total));
  if (minutes < 12) {
    return [segment('STEADY', minutes)];
  }
  return [segment('WARMUP', 5), segment('STEADY', minutes - 10), segment('COOLDOWN', 5)];
}

export function segmentTotal(segments: readonly DraftSegment[]): number {
  return segments.reduce((sum, item) => sum + item.minutes * (item.rounds ?? 1), 0);
}

export function toBlocks(segments: readonly DraftSegment[]): SegmentBlock[] {
  const blocks: SegmentBlock[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    if (current.kind === 'WORK' && next?.kind === 'EASY' && current.rounds && current.rounds === next.rounds) {
      blocks.push({
        start: index,
        length: 2,
        kind: 'INTERVALS',
        label: 'Intervals',
        minutes: current.rounds * (current.minutes + next.minutes),
        work: current.minutes,
        easy: next.minutes,
        rounds: current.rounds
      });
      index += 1;
    } else {
      blocks.push({
        start: index,
        length: 1,
        kind: current.kind,
        label: current.label || SEGMENT_LABELS[current.kind],
        minutes: current.minutes * (current.rounds ?? 1),
        work: null,
        easy: null,
        rounds: current.rounds
      });
    }
  }
  return blocks;
}

export function hasIntervals(segments: readonly DraftSegment[]): boolean {
  return toBlocks(segments).some((block) => block.kind === 'INTERVALS');
}

export function intervalRounds(segments: readonly DraftSegment[]): number | null {
  return toBlocks(segments).find((block) => block.kind === 'INTERVALS')?.rounds ?? null;
}

function minimumOf(block: SegmentBlock): number {
  return block.kind === 'INTERVALS' ? (block.rounds ?? 1) * (1 + (block.easy ?? 1)) : MIN_BLOCK_MINUTES;
}

function stepOf(block: SegmentBlock): number {
  return block.kind === 'INTERVALS' ? (block.rounds ?? 1) : 1;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Applies a whole-minute change to a block. An interval block takes it as a change of Work in each round. */
function withBlockDelta(segments: DraftSegment[], block: SegmentBlock, delta: number): DraftSegment[] {
  return segments.map((item, index) => {
    if (block.kind === 'INTERVALS') {
      if (index === block.start) {
        return { ...item, minutes: item.minutes + delta / (block.rounds ?? 1) };
      }
      return item;
    }
    return index === block.start ? { ...item, minutes: item.minutes + delta } : item;
  });
}

/**
 * Moves the boundary after block `boundary` by `delta` minutes: the block before it grows by that
 * much and the block after it shrinks, never under one minute. An interval block moves in steps of
 * its round count, so the result is rounded to a step both neighbours can take. The total is kept.
 */
export function dragBoundary(segments: readonly DraftSegment[], boundary: number, delta: number): DraftSegment[] {
  const blocks = toBlocks(segments);
  const left = blocks[boundary];
  const right = blocks[boundary + 1];
  if (!left || !right || !Number.isFinite(delta)) {
    return [...segments];
  }
  const step = (stepOf(left) * stepOf(right)) / gcd(stepOf(left), stepOf(right));
  const growRoom = Math.floor((right.minutes - minimumOf(right)) / step) * step;
  const shrinkRoom = Math.floor((left.minutes - minimumOf(left)) / step) * step;
  const wanted = Math.round(delta / step) * step;
  const applied = Math.max(-shrinkRoom, Math.min(growRoom, wanted));
  if (applied === 0) {
    return [...segments];
  }
  return withBlockDelta(withBlockDelta([...segments], left, applied), right, -applied);
}

/** Types a block's minutes: the difference comes from the block after it, or the one before for the last block. */
export function setBlockMinutes(segments: readonly DraftSegment[], blockIndex: number, minutes: number): DraftSegment[] {
  const blocks = toBlocks(segments);
  const block = blocks[blockIndex];
  if (!block || !Number.isFinite(minutes) || blocks.length < 2) {
    return [...segments];
  }
  const delta = Math.round(minutes) - block.minutes;
  return blockIndex < blocks.length - 1
    ? dragBoundary(segments, blockIndex, delta)
    : dragBoundary(segments, blockIndex - 1, -delta);
}

function addToNeighbour(segments: DraftSegment[], groupStart: number, groupLength: number, minutes: number): boolean {
  const after = segments[groupStart + groupLength];
  const before = segments[groupStart - 1];
  const target = after ?? before;
  if (!target) {
    return minutes === 0;
  }
  const at = segments.indexOf(target);
  segments[at] = { ...target, minutes: target.minutes + minutes };
  return segments[at].minutes >= MIN_BLOCK_MINUTES;
}

/** Turns the steady stretch into Work and Easy rounds, or the rounds back into one steady stretch. */
export function setIntervals(segments: readonly DraftSegment[], on: boolean, rounds = DEFAULT_ROUNDS): DraftSegment[] {
  const blocks = toBlocks(segments);
  if (!on) {
    const group = blocks.find((block) => block.kind === 'INTERVALS');
    if (!group) {
      return [...segments];
    }
    const next = [...segments];
    next.splice(group.start, 2, segment('STEADY', group.minutes));
    return next;
  }
  const steady = blocks.filter((block) => block.kind === 'STEADY').sort((a, b) => b.minutes - a.minutes)[0];
  if (!steady || hasIntervals(segments)) {
    return [...segments];
  }
  const total = steady.minutes;
  let count = Math.max(1, Math.min(rounds, MAX_ROUNDS, Math.floor(total / 2)));
  const hasNeighbour = segments.length > 1;
  while (!hasNeighbour && count > 1 && total % count !== 0) {
    count -= 1;
  }
  const cycle = Math.floor(total / count);
  const work = Math.max(1, Math.ceil(cycle / 2));
  const easy = Math.max(1, cycle - work);
  const left = total - count * (work + easy);
  const next = [...segments];
  next.splice(steady.start, 1, segment('WORK', work, count), segment('EASY', easy, count));
  if (left > 0) {
    addToNeighbour(next, steady.start, 2, left);
  }
  return next;
}

/** Changes the number of rounds, keeping the interval block's total: each round gets shorter or longer. */
export function setRounds(segments: readonly DraftSegment[], rounds: number): DraftSegment[] {
  const group = toBlocks(segments).find((block) => block.kind === 'INTERVALS');
  if (!group || group.work === null || group.easy === null) {
    return [...segments];
  }
  const total = group.minutes;
  let count = Math.max(1, Math.min(Math.round(rounds), MAX_ROUNDS, Math.floor(total / 2)));
  const hasNeighbour = segments.length > 2;
  while (!hasNeighbour && count > 1 && total % count !== 0) {
    count -= 1;
  }
  const cycle = Math.floor(total / count);
  let work = Math.max(1, Math.round((cycle * group.work) / (group.work + group.easy)));
  let easy = cycle - work;
  if (easy < 1) {
    easy = 1;
    work = Math.max(1, cycle - 1);
  }
  const left = total - count * (work + easy);
  const next = [...segments];
  next[group.start] = { ...next[group.start], minutes: work, rounds: count };
  next[group.start + 1] = { ...next[group.start + 1], minutes: easy, rounds: count };
  if (left > 0) {
    addToNeighbour(next, group.start, 2, left);
  }
  return next;
}

/** Keeps the strip's total equal to the day's duration when the duration is edited. */
export function resizeTotal(segments: readonly DraftSegment[], newTotal: number): DraftSegment[] {
  const target = Math.max(segments.length ? toBlocks(segments).length : 1, Math.round(newTotal));
  const current = segmentTotal(segments);
  if (segments.length === 0) {
    return defaultSegments(target);
  }
  let delta = target - current;
  if (delta === 0) {
    return [...segments];
  }
  const next = [...segments];
  const order = (item: DraftSegment): number => {
    const rank: Partial<Record<SegmentKind, number>> = { STEADY: 0, COOLDOWN: 1, WARMUP: 2 };
    return item.rounds ? 3 : (rank[item.kind] ?? 3);
  };
  const absorbers = next.map((item, index) => ({ item, index })).filter(({ item }) => !item.rounds).sort((a, b) => order(a.item) - order(b.item));
  for (const { index } of absorbers) {
    const room = delta > 0 ? delta : Math.max(delta, MIN_BLOCK_MINUTES - next[index].minutes);
    next[index] = { ...next[index], minutes: next[index].minutes + room };
    delta -= room;
    if (delta === 0) {
      return next;
    }
  }
  return delta === 0 ? next : [...segments];
}

/** The text on a bar: "Warm-up 5", "Steady 20", "4 × (3 + 3)". */
export function blockCaption(block: SegmentBlock): string {
  if (block.kind === 'INTERVALS') {
    return `${block.rounds} × (${block.work} + ${block.easy})`;
  }
  return `${block.label} ${block.minutes}`;
}
