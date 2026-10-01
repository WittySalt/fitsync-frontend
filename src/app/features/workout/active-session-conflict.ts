import { HttpErrorResponse } from '@angular/common/http';

import { ActiveSessionConflict } from '../../core/fitsync.models';

export const ACTIVE_SESSION_EXISTS = 'ACTIVE_SESSION_EXISTS';

/**
 * Reads the refusal a start gets when a workout is already in progress: a 409 whose body carries
 * the code and, in `data`, the session that is in the way. Anything else gives null.
 */
export function activeSessionConflictFrom(error: unknown): ActiveSessionConflict | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return null;
  }
  const body = error.error as { code?: unknown; data?: Record<string, unknown> | null } | null;
  if (body?.code !== ACTIVE_SESSION_EXISTS) {
    return null;
  }
  const data = body.data ?? {};
  return {
    sessionId: typeof data['sessionId'] === 'string' ? data['sessionId'] : '',
    name: typeof data['name'] === 'string' && data['name'] ? data['name'] : 'Workout',
    startedAt: typeof data['startedAt'] === 'string' ? data['startedAt'] : ''
  };
}
