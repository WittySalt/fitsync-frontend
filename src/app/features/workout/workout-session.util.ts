import { WorkoutSession } from '../../core/fitsync.models';

export function isCompletedSession(session: WorkoutSession): boolean {
  return session.status === 'COMPLETED';
}

export function deriveDurationMinutes(startedAt: string | null | undefined, completedAt: string | null | undefined): number | null {
  if (!startedAt || !completedAt) {
    return null;
  }

  const started = new Date(startedAt);
  const completed = new Date(completedAt);
  if (Number.isNaN(started.getTime()) || Number.isNaN(completed.getTime())) {
    return null;
  }

  const minutes = Math.round((completed.getTime() - started.getTime()) / 60_000);
  return minutes >= 0 ? minutes : null;
}

export function sessionDurationLabel(session: Pick<WorkoutSession, 'startedAt' | 'completedAt' | 'durationMinutes'>): string {
  const duration = deriveDurationMinutes(session.startedAt, session.completedAt) ?? session.durationMinutes;
  return duration == null ? '\u2014' : `${duration} min`;
}

export function caloriesLabel(value: number | null | undefined): string {
  return value == null ? '\u2014' : String(value);
}
