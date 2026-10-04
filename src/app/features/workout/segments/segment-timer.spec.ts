import { WorkoutSessionSegment } from '../../../core/fitsync.models';
import { addMinute, advance, cueFigure, freeTimerSegments, segmentRemaining, skip, startTimer, timerLine } from './segment-timer';

function seg(position: number, kind: WorkoutSessionSegment['kind'], label: string, plannedSeconds: number): WorkoutSessionSegment {
  return { entryId: `e${position}`, position, kind, label, plannedSeconds, actualSeconds: null, startedAt: null, status: 'PENDING' };
}

const NOW = new Date('2026-10-04T10:00:00Z');
const day = [seg(1, 'WARMUP', 'Warm-up', 300), seg(2, 'STEADY', 'Steady', 900), seg(3, 'COOLDOWN', 'Cool-down', 300)];

describe('segment timer', () => {
  it('starts on the first pending segment and stamps its start', () => {
    const timer = startTimer(day, 0, NOW);
    expect(timer.current).toBe(0);
    expect(timer.segments[0].startedAt).toBe(NOW.toISOString());
  });

  it('says what is left and what comes next', () => {
    const timer = startTimer(day, 0, NOW);
    expect(timerLine(timer, 60)).toBe('Warm-up · 4:00 left · Next: Steady 15 min');
    const last = { ...timer, current: 2 };
    expect(timerLine(last, 0)).toBe('Cool-down · 5:00 left');
  });

  it('does nothing before the planned time and ends the segment on it', () => {
    const timer = startTimer(day, 0, NOW);
    expect(advance(timer, 299, NOW).settled).toEqual([]);
    const step = advance(timer, 300, NOW);
    expect(step.timer.current).toBe(1);
    expect(step.settled).toEqual([{ position: 1, actualSeconds: 300, startedAt: NOW.toISOString(), status: 'DONE' }]);
    expect(segmentRemaining(step.timer, 300)).toBe(900);
  });

  it('settles every segment that a long gap (a hidden tab) has run past', () => {
    const step = advance(startTimer(day, 0, NOW), 1300, NOW);
    expect(step.settled.map((item) => item.position)).toEqual([1, 2]);
    expect(step.timer.current).toBe(2);
    expect(segmentRemaining(step.timer, 1300)).toBe(200);
  });

  it('skips the running segment with the time already spent, and the next one starts from there', () => {
    const timer = startTimer(day, 0, NOW);
    const step = skip(timer, 120, NOW);
    expect(step.settled[0]).toEqual(jasmine.objectContaining({ position: 1, actualSeconds: 120, status: 'SKIPPED' }));
    expect(step.timer.current).toBe(1);
    expect(segmentRemaining(step.timer, 120)).toBe(900);
  });

  it('adds a minute to the running segment only', () => {
    const timer = addMinute(startTimer(day, 0, NOW));
    expect(advance(timer, 300, NOW).settled).toEqual([]);
    const step = advance(timer, 360, NOW);
    expect(step.settled[0].actualSeconds).toBe(360);
    expect(step.timer.segments[1].extraSeconds).toBe(0);
  });

  it('settles the last segment and then has none running', () => {
    const only = startTimer([seg(1, 'STEADY', 'Steady', 600)], 0, NOW);
    const step = advance(only, 600, NOW);
    expect(step.timer.current).toBe(-1);
    expect(timerLine(step.timer, 600)).toBe('All segments done');
    expect(skip(step.timer, 700, NOW).settled).toEqual([]);
    expect(addMinute(step.timer)).toBe(step.timer);
  });

  it('shows the 3-2-1 cue in the last three seconds only', () => {
    const timer = startTimer(day, 0, NOW);
    expect(cueFigure(timer, 296)).toBeNull();
    expect(cueFigure(timer, 297)).toBe(3);
    expect(cueFigure(timer, 298)).toBe(2);
    expect(cueFigure(timer, 299)).toBe(1);
    expect(cueFigure(timer, 300)).toBeNull();
  });

  it('resumes after the settled segments and ignores the clock before them', () => {
    const resumed = [{ ...day[0], status: 'DONE' as const, actualSeconds: 300, startedAt: NOW.toISOString() }, day[1], day[2]];
    const timer = startTimer(resumed, 420, NOW);
    expect(timer.current).toBe(1);
    expect(segmentRemaining(timer, 420)).toBe(780);
  });

  it('builds the segments of a free timer', () => {
    expect(freeTimerSegments('CARDIO', 20)).toEqual([{ kind: 'STEADY', label: 'Steady', plannedSeconds: 1200 }]);
    expect(freeTimerSegments('CARDIO', null)).toEqual([]);
    const hiit = freeTimerSegments('HIIT', null);
    expect(hiit[0].kind).toBe('WARMUP');
    expect(hiit[hiit.length - 1].kind).toBe('COOLDOWN');
    expect(hiit.filter((item) => item.kind === 'WORK').length).toBe(8);
  });
});
