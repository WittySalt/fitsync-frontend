import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { defer, firstValueFrom, Observable, Subject } from 'rxjs';

import { authTokenInterceptor } from '../auth-token.interceptor';
import { AUTH_STORAGE_KEYS } from './auth.config';
import {
  AUTH_LOGOUT_URL,
  AUTH_REFRESH_LOCK,
  AUTH_REFRESH_URL,
  AuthService,
  RefreshLock,
  SessionEndedError,
  webLocksRefreshLock
} from './auth.service';

const passthroughLock: RefreshLock = <T>(work: () => Observable<T>) => defer(work);

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function storeSession(accessToken: string, refreshToken: string | null, expiresInMs = 10 * 60_000): void {
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, accessToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() + expiresInMs));
  if (refreshToken) {
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, refreshToken);
  }
}

function unauthorized(request: TestRequest, code?: string): void {
  request.flush(
    code ? { status: 401, code, message: 'Unauthorized' } : { message: 'Unauthorized' },
    { status: 401, statusText: 'Unauthorized' }
  );
}

function flushRefresh(request: TestRequest, accessToken: string, refreshToken: string): void {
  request.flush({ accessToken, refreshToken, accessTokenExpiresAt: inMinutes(15), sessionId: 'session-1' });
}

describe('AuthService session refresh', () => {
  let service: AuthService;
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let navigateToLogin: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_REFRESH_LOCK, useValue: passthroughLock }
      ]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    navigateToLogin = spyOn(service, 'navigateToLogin').and.stub();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('shares one refresh call between concurrent requests and retries each of them once', () => {
    storeSession('old-access', 'refresh-1');
    const results: string[] = [];

    http.get<string>('/api/v1/workouts').subscribe((value) => results.push(value));
    http.get<string>('/api/v1/meals').subscribe((value) => results.push(value));
    unauthorized(httpMock.expectOne('/api/v1/workouts'), 'SESSION_EXPIRED');
    unauthorized(httpMock.expectOne('/api/v1/meals'));

    const refresh = httpMock.expectOne(AUTH_REFRESH_URL);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(refresh.request.headers.has('Authorization')).toBeFalse();
    flushRefresh(refresh, 'new-access', 'refresh-2');

    const workouts = httpMock.expectOne('/api/v1/workouts');
    const meals = httpMock.expectOne('/api/v1/meals');
    expect(workouts.request.headers.get('Authorization')).toBe('Bearer new-access');
    expect(meals.request.headers.get('Authorization')).toBe('Bearer new-access');
    workouts.flush('workouts');
    meals.flush('meals');

    expect(results).toEqual(['workouts', 'meals']);
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe('new-access');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBe('refresh-2');
  });

  it('refreshes an expired token once before sending concurrent requests', () => {
    storeSession('expired-access', 'refresh-1', -1000);

    http.get('/api/v1/workouts').subscribe();
    http.get('/api/v1/meals').subscribe();

    flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'new-access', 'refresh-2');
    expect(httpMock.expectOne('/api/v1/workouts').request.headers.get('Authorization')).toBe('Bearer new-access');
    expect(httpMock.expectOne('/api/v1/meals').request.headers.get('Authorization')).toBe('Bearer new-access');
  });

  it('retries the original request after a refresh and returns its response', () => {
    storeSession('old-access', 'refresh-1');
    let response: { ok: boolean } | undefined;

    http.get<{ ok: boolean }>('/api/v1/analytics/dashboard').subscribe((value) => (response = value));
    unauthorized(httpMock.expectOne('/api/v1/analytics/dashboard'), 'SESSION_EXPIRED');
    flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'new-access', 'refresh-2');

    const retry = httpMock.expectOne('/api/v1/analytics/dashboard');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access');
    retry.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt))).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it('sends a remotely signed-out device to sign-in with the revoked message and does not refresh', () => {
    storeSession('old-access', 'refresh-1');
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id');
    let failure: HttpErrorResponse | undefined;

    http.get('/api/v1/workouts').subscribe({ error: (error: HttpErrorResponse) => (failure = error) });
    unauthorized(httpMock.expectOne('/api/v1/workouts'), 'SESSION_REVOKED');

    httpMock.expectNone(AUTH_REFRESH_URL);
    expect(failure?.status).toBe(401);
    expect(navigateToLogin).toHaveBeenCalledOnceWith('revoked');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken)).toBeNull();
  });

  it('ends the session as revoked when the refresh is refused with SESSION_REVOKED', () => {
    storeSession('old-access', 'refresh-1');
    let failure: unknown;

    http.get('/api/v1/workouts').subscribe({ error: (error: unknown) => (failure = error) });
    unauthorized(httpMock.expectOne('/api/v1/workouts'));
    unauthorized(httpMock.expectOne(AUTH_REFRESH_URL), 'SESSION_REVOKED');

    expect((failure as HttpErrorResponse).status).toBe(401);
    expect(navigateToLogin).toHaveBeenCalledOnceWith('revoked');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it('ends the session as expired when the refresh is refused with SESSION_EXPIRED', (done) => {
    storeSession('old-access', 'refresh-1');

    service.refreshAccessToken('old-access').subscribe({
      next: () => done.fail('the refresh should fail'),
      error: (error: unknown) => {
        expect(error).toEqual(jasmine.any(SessionEndedError));
        expect((error as SessionEndedError).reason).toBe('expired');
        expect(navigateToLogin).toHaveBeenCalledOnceWith('expired');
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
        done();
      }
    });
    unauthorized(httpMock.expectOne(AUTH_REFRESH_URL), 'SESSION_EXPIRED');
  });

  it('does not loop when the refresh itself fails', () => {
    storeSession('old-access', 'refresh-1');
    const failures: unknown[] = [];

    http.get('/api/v1/workouts').subscribe({ error: (error: unknown) => failures.push(error) });
    http.get('/api/v1/meals').subscribe({ error: (error: unknown) => failures.push(error) });
    unauthorized(httpMock.expectOne('/api/v1/workouts'));
    unauthorized(httpMock.expectOne('/api/v1/meals'));
    unauthorized(httpMock.expectOne(AUTH_REFRESH_URL), 'SESSION_EXPIRED');

    // No second refresh and no retry: verify() in afterEach fails on any outstanding request.
    httpMock.expectNone(AUTH_REFRESH_URL);
    httpMock.expectNone('/api/v1/workouts');
    expect(failures.length).toBe(2);
    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('keeps the tokens when the refresh fails for a reason other than 401', () => {
    storeSession('old-access', 'refresh-1');
    let failure: HttpErrorResponse | undefined;

    http.get('/api/v1/workouts').subscribe({ error: (error: HttpErrorResponse) => (failure = error) });
    unauthorized(httpMock.expectOne('/api/v1/workouts'));
    httpMock.expectOne(AUTH_REFRESH_URL).flush('down', { status: 503, statusText: 'Unavailable' });

    expect(failure?.status).toBe(401);
    expect(navigateToLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBe('refresh-1');
  });

  it('retries only once when the retried request is refused again', () => {
    storeSession('old-access', 'refresh-1');
    let failure: HttpErrorResponse | undefined;

    http.get('/api/v1/workouts').subscribe({ error: (error: HttpErrorResponse) => (failure = error) });
    unauthorized(httpMock.expectOne('/api/v1/workouts'));
    flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'new-access', 'refresh-2');
    unauthorized(httpMock.expectOne('/api/v1/workouts'));

    httpMock.expectNone(AUTH_REFRESH_URL);
    expect(failure?.status).toBe(401);
  });

  it('uses the token another tab already stored instead of spending the rotated refresh token', () => {
    storeSession('old-access', 'refresh-1');
    let response: string | undefined;

    http.get<string>('/api/v1/workouts').subscribe((value) => (response = value));
    const first = httpMock.expectOne('/api/v1/workouts');
    // Another tab refreshes while this request is on its way.
    storeSession('other-tab-access', 'refresh-2', 15 * 60_000);
    unauthorized(first);

    httpMock.expectNone(AUTH_REFRESH_URL);
    const retry = httpMock.expectOne('/api/v1/workouts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer other-tab-access');
    retry.flush('ok');
    expect(response).toBe('ok');
  });

  it('uses the token another tab stored when its own refresh lost the rotation race', () => {
    storeSession('old-access', 'refresh-1');
    let response: string | undefined;

    http.get<string>('/api/v1/workouts').subscribe((value) => (response = value));
    unauthorized(httpMock.expectOne('/api/v1/workouts'));
    const refresh = httpMock.expectOne(AUTH_REFRESH_URL);
    // The other tab spent refresh-1 first, so the server refuses this call.
    storeSession('other-tab-access', 'refresh-2', 15 * 60_000);
    unauthorized(refresh, 'SESSION_EXPIRED');

    expect(navigateToLogin).not.toHaveBeenCalled();
    const retry = httpMock.expectOne('/api/v1/workouts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer other-tab-access');
    retry.flush('ok');
    expect(response).toBe('ok');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBe('refresh-2');
  });

  it('refreshes about a minute before the access token expires', fakeAsync(() => {
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id');
    service.ensureSession().subscribe();
    httpMock.expectOne('/api/v1/auth/bootstrap').flush({
      accessToken: 'boot-access',
      tokenType: 'Bearer',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: new Date(Date.now() + 3 * 60_000).toISOString(),
      sessionId: 'session-1'
    });

    tick(2 * 60_000 - 1000);
    httpMock.expectNone(AUTH_REFRESH_URL);
    tick(1000);
    const refresh = httpMock.expectOne(AUTH_REFRESH_URL);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    flushRefresh(refresh, 'timer-access', 'refresh-2');

    expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe('timer-access');
    service.completeLogout();
  }));

  it('sends a short device label with the bootstrap call', () => {
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id');
    service.ensureSession().subscribe();

    const bootstrap = httpMock.expectOne('/api/v1/auth/bootstrap');
    const label = bootstrap.request.headers.get('X-Device-Label');
    expect(label).toBeTruthy();
    expect(label!.length).toBeLessThanOrEqual(60);
    bootstrap.flush({ accessToken: 'boot-access', tokenType: 'Bearer' });
  });

  describe('with an older backend that sends no refresh token', () => {
    it('stores no refresh token, plans no refresh, and lets a 401 reach the caller', fakeAsync(() => {
      localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id');
      service.ensureSession().subscribe();
      httpMock.expectOne('/api/v1/auth/bootstrap').flush({ accessToken: 'boot-access', tokenType: 'Bearer' });

      expect(service.hasRefreshToken()).toBeFalse();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe('boot-access');

      let failure: HttpErrorResponse | undefined;
      http.get('/api/v1/workouts').subscribe({ error: (error: HttpErrorResponse) => (failure = error) });
      unauthorized(httpMock.expectOne('/api/v1/workouts'));
      expect(failure?.status).toBe(401);

      tick(3 * 60 * 60_000);
      httpMock.expectNone(AUTH_REFRESH_URL);
      expect(navigateToLogin).not.toHaveBeenCalled();
    }));
  });

  describe('logout', () => {
    it('revokes the session on the server and then clears local state', () => {
      storeSession('old-access', 'refresh-1');
      localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id');

      service.logout();
      const logout = httpMock.expectOne(AUTH_LOGOUT_URL);
      expect(logout.request.method).toBe('POST');
      expect(logout.request.headers.get('Authorization')).toBe('Bearer old-access');
      expect(navigateToLogin).not.toHaveBeenCalled();
      logout.flush(null, { status: 204, statusText: 'No Content' });

      expect(navigateToLogin).toHaveBeenCalledOnceWith();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken)).toBeNull();
    });

    it('clears local state even when the logout call fails, without refreshing', () => {
      storeSession('old-access', 'refresh-1');

      service.logout();
      unauthorized(httpMock.expectOne(AUTH_LOGOUT_URL), 'SESSION_EXPIRED');

      httpMock.expectNone(AUTH_REFRESH_URL);
      expect(navigateToLogin).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
    });

    it('refreshes an expired token first so the server revokes the session', () => {
      storeSession('expired-access', 'refresh-1', -1000);

      service.logout();
      const refresh = httpMock.expectOne(AUTH_REFRESH_URL);
      httpMock.expectNone(AUTH_LOGOUT_URL);
      flushRefresh(refresh, 'fresh-access', 'refresh-2');

      const logout = httpMock.expectOne(AUTH_LOGOUT_URL);
      expect(logout.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      logout.flush(null, { status: 204, statusText: 'No Content' });

      expect(navigateToLogin).toHaveBeenCalledOnceWith();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
    });

    it('refreshes a token that expires within a minute before logging out', () => {
      storeSession('soon-access', 'refresh-1', 30_000);

      service.logout();
      flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'fresh-access', 'refresh-2');
      const logout = httpMock.expectOne(AUTH_LOGOUT_URL);
      expect(logout.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      logout.flush(null, { status: 204, statusText: 'No Content' });
      expect(navigateToLogin).toHaveBeenCalledOnceWith();
    });

    it('shares the refresh already in flight instead of starting a second one', () => {
      storeSession('expired-access', 'refresh-1', -1000);

      service.refreshAccessToken('expired-access').subscribe();
      service.logout();

      flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'fresh-access', 'refresh-2');
      httpMock.expectOne(AUTH_LOGOUT_URL).flush(null, { status: 204, statusText: 'No Content' });
      expect(navigateToLogin).toHaveBeenCalledOnceWith();
    });

    it('signs out without the session-ended message when the refresh is refused', () => {
      storeSession('expired-access', 'refresh-1', -1000);

      service.logout();
      unauthorized(httpMock.expectOne(AUTH_REFRESH_URL), 'SESSION_EXPIRED');

      httpMock.expectNone(AUTH_LOGOUT_URL);
      expect(navigateToLogin).toHaveBeenCalledOnceWith();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
    });

    it('signs out after three seconds when the refresh does not answer, and ignores its late answer', fakeAsync(() => {
      storeSession('expired-access', 'refresh-1', -1000);

      service.logout();
      const refresh = httpMock.expectOne(AUTH_REFRESH_URL);
      tick(2999);
      expect(navigateToLogin).not.toHaveBeenCalled();
      tick(1);

      expect(navigateToLogin).toHaveBeenCalledOnceWith();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();

      flushRefresh(refresh, 'late-access', 'refresh-2');
      httpMock.expectNone(AUTH_LOGOUT_URL);
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
    }));

    it('caps the refresh and the logout call together at three seconds', fakeAsync(() => {
      storeSession('expired-access', 'refresh-1', -1000);

      service.logout();
      tick(2000);
      flushRefresh(httpMock.expectOne(AUTH_REFRESH_URL), 'fresh-access', 'refresh-2');
      httpMock.expectOne(AUTH_LOGOUT_URL);
      tick(1000);

      expect(navigateToLogin).toHaveBeenCalledOnceWith();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
    }));

    it('signs out locally without a call when there is no token', () => {
      service.logout();

      httpMock.expectNone(AUTH_LOGOUT_URL);
      expect(navigateToLogin).toHaveBeenCalledTimes(1);
    });
  });
});

describe('webLocksRefreshLock', () => {
  it('runs one refresh at a time across callers', async () => {
    const order: string[] = [];
    const firstGate = new Subject<string>();

    const first = firstValueFrom(
      webLocksRefreshLock(() => {
        order.push('first started');
        return firstGate;
      })
    );
    const second = firstValueFrom(
      webLocksRefreshLock(() => {
        order.push('second started');
        return defer(async () => 'second');
      })
    );

    // Lock grants are asynchronous, so wait for the first holder instead of a fixed delay.
    for (let attempt = 0; attempt < 200 && order.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(order).toEqual(['first started']);

    firstGate.next('first');
    firstGate.complete();

    await expectAsync(first).toBeResolvedTo('first');
    await expectAsync(second).toBeResolvedTo('second');
    expect(order).toEqual(['first started', 'second started']);
  });
});
