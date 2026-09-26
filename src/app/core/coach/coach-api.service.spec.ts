import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { CoachApiService, toStreamEvent } from './coach-api.service';

describe('CoachApiService', () => {
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

  it('lists recommendations', () => {
    service.listRecommendations().subscribe();

    const request = httpTesting.expectOne('/api/v1/recommendations');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates a thread with an empty body when no title is given', () => {
    service.createThread().subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ threadId: 't1', title: null, turnCount: 0, lastActiveAt: '', createdAt: '' });
  });

  it('sends a plain message on a thread', () => {
    service.sendMessage('t1', 'Should I train today?').subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads/t1/messages');
    expect(request.request.body).toEqual({ message: 'Should I train today?' });
    request.flush({ threadId: 't1', turnId: 'u1', answer: 'Yes.', tier: 2, toolsUsed: [], latencyMs: 10 });
  });

  it('drafts a session, carrying the thread when one is given', () => {
    service.draftSession('chest', 't1').subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/session-drafts?threadId=t1');
    expect(request.request.body).toEqual({ request: 'chest' });
    request.flush({});
  });

  it('accepts and rejects a draft by its artifact id', () => {
    service.acceptSessionDraft('a1').subscribe();
    httpTesting.expectOne('/api/v1/coach/session-drafts/a1/accept').flush({});

    service.rejectSessionDraft('a1', 'too long').subscribe();
    const reject = httpTesting.expectOne('/api/v1/coach/session-drafts/a1/reject');
    expect(reject.request.body).toEqual({ reason: 'too long' });
    reject.flush({});
  });
});

describe('toStreamEvent', () => {
  it('types the progress events by name', () => {
    const event = toStreamEvent('tool_finished', '{"kind":"TOOL_FINISHED","tool":"readFacts","summary":"7 fact groups","latencyMs":4}');

    expect(event).toEqual({
      name: 'tool_finished',
      data: { kind: 'TOOL_FINISHED', tool: 'readFacts', summary: '7 fact groups', latencyMs: 4 }
    });
  });

  it('parses the answer as the message response', () => {
    const event = toStreamEvent('answer', '{"threadId":"t","turnId":"u","answer":"Yes.","tier":2,"toolsUsed":["readFacts"],"latencyMs":9}');

    expect(event?.name).toBe('answer');
    expect(event && event.name === 'answer' ? event.data.answer : null).toBe('Yes.');
  });

  it('unwraps the error text from its JSON string literal', () => {
    expect(toStreamEvent('error', '"The coach could not finish that turn."')).toEqual({
      name: 'error',
      data: 'The coach could not finish that turn.'
    });
  });

  it('drops event names the contract does not define', () => {
    expect(toStreamEvent('heartbeat', '{}')).toBeNull();
  });
});
