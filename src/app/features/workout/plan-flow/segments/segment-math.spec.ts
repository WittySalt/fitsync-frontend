import {
  blockCaption,
  defaultSegments,
  dragBoundary,
  hasIntervals,
  intervalRounds,
  resizeTotal,
  segmentTotal,
  setBlockMinutes,
  setIntervals,
  setRounds,
  toBlocks
} from './segment-math';

const minutes = (segments: ReturnType<typeof defaultSegments>) => segments.map((item) => item.minutes);

describe('segment math', () => {
  it('defaults to 5, the rest, and 5', () => {
    expect(minutes(defaultSegments(45))).toEqual([5, 35, 5]);
    expect(segmentTotal(defaultSegments(45))).toBe(45);
  });

  it('keeps a short day as one steady stretch', () => {
    const segments = defaultSegments(10);
    expect(segments.length).toBe(1);
    expect(segments[0].kind).toBe('STEADY');
    expect(segments[0].minutes).toBe(10);
  });

  it('trades minutes between neighbours and keeps the total fixed', () => {
    const next = dragBoundary(defaultSegments(40), 0, 3);
    expect(minutes(next)).toEqual([8, 27, 5]);
    expect(segmentTotal(next)).toBe(40);
  });

  it('drags the other way', () => {
    const next = dragBoundary(defaultSegments(40), 1, -4);
    expect(minutes(next)).toEqual([5, 26, 9]);
    expect(segmentTotal(next)).toBe(40);
  });

  it('never takes a neighbour under one minute', () => {
    const next = dragBoundary(defaultSegments(40), 0, 500);
    expect(minutes(next)).toEqual([34, 1, 5]);
    expect(segmentTotal(next)).toBe(40);
    const back = dragBoundary(defaultSegments(40), 0, -500);
    expect(minutes(back)).toEqual([1, 34, 5]);
  });

  it('ignores a boundary that does not exist', () => {
    expect(minutes(dragBoundary(defaultSegments(40), 5, 3))).toEqual([5, 30, 5]);
  });

  it('types a block value and takes the difference from the next block', () => {
    const next = setBlockMinutes(defaultSegments(40), 0, 10);
    expect(minutes(next)).toEqual([10, 25, 5]);
  });

  it('takes the difference from the block before for the last block', () => {
    const next = setBlockMinutes(defaultSegments(40), 2, 8);
    expect(minutes(next)).toEqual([5, 27, 8]);
  });

  it('switches the middle to Work and Easy rounds and keeps the total', () => {
    const next = setIntervals(defaultSegments(40), true, 4);
    expect(hasIntervals(next)).toBe(true);
    expect(intervalRounds(next)).toBe(4);
    expect(segmentTotal(next)).toBe(40);
    const blocks = toBlocks(next);
    expect(blocks.map((block) => block.kind)).toEqual(['WARMUP', 'INTERVALS', 'COOLDOWN']);
  });

  it('puts the minutes that do not divide into rounds into the cool-down', () => {
    const next = setIntervals(defaultSegments(37), true, 4);
    expect(segmentTotal(next)).toBe(37);
    expect(next[0].minutes).toBe(5);
  });

  it('switches intervals off into one steady stretch', () => {
    const on = setIntervals(defaultSegments(40), true, 5);
    const off = setIntervals(on, false);
    expect(hasIntervals(off)).toBe(false);
    expect(segmentTotal(off)).toBe(40);
    expect(off.map((item) => item.kind)).toEqual(['WARMUP', 'STEADY', 'COOLDOWN']);
  });

  it('changes rounds without changing the total', () => {
    const on = setIntervals(defaultSegments(40), true, 4);
    for (const rounds of [1, 2, 3, 6, 8, 10]) {
      const next = setRounds(on, rounds);
      expect(segmentTotal(next)).toBe(40);
      expect(intervalRounds(next)).toBe(rounds);
    }
  });

  it('drags an interval boundary in steps of the round count', () => {
    const on = setIntervals(defaultSegments(40), true, 5);
    const next = dragBoundary(on, 0, 7);
    expect(segmentTotal(next)).toBe(40);
    const warm = next[0].minutes;
    expect([5, 10, 15]).toContain(warm);
  });

  it('keeps the total when the duration changes', () => {
    const grown = resizeTotal(defaultSegments(40), 55);
    expect(segmentTotal(grown)).toBe(55);
    expect(minutes(grown)).toEqual([5, 45, 5]);
    const shrunk = resizeTotal(defaultSegments(40), 20);
    expect(segmentTotal(shrunk)).toBe(20);
  });

  it('builds a default shape when a day has none', () => {
    expect(segmentTotal(resizeTotal([], 30))).toBe(30);
  });

  it('words a bar', () => {
    const blocks = toBlocks(setIntervals(defaultSegments(40), true, 5));
    expect(blockCaption(toBlocks(defaultSegments(40))[0])).toBe('Warm-up 5');
    expect(blockCaption(blocks[1])).toMatch(/^5 × \(\d+ \+ \d+\)$/);
  });
});
