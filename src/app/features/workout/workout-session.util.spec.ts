import { WorkoutSession } from '../../core/fitsync.models';
import { isCompletedSession } from './workout-session.util';

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
