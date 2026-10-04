import { SegmentKind, SegmentStatus, WorkoutSessionSegment } from '../../../core/fitsync.models';

/** The last seconds of a segment, counted down with the 3-2-1 cue. */
export const CUE_SECONDS = 3;
/** What "+1 min" adds to the segment that is running. */
export const EXTRA_SECONDS = 60;

export interface TimerSegment {
  position: number;
  kind: SegmentKind;
  label: string;
  plannedSeconds: number;
  /** Seconds added with "+1 min"; the segment ends at planned plus extra. */
  extraSeconds: number;
  actualSeconds: number | null;
  startedAt: string | null;
  status: SegmentStatus;
}

export interface SegmentTimer {
  segments: TimerSegment[];
  /** Index of the segment that is running, or -1 when every segment is settled. */
  current: number;
  /** The session's active seconds at which the running segment began. */
  startOffset: number;
}

/** A change to one segment that has to reach the server: its actual time, start and status. */
export interface SegmentSettled {
  position: number;
  actualSeconds: number;
  startedAt: string | null;
  status: 'DONE' | 'SKIPPED';
}

export interface StepResult {
  timer: SegmentTimer;
  settled: SegmentSettled[];
}

export interface StripRow {
  label: string;
  kind: SegmentKind;
  plannedSeconds: number;
  actualSeconds: number | null;
  status: SegmentStatus;
}

/**
 * The timer for a session's segments. Segments run one after another on the session's own clock
 * (`elapsed`, which stops while paused), so a pause never eats into a segment. On a resumed session
 * the settled segments give the offset at which the first pending one began.
 */
export function startTimer(segments: readonly WorkoutSessionSegment[], elapsed: number, now: Date = new Date()): SegmentTimer {
  const ordered: TimerSegment[] = [...segments]
    .sort((a, b) => a.position - b.position)
    .map((segment) => ({
      position: segment.position,
      kind: segment.kind,
      label: segment.label,
      plannedSeconds: segment.plannedSeconds,
      extraSeconds: 0,
      actualSeconds: segment.actualSeconds,
      startedAt: segment.startedAt,
      status: segment.status
    }));
  const current = ordered.findIndex((segment) => segment.status === 'PENDING');
  const settled = ordered
    .filter((segment) => segment.status !== 'PENDING')
    .reduce((sum, segment) => sum + (segment.actualSeconds ?? 0), 0);
  const startOffset = current < 0 ? elapsed : Math.min(settled, elapsed);
  if (current >= 0 && !ordered[current].startedAt) {
    ordered[current].startedAt = new Date(now.getTime() - Math.max(0, elapsed - startOffset) * 1000).toISOString();
  }
  return { segments: ordered, current, startOffset };
}

export function segmentLength(segment: TimerSegment): number {
  return segment.plannedSeconds + segment.extraSeconds;
}

/** Seconds spent in the running segment. */
export function segmentElapsed(timer: SegmentTimer, elapsed: number): number {
  return Math.max(0, elapsed - timer.startOffset);
}

/** Seconds left in the running segment; zero when none is running. */
export function segmentRemaining(timer: SegmentTimer, elapsed: number): number {
  const segment = timer.segments[timer.current];
  return segment ? Math.max(0, segmentLength(segment) - segmentElapsed(timer, elapsed)) : 0;
}

/** The figure of the 3-2-1 cue, or null outside the last seconds. */
export function cueFigure(timer: SegmentTimer, elapsed: number): number | null {
  if (timer.current < 0) {
    return null;
  }
  const left = Math.ceil(segmentRemaining(timer, elapsed));
  return left >= 1 && left <= CUE_SECONDS ? left : null;
}

