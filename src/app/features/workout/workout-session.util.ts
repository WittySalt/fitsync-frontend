import { WorkoutSession } from '../../core/fitsync.models';

export function isCompletedSession(session: WorkoutSession): boolean {
  return session.status === 'COMPLETED';
}
