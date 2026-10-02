import { CookTimerDef } from './cook.models';

/**
 * The timer of one step as a state machine. Every time is a wall-clock moment (`endsAtMs`), never a
 * counter, so a timer keeps its time through a reload and a hidden tab.
 *
 * idle -> running -> (turn -> running ->) done, with pause and resume while running.
 */
export type TimerPhase = 'idle' | 'running' | 'paused' | 'turn' | 'done';

export interface TimerState {
  eachSide: boolean;
  phrase: string;
  /** What the recipe says, for the range note. */
  recipeSeconds: number;
  recipeMaxSeconds: number | null;
  /** The length of one stage, which the stepper changes before the start. */
  stageSeconds: number;
  /** The length of the stage that runs now, with the minutes added to it. */
  totalMs: number;
  /** 0 is the first (or only) stage, 1 the second side. */
  stage: 0 | 1;
  phase: TimerPhase;
  /** While running: the moment the stage ends. */
  endsAtMs: number;
  /** While paused: the time left. */
  remainingMs: number;
}

export type TimerEnd = 'turn' | 'done';

export const MAX_STAGE_SECONDS = 3 * 3600;
const MINUTE_MS = 60_000;

export function createTimer(def: CookTimerDef): TimerState {
  return {
    eachSide: def.eachSide,
    phrase: def.phrase,
    recipeSeconds: def.seconds,
    recipeMaxSeconds: def.maxSeconds,
    stageSeconds: def.seconds,
    totalMs: def.seconds * 1000,
    stage: 0,
    phase: 'idle',
    endsAtMs: 0,
    remainingMs: def.seconds * 1000
  };
}

export function stageCount(state: TimerState): 1 | 2 {
  return state.eachSide ? 2 : 1;
}

/** The stepper moves by a minute, or by half a minute when the recipe's time is not a whole minute. */
export function stepperSeconds(state: TimerState): number {
  return state.recipeSeconds % 60 === 0 ? 60 : 30;
}

/** Changes the length of a stage before it starts; ignored once the timer has begun. */
export function adjustStage(state: TimerState, direction: 1 | -1): TimerState {
  if (state.phase !== 'idle') {
    return state;
  }
  const step = stepperSeconds(state);
  const seconds = Math.min(MAX_STAGE_SECONDS, Math.max(step, state.stageSeconds + direction * step));
  return { ...state, stageSeconds: seconds, totalMs: seconds * 1000, remainingMs: seconds * 1000 };
}

/** Starts the first stage from idle, or the second side from the turn. */
export function startStage(state: TimerState, now: number): TimerState {
  if (state.phase !== 'idle' && state.phase !== 'turn') {
    return state;
  }
  const ms = state.stageSeconds * 1000;
  return {
    ...state,
    stage: state.phase === 'turn' ? 1 : 0,
    phase: 'running',
    totalMs: ms,
    endsAtMs: now + ms,
    remainingMs: ms
  };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  return state.phase === 'running'
    ? { ...state, phase: 'paused', remainingMs: Math.max(0, state.endsAtMs - now) }
    : state;
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  return state.phase === 'paused' ? { ...state, phase: 'running', endsAtMs: now + state.remainingMs } : state;
}

/** Adds a minute to the stage that runs or waits paused. */
export function addMinute(state: TimerState): TimerState {
  if (state.phase === 'running') {
    return { ...state, endsAtMs: state.endsAtMs + MINUTE_MS, totalMs: state.totalMs + MINUTE_MS };
  }
  if (state.phase === 'paused') {
    return { ...state, remainingMs: state.remainingMs + MINUTE_MS, totalMs: state.totalMs + MINUTE_MS };
  }
  return state;
}

/** Moves a running timer to the turn or the end when its time is up. Nothing else changes by itself. */
export function tickTimer(state: TimerState, now: number): { state: TimerState; ended: TimerEnd | null } {
  if (state.phase !== 'running' || now < state.endsAtMs) {
    return { state, ended: null };
  }
  const ended: TimerEnd = state.eachSide && state.stage === 0 ? 'turn' : 'done';
  return { state: { ...state, phase: ended, remainingMs: 0, endsAtMs: 0 }, ended };
}

function remainingMs(state: TimerState, now: number): number {
  switch (state.phase) {
    case 'running':
      return Math.max(0, state.endsAtMs - now);
    case 'paused':
      return state.remainingMs;
    case 'idle':
      return state.stageSeconds * 1000;
    default:
      return 0;
  }
}

/** Whole seconds left in the stage, rounded up so 0:00 shows only when the time is up. */
export function remainingSeconds(state: TimerState, now: number): number {
  return Math.ceil(remainingMs(state, now) / 1000);
}

/** How full the segments are, from 0 to 1: one for a single stage, two for each side. */
export function segmentFills(state: TimerState, now: number): number[] {
  const own = state.totalMs > 0 ? 1 - remainingMs(state, now) / state.totalMs : 0;
  const stage = Math.min(1, Math.max(0, own));
  let first = 0;
  let second = 0;
  if (state.phase === 'turn') {
    first = 1;
  } else if (state.phase === 'done') {
    first = 1;
    second = 1;
  } else if (state.phase === 'running' || state.phase === 'paused') {
    if (state.stage === 0) {
      first = stage;
    } else {
      first = 1;
      second = stage;
    }
  }
  return state.eachSide ? [first, second] : [state.phase === 'done' ? 1 : first];
}

/** True while the timer counts or waits for the cook (running, paused, or time to turn). */
export function isLive(state: TimerState): boolean {
  return state.phase === 'running' || state.phase === 'paused' || state.phase === 'turn';
}

export function stageName(state: TimerState): string | null {
  return state.eachSide ? (state.stage === 0 ? 'First side' : 'Second side') : null;
}