function settle(timer: SegmentTimer, status: 'DONE' | 'SKIPPED', seconds: number, now: Date): StepResult {
  const segments = timer.segments.map((segment) => ({ ...segment }));
  const segment = segments[timer.current];
  const actual = Math.max(0, Math.round(seconds));
  segment.actualSeconds = actual;
  segment.status = status;
  segment.startedAt = segment.startedAt ?? new Date(now.getTime() - actual * 1000).toISOString();
  const next = segments.findIndex((candidate, index) => index > timer.current && candidate.status === 'PENDING');
  if (next >= 0 && !segments[next].startedAt) {
    segments[next].startedAt = now.toISOString();
  }
  return {
    timer: { segments, current: next, startOffset: timer.startOffset + actual },
    settled: [{ position: segment.position, actualSeconds: actual, startedAt: segment.startedAt, status }]
  };
}

/** Ends every segment whose planned time (with extras) has run out, and moves on to the next one. */
export function advance(timer: SegmentTimer, elapsed: number, now: Date = new Date()): StepResult {
  let result: StepResult = { timer, settled: [] };
  while (result.timer.current >= 0) {
    const segment = result.timer.segments[result.timer.current];
    if (segmentElapsed(result.timer, elapsed) < segmentLength(segment)) {
      break;
    }
    const step = settle(result.timer, 'DONE', segmentLength(segment), now);
    result = { timer: step.timer, settled: [...result.settled, ...step.settled] };
  }
  return result;
}

/** "Skip segment": the running one is settled as SKIPPED with the time already spent in it. */
export function skip(timer: SegmentTimer, elapsed: number, now: Date = new Date()): StepResult {
  if (timer.current < 0) {
    return { timer, settled: [] };
  }
  const length = segmentLength(timer.segments[timer.current]);
  return settle(timer, 'SKIPPED', Math.min(segmentElapsed(timer, elapsed), length), now);
}

/** "+1 min": the running segment lasts a minute longer. */
export function addMinute(timer: SegmentTimer): SegmentTimer {
  if (timer.current < 0) {
    return timer;
  }
  const segments = timer.segments.map((segment, index) =>
    index === timer.current ? { ...segment, extraSeconds: segment.extraSeconds + EXTRA_SECONDS } : segment
  );
  return { ...timer, segments };
}

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function lengthWord(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : clock(seconds);
}

/** "Steady · 12:40 left · Next: Cool-down 5 min"; the last segment has no "Next". */
export function timerLine(timer: SegmentTimer, elapsed: number): string {
  const segment = timer.segments[timer.current];
  if (!segment) {
    return 'All segments done';
  }
  const parts = [segment.label, `${clock(segmentRemaining(timer, elapsed))} left`];
  const next = timer.segments.find((candidate, index) => index > timer.current && candidate.status === 'PENDING');
  if (next) {
    parts.push(`Next: ${next.label} ${lengthWord(next.plannedSeconds)}`);
  }
  return parts.join(' · ');
}

/** The strip's rows: the running segment shows its planned length with extras. */
export function stripRows(timer: SegmentTimer): StripRow[] {
  return timer.segments.map((segment) => ({
    label: segment.label,
    kind: segment.kind,
    plannedSeconds: segmentLength(segment),
    actualSeconds: segment.actualSeconds,
    status: segment.status
  }));
}

/** The segments a free timer starts with: one STEADY segment for a minutes goal, the interval set for HIIT, else none. */
export function freeTimerSegments(workoutType: string, goalMinutes: number | null): StartSegment[] {
  if (workoutType === 'HIIT') {
    const intervals = Array.from({ length: 8 }, (): StartSegment[] => [
      { kind: 'WORK', label: 'Work', plannedSeconds: 30 },
      { kind: 'EASY', label: 'Easy', plannedSeconds: 60 }
    ]).flat();
    return [
      { kind: 'WARMUP', label: 'Warm-up', plannedSeconds: 300 },
      ...intervals,
      { kind: 'COOLDOWN', label: 'Cool-down', plannedSeconds: 300 }
    ];
  }
  return goalMinutes && goalMinutes > 0
    ? [{ kind: 'STEADY', label: 'Steady', plannedSeconds: Math.round(goalMinutes) * 60 }]
    : [];
}

interface StartSegment {
  kind: SegmentKind;
  label: string;
  plannedSeconds: number;
}
