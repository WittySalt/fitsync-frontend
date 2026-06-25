import { WorkoutSession } from '../../core/fitsync.models';
import { caloriesLabel, deriveDurationMinutes, isCompletedSession, sessionDurationLabel } from './workout-session.util';

function session(status: string): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Session',
    workoutType: 'STRENGTH',
    status,
    startedAt: '2026-06-18T10:00:00Z',
    completedAt: status === 'COMPLETED' ? '2026-06-18T11:00:00Z' : '',
    durationMinutes: status === 'COMPLETED' ? 60 : 0,
    caloriesBurned: 400,
    exerciseCount: 4
  };
}

describe('isCompletedSession', () => {
  it('returns true only for completed workout sessions', () => {
    expect(isCompletedSession(session('COMPLETED'))).toBeTrue();
    expect(isCompletedSession(session('CANCELLED'))).toBeFalse();
    expect(isCompletedSession(session('IN_PROGRESS'))).toBeFalse();
    expect(isCompletedSession(session('PAUSED'))).toBeFalse();
  });
});

describe('workout session display helpers', () => {
  it('derives duration from start and completion timestamps', () => {
    expect(deriveDurationMinutes('2026-06-18T10:00:00Z', '2026-06-18T10:44:30Z')).toBe(45);
    expect(deriveDurationMinutes('2026-06-18T10:00:00Z', null)).toBeNull();
    expect(deriveDurationMinutes('bad', '2026-06-18T10:44:30Z')).toBeNull();
  });

  it('formats missing duration and calories without fake zeroes', () => {
    expect(
      sessionDurationLabel({
        ...session('COMPLETED'),
        startedAt: '2026-06-18T10:00:00Z',
        completedAt: '2026-06-18T10:45:00Z',
        durationMinutes: null
      })
    ).toBe('45 min');
    expect(sessionDurationLabel({ ...session('IN_PROGRESS'), completedAt: '', durationMinutes: null })).toBe('\u2014');
    expect(caloriesLabel(null)).toBe('\u2014');
    expect(caloriesLabel(320)).toBe('320');
  });
});
