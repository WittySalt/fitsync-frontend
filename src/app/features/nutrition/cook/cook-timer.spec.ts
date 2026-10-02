import { CookTimerDef } from './cook.models';
import {
  TimerState,
  addMinute,
  createTimer,
  isLive,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  segmentFills,
  setRemaining,
  stageName,
  startStage,
  tickTimer
} from './cook-timer';

const sides: CookTimerDef = { seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' };
const single: CookTimerDef = { seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' };
const T0 = 1_000_000;

describe('cook timer state machine', () => {
  it('starts idle with the length of the recipe', () => {
    const state = createTimer(sides);
    expect(state.phase).toBe('idle');
    expect(remainingSeconds(state, T0)).toBe(180);
    expect(isLive(state)).toBeFalse();
  });

  it('counts down on the wall clock', () => {
    const state = startStage(createTimer(sides), T0);
    expect(state.phase).toBe('running');
    expect(remainingSeconds(state, T0 + 61_000)).toBe(119);
    expect(remainingSeconds(state, T0 + 180_000)).toBe(0);
    expect(tickTimer(state, T0 + 100).ended).toBeNull();
  });

  it('goes to the turn after the first side and waits there', () => {
    const state = startStage(createTimer(sides), T0);
    const result = tickTimer(state, T0 + 180_000);
    expect(result.ended).toBe('turn');
    expect(result.state.phase).toBe('turn');
    expect(isLive(result.state)).toBeTrue();
    expect(tickTimer(result.state, T0 + 999_999).ended).toBeNull();
    expect(segmentFills(result.state, T0)).toEqual([1, 0]);
  });

  it('starts the second side only when asked, then finishes', () => {
    const turn = tickTimer(startStage(createTimer(sides), T0), T0 + 180_000).state;
    const second = startStage(turn, T0 + 200_000);
    expect(second.phase).toBe('running');
    expect(second.stage).toBe(1);
    expect(stageName(second)).toBe('Second side');
    expect(segmentFills(second, T0 + 200_000 + 90_000)).toEqual([1, 0.5]);
    const done = tickTimer(second, T0 + 200_000 + 180_000);
    expect(done.ended).toBe('done');
    expect(segmentFills(done.state, T0)).toEqual([1, 1]);
    expect(isLive(done.state)).toBeFalse();
  });

  it('finishes a single stage without a turn', () => {
    const result = tickTimer(startStage(createTimer(single), T0), T0 + 600_000);
    expect(result.ended).toBe('done');
    expect(segmentFills(result.state, T0)).toEqual([1]);
    expect(stageName(result.state)).toBeNull();
  });

  it('pauses with the time left and resumes from it', () => {
    const running = startStage(createTimer(single), T0);
    const paused = pauseTimer(running, T0 + 100_000);
    expect(paused.phase).toBe('paused');
    expect(remainingSeconds(paused, T0 + 500_000)).toBe(500);
    expect(tickTimer(paused, T0 + 9_000_000).ended).toBeNull();
    const resumed = resumeTimer(paused, T0 + 500_000);
    expect(remainingSeconds(resumed, T0 + 500_000)).toBe(500);
    expect(remainingSeconds(resumed, T0 + 560_000)).toBe(440);
  });

  it('adds a minute while running or paused and keeps the bar honest', () => {
    const running = startStage(createTimer(sides), T0);
    const more = addMinute(running);
    expect(remainingSeconds(more, T0)).toBe(240);
    expect(segmentFills(more, T0)[0]).toBe(0);
    const paused = addMinute(pauseTimer(running, T0 + 60_000));
    expect(remainingSeconds(paused, T0)).toBe(180);
    const idle = createTimer(sides);
    expect(addMinute(idle)).toBe(idle);
  });

  it('ignores actions that do not fit the phase', () => {
    const idle = createTimer(sides);
    expect(pauseTimer(idle, T0)).toBe(idle);
    expect(resumeTimer(idle, T0)).toBe(idle);
    const running = startStage(idle, T0);
    expect(startStage(running, T0 + 5)).toBe(running);
  });

  it('shows no fill while idle', () => {
    expect(segmentFills(createTimer(sides), T0)).toEqual([0, 0]);
    expect(segmentFills(createTimer(single), T0)).toEqual([0]);
  });

  it('survives a JSON round trip, which is how a reload keeps it', () => {
    const running: TimerState = startStage(createTimer(sides), T0);
    const restored = JSON.parse(JSON.stringify(running)) as TimerState;
    expect(remainingSeconds(restored, T0 + 30_000)).toBe(150);
  });

  it('sets the time left of a running or paused timer and the length of one not started, and leaves a finished one alone', () => {
    const running = startStage(createTimer(single), T0);
    const moved = setRemaining(running, T0 + 60_000, 120);
    expect(remainingSeconds(moved, T0 + 60_000)).toBe(120);
    expect(moved.phase).toBe('running');
    const paused = setRemaining(pauseTimer(running, T0 + 1000), T0 + 2000, 300);
    expect(remainingSeconds(paused, T0 + 2000)).toBe(300);
    expect(paused.phase).toBe('paused');
    const idle = setRemaining(createTimer(single), T0, 5400);
    expect(idle.stageSeconds).toBe(5400);
    expect(idle.phase).toBe('idle');
    expect(remainingSeconds(idle, T0)).toBe(5400);
    expect(startStage(idle, T0).endsAtMs).toBe(T0 + 5_400_000);
    const done = { ...createTimer(single), phase: 'done' as const };
    expect(setRemaining(done, T0, 60)).toBe(done);
    expect(remainingSeconds(setRemaining(running, T0, 999_999), T0)).toBe(12 * 3600);
  });
});
