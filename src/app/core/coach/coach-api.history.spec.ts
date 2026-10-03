import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { CoachApiService, CoachLimitError, limitFromError, toCoachLimit, toThreadPage } from './coach-api.service';

describe('CoachApiService history and idempotency', () => {
  let service: CoachApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CoachApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: () => 'the-token' } }
      ]
    });
    service = TestBed.inject(CoachApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends the client turn id as a header and a body field on the plain message', () => {
    service.sendMessage('t1', 'Hi', undefined, 'turn-1').subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads/t1/messages');
    expect(request.request.headers.get('Idempotency-Key')).toBe('turn-1');
    expect(request.request.body).toEqual({ message: 'Hi', clientTurnId: 'turn-1' });
    request.flush({ threadId: 't1', turnId: 'u1', answer: 'Yes.', tier: 2, toolsUsed: [], latencyMs: 10 });
  });

  it('sends the client turn id on the stream too', () => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('no network in test')));
    const subscription = service.streamMessage('t1', 'Hi', undefined, 'turn-1').subscribe({ error: () => {} });

    const [, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('turn-1');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'Hi', clientTurnId: 'turn-1' });
    subscription.unsubscribe();
  });

  it('turns a 429 on the stream into a limit error carrying the server message', async () => {
    const body = { code: 'COACH_LIMIT', retryAfterSeconds: 90, message: 'Try again in 2 minutes.' };
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(body), { status: 429 }));

    const failure = await new Promise<unknown>((resolve) => service.streamMessage('t1', 'Hi').subscribe({ error: resolve }));

    expect(failure instanceof CoachLimitError).toBeTrue();
    expect(limitFromError(failure)).toEqual({ message: 'Try again in 2 minutes.', retryAfterSeconds: 90 });
  });

  it('still reports a 429 with no readable body, with a plain sentence and a one minute wait', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 429 }));

    const failure = await new Promise<unknown>((resolve) => service.streamMessage('t1', 'Hi').subscribe({ error: resolve }));

    expect(limitFromError(failure)?.retryAfterSeconds).toBe(60);
    expect(limitFromError(failure)?.message).toContain('limit');
  });

  it('requests a page of history and maps the list rows', () => {
    let page: ReturnType<typeof toThreadPage> | undefined;
    service.listThreadPage(1, 20).subscribe((p) => (page = p));

    const request = httpTesting.expectOne((r) => r.url === '/api/v1/coach/threads');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({
      content: [{ id: 'x', title: 'Chest day', surface: 'workout', lastMessageAt: '2026-10-02T10:00:00Z', turnCount: 4 }],
      last: false
    });

    expect(page?.items).toEqual([{ threadId: 'x', title: 'Chest day', surface: 'WORKOUT', lastMessageAt: '2026-10-02T10:00:00Z', turnCount: 4 }]);
    expect(page?.hasMore).toBeTrue();
  });

  it('archives a thread with DELETE', () => {
    service.archiveThread('t1').subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads/t1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('fills in a thread id the detail body leaves out', () => {
    let id = '';
    service.getThread('t9').subscribe((detail) => (id = detail.thread.threadId));

    httpTesting.expectOne('/api/v1/coach/threads/t9').flush({ thread: { id: 't9', title: 'x' }, turns: [{ turnId: 'a', role: 'USER', content: 'q' }] });

    expect(id).toBe('t9');
  });
});

describe('toThreadPage', () => {
  it('reads a bare array and treats a full page as having more', () => {
    const rows = [{ threadId: 'a' }, { threadId: 'b' }];
    expect(toThreadPage(rows, 0, 2).hasMore).toBeTrue();
    expect(toThreadPage(rows, 0, 5).hasMore).toBeFalse();
  });

  it('reads totalPages, and drops rows without an id and unknown surfaces', () => {
    const page = toThreadPage({ content: [{ threadId: 'a', surface: 'MOON' }, { title: 'no id' }], totalPages: 3 }, 1, 20);
    expect(page.items).toEqual([{ threadId: 'a', title: null, surface: null, lastMessageAt: null, turnCount: 0 }]);
    expect(page.hasMore).toBeTrue();
  });

  it('survives garbage', () => {
    expect(toThreadPage(null, 0, 20)).toEqual({ items: [], page: 0, hasMore: false });
  });
});

describe('toCoachLimit', () => {
  it('rounds the wait up and clamps absurd ones', () => {
    expect(toCoachLimit({ retryAfterSeconds: 1.2, message: 'm' }).retryAfterSeconds).toBe(2);
    expect(toCoachLimit({ retryAfterSeconds: -5 }).retryAfterSeconds).toBe(1);
    expect(toCoachLimit({ retryAfterSeconds: 9e9 }).retryAfterSeconds).toBe(86400);
  });

  it('is null for an error that is not a limit', () => {
    expect(limitFromError({ status: 500 })).toBeNull();
    expect(limitFromError(new Error('x'))).toBeNull();
  });
});
