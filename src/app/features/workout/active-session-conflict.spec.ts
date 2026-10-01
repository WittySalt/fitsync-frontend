import { HttpErrorResponse } from '@angular/common/http';

import { activeSessionConflictFrom } from './active-session-conflict';

describe('activeSessionConflictFrom', () => {
  it('reads the session in the way from a 409 with the code', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { code: 'ACTIVE_SESSION_EXISTS', data: { sessionId: 'session-1', name: 'Leg day', startedAt: '2026-10-01T10:00:00Z' } }
    });

    expect(activeSessionConflictFrom(error)).toEqual({
      sessionId: 'session-1',
      name: 'Leg day',
      startedAt: '2026-10-01T10:00:00Z'
    });
  });

  it('copes with a body that has the code but no data', () => {
    const error = new HttpErrorResponse({ status: 409, error: { code: 'ACTIVE_SESSION_EXISTS' } });

    expect(activeSessionConflictFrom(error)).toEqual({ sessionId: '', name: 'Workout', startedAt: '' });
  });

  it('gives null for any other error', () => {
    expect(activeSessionConflictFrom(new HttpErrorResponse({ status: 409, error: { code: 'SOMETHING_ELSE' } }))).toBeNull();
    expect(activeSessionConflictFrom(new HttpErrorResponse({ status: 500, error: { code: 'ACTIVE_SESSION_EXISTS' } }))).toBeNull();
    expect(activeSessionConflictFrom(new HttpErrorResponse({ status: 409, error: null }))).toBeNull();
    expect(activeSessionConflictFrom(new Error('boom'))).toBeNull();
    expect(activeSessionConflictFrom(null)).toBeNull();
  });
});
