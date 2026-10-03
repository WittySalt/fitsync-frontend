import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { CoachApiService, toCoachReading, toStreamEvent } from './coach-api.service';

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

  it('asks for a page reading with the surface in the path and no timezone parameter', () => {
    let status = '';
    service.getReading('WORKOUT').subscribe((reading) => (status = reading.status));

    const request = httpTesting.expectOne((candidate) => candidate.url === '/api/v1/coach/readings/workout');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('timezone')).toBeFalse();
    request.flush({ surface: 'WORKOUT', status: 'RESTING', facts: [], lifts: [] });
    expect(status).toBe('RESTING');
  });

  it('passes a failed reading request on to the caller', () => {
    let failed = false;
    service.getReading('WORKOUT').subscribe({ error: () => (failed = true) });

    httpTesting.expectOne((candidate) => candidate.url === '/api/v1/coach/readings/workout').flush('down', { status: 503, statusText: 'Unavailable' });
    expect(failed).toBeTrue();
  });

  it('creates a thread with an empty body when no title is given', () => {
    service.createThread().subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ threadId: 't1', title: null, turnCount: 0, lastActiveAt: '', createdAt: '' });
  });

  it('sends a plain message on a thread with no context, exactly as before', () => {
    service.sendMessage('t1', 'Should I train today?').subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads/t1/messages');
    expect(request.request.body).toEqual({ message: 'Should I train today?' });
    request.flush({ threadId: 't1', turnId: 'u1', answer: 'Yes.', tier: 2, toolsUsed: [], latencyMs: 10 });
  });

  it('carries the context when the caller gives one', () => {
    service.sendMessage('t1', 'Should my core get a day off?', { surface: 'WORKOUT', readingId: 'r1' }).subscribe();

    const request = httpTesting.expectOne('/api/v1/coach/threads/t1/messages');
    expect(request.request.body).toEqual({
      message: 'Should my core get a day off?',
      context: { surface: 'WORKOUT', readingId: 'r1' }
    });
    request.flush({ threadId: 't1', turnId: 'u1', answer: 'No.', tier: 2, toolsUsed: [], latencyMs: 10 });
  });

  it('treats a missing pinnedReadingId from an older server as null', () => {
    let response: { pinnedReadingId: string | null } | undefined;
    service.sendMessage('t1', 'Should I train today?').subscribe((r) => (response = r));

    httpTesting
      .expectOne('/api/v1/coach/threads/t1/messages')
      .flush({ threadId: 't1', turnId: 'u1', answer: 'Yes.', tier: 2, toolsUsed: [], latencyMs: 10 });

    expect(response?.pinnedReadingId).toBeNull();
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

describe('CoachApiService.streamMessage', () => {
  let service: CoachApiService;

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
  });

  // The stream cannot go through HttpTestingController: it is built on fetch, not HttpClient. The
  // request body is observed the same way the service builds it, by reading what was handed to fetch.
  function bodySentTo(fetchSpy: jasmine.Spy): unknown {
    const [, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    return JSON.parse(init.body as string);
  }

  it('opens the stream with no context in the body when none is given, exactly as before', () => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('no network in test')));
    const subscription = service.streamMessage('t1', 'Should I train today?').subscribe({ error: () => {} });

    expect(bodySentTo(fetchSpy)).toEqual({ message: 'Should I train today?' });
    subscription.unsubscribe();
  });

  it('carries the context in the stream body when the caller gives one', () => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('no network in test')));
    const subscription = service
      .streamMessage('t1', 'Should my core get a day off?', { surface: 'WORKOUT', readingId: 'r1' })
      .subscribe({ error: () => {} });

    expect(bodySentTo(fetchSpy)).toEqual({
      message: 'Should my core get a day off?',
      context: { surface: 'WORKOUT', readingId: 'r1' }
    });
    subscription.unsubscribe();
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

  it('defaults a missing pinnedReadingId on the answer to null', () => {
    const event = toStreamEvent('answer', '{"threadId":"t","turnId":"u","answer":"Yes.","tier":2,"toolsUsed":["readFacts"],"latencyMs":9}');
    expect(event && event.name === 'answer' ? event.data.pinnedReadingId : undefined).toBeNull();
  });

  it('keeps the pinnedReadingId on the answer when the server sends one', () => {
    const event = toStreamEvent(
      'answer',
      '{"threadId":"t","turnId":"u","answer":"Yes.","tier":2,"toolsUsed":["readFacts"],"latencyMs":9,"pinnedReadingId":"r1"}'
    );
    expect(event && event.name === 'answer' ? event.data.pinnedReadingId : undefined).toBe('r1');
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

describe('toCoachReading', () => {
  it('treats a missing or unknown answer as empty', () => {
    expect(toCoachReading('WORKOUT', null).status).toBe('EMPTY');
    expect(toCoachReading('WORKOUT', { status: 'DONE' as never }).status).toBe('EMPTY');
    expect(toCoachReading('WORKOUT', {}).facts).toEqual([]);
    expect(toCoachReading('WORKOUT', {}).lifts).toEqual([]);
  });

  it('shows facts only when a ready answer arrives without its text', () => {
    const reading = toCoachReading('WORKOUT', { status: 'READY', reading: { headline: ' ', body: '', citations: [], source: 'MODEL', generatedAt: null } });
    expect(reading.status).toBe('RESTING');
    expect(reading.reading).toBeNull();
  });

  it('fills in what a fact leaves out and drops a fact without a number or a value', () => {
    const reading = toCoachReading('WORKOUT', {
      status: 'RESTING',
      facts: [
        { number: 1, value: '50' } as never,
        { number: 2 } as never,
        { value: '4' } as never
      ]
    });
    expect(reading.facts).toEqual([{ number: 1, key: '', label: '', value: '50', unit: '', numericValue: null, note: '', detail: '' }]);
  });

  it('keeps the Progress card a fact cites, and only a known one', () => {
    const reading = toCoachReading('PROGRESS', {
      status: 'RESTING',
      facts: [
        { number: 1, value: '0.41', card: 'GOAL' } as never,
        { number: 2, value: '4', card: 'SOMETHING' } as never
      ]
    });
    expect(reading.facts[0].card).toBe('GOAL');
    expect('card' in reading.facts[1]).toBeFalse();
  });

  it('drops a lift without two real weights', () => {
    const reading = toCoachReading('WORKOUT', {
      status: 'RESTING',
      lifts: [
        { exerciseName: 'Row', fromKg: 18, fromDate: '2026-09-13', toKg: 20, toDate: '2026-09-25' },
        { exerciseName: 'Plank', fromKg: null as never, fromDate: '', toKg: 0, toDate: '' }
      ]
    });
    expect(reading.lifts.map((lift) => lift.exerciseName)).toEqual(['Row']);
  });

  it('trims the text of a reading', () => {
    const reading = toCoachReading('WORKOUT', {
      status: 'READY',
      reading: { headline: ' Steady. ', body: ' You trained [1]. ', citations: [1], source: 'MODEL', generatedAt: '2026-09-28T15:20:00Z' }
    });
    expect(reading.reading?.headline).toBe('Steady.');
    expect(reading.reading?.body).toBe('You trained [1].');
  });
});
