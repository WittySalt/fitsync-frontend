import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DeviceSession, SessionsApiService } from './sessions-api.service';

describe('SessionsApiService', () => {
  let service: SessionsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SessionsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists sessions and drops entries without a session id', () => {
    let sessions: DeviceSession[] | undefined;
    service.list().subscribe((value) => (sessions = value));

    httpMock.expectOne('/api/v1/auth/sessions').flush({
      sessions: [
        { sessionId: 's1', deviceLabel: 'Chrome on Windows', createdAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-09T00:00:00Z', current: true },
        { deviceLabel: 'broken' }
      ]
    });

    expect(sessions).toEqual([
      { sessionId: 's1', deviceLabel: 'Chrome on Windows', createdAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-09T00:00:00Z', current: true }
    ]);
  });

  it('revokes one session by its encoded id', () => {
    service.revoke('a/b').subscribe();
    const request = httpMock.expectOne('/api/v1/auth/sessions/a%2Fb');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('revokes the other sessions and reads the revoked count', () => {
    let count: number | null | undefined;
    service.revokeOthers().subscribe((value) => (count = value));

    const request = httpMock.expectOne((req) => req.url === '/api/v1/auth/sessions' && req.params.get('scope') === 'others');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content', headers: { 'X-Revoked-Count': '3' } });

    expect(count).toBe(3);
  });

  it('reports a missing count as null', () => {
    let count: number | null | undefined;
    service.revokeOthers().subscribe((value) => (count = value));
    httpMock.expectOne((req) => req.url === '/api/v1/auth/sessions').flush(null, { status: 204, statusText: 'No Content' });
    expect(count).toBeNull();
  });
});
