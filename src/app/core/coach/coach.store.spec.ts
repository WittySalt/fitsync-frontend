import { ApplicationRef, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CoachApiService } from './coach-api.service';
import { CoachContextService, Surface } from './coach-context.service';
import { CoachMessageResponse, CoachReading, CoachStreamEvent, CoachThreadDetail, Recommendation } from './coach.models';
import { CoachStore } from './coach.store';

/**
 * The store, against a scripted API.
 *
 * What matters is the streamed turn's lifecycle: steps accumulate while it runs, the persisted
 * thread replaces them when the answer lands, a stream that cannot be opened falls back to the
 * plain call, and a second question during a turn is ignored rather than queued.
 */
describe('CoachStore', () => {
  let store: CoachStore;
  let stream: Subject<CoachStreamEvent>;
  let api: jasmine.SpyObj<CoachApiService>;

  const thread = { threadId: 't1', title: null, turnCount: 0, lastActiveAt: '', createdAt: '' };
  const answer: CoachMessageResponse = {
    threadId: 't1',
    turnId: 'u2',
    answer: 'Train today.',
    tier: 2,
    toolsUsed: ['readFacts'],
    latencyMs: 900,
    pinnedReadingId: null
  };
  const detail: CoachThreadDetail = {
    thread: { ...thread, turnCount: 2 },
    turns: [
      { turnId: 'u1', seq: 1, role: 'USER', content: 'Should I train?', tier: null, model: null, promptTokens: null, completionTokens: null, latencyMs: null, guardrailVerdict: null, tools: [], createdAt: '' },
      { turnId: 'u2', seq: 2, role: 'ASSISTANT', content: 'Train today.', tier: 2, model: null, promptTokens: null, completionTokens: null, latencyMs: 900, guardrailVerdict: 'PASSED', tools: [{ seq: 1, tool: 'readFacts', args: '{}', resultSummary: '7 fact groups', latencyMs: 4, ok: true, error: null }], createdAt: '' }
    ]
  };

  beforeEach(() => {
    stream = new Subject<CoachStreamEvent>();
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', [
      'listRecommendations',
      'refreshRecommendations',
      'createThread',
      'getThread',
      'sendMessage',
      'streamMessage',
      'draftSession',
      'listSessionDrafts',
      'acceptSessionDraft',
      'rejectSessionDraft'
    ]);
    api.listRecommendations.and.returnValue(of([]));
    api.createThread.and.returnValue(of(thread));
    api.getThread.and.returnValue(of(detail));
    api.streamMessage.and.returnValue(stream.asObservable());

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CoachApiService, useValue: api }]
    });
    store = TestBed.inject(CoachStore);
  });

  it('opens the dock and loads recommendations once', () => {
    store.open();
    store.close();
    store.open();

    expect(store.dockOpen()).toBeTrue();
    expect(api.listRecommendations).toHaveBeenCalledTimes(1);
  });

  it('creates a thread on the first question and streams it', () => {
    store.ask('Should I train?');

    expect(api.createThread).toHaveBeenCalledTimes(1);
    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Should I train?', { surface: 'HOME' }, jasmine.any(String));
    expect(store.status()).toBe('answering');
    expect(store.pendingQuestion()).toBe('Should I train?');
  });

  it('attaches the recipe a question is about to the context, for that question only', () => {
    store.ask('Does this fit today?', { recipeId: 'r1' });
    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Does this fit today?', { surface: 'NUTRITION', recipeId: 'r1' }, jasmine.any(String));
    stream.next({ name: 'answer', data: answer });
    stream.complete();

    store.ask('And tomorrow?');
    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'And tomorrow?', { surface: 'HOME' }, jasmine.any(String));
  });

  it('shows each step as it arrives, closing a tool when it finishes', () => {
    store.ask('Should I train?');

    stream.next({ name: 'tool_started', data: { kind: 'TOOL_STARTED', tool: 'readFacts', summary: null, latencyMs: null } });
    stream.next({ name: 'thinking', data: { kind: 'THINKING', tool: null, summary: null, latencyMs: null } });
    stream.next({ name: 'tool_finished', data: { kind: 'TOOL_FINISHED', tool: 'readFacts', summary: '7 fact groups', latencyMs: 4 } });

    expect(store.liveSteps().map((s) => `${s.kind}:${s.tool ?? ''}`)).toEqual(['TOOL_FINISHED:readFacts', 'THINKING:']);
  });

  it('collapses consecutive thinking events into one', () => {
    store.ask('Should I train?');
    const thinking: CoachStreamEvent = { name: 'thinking', data: { kind: 'THINKING', tool: null, summary: null, latencyMs: null } };

    stream.next(thinking);
    stream.next(thinking);
    stream.next(thinking);

    expect(store.liveSteps().length).toBe(1);
  });

  it('replaces the live steps with the persisted thread when the answer lands', () => {
    store.ask('Should I train?');
    stream.next({ name: 'answer', data: answer });
    stream.complete();

    expect(api.getThread).toHaveBeenCalledWith('t1');
    expect(store.turns().length).toBe(2);
    expect(store.turns()[1].tools[0].resultSummary).toBe('7 fact groups');
    expect(store.liveSteps()).toEqual([]);
    expect(store.pendingQuestion()).toBeNull();
    expect(store.status()).toBe('idle');
  });

  it('tears the stream down once the answer has arrived, so no socket is left open per turn', async () => {
    store.ask('Should I train?');
    expect(stream.observed).toBeTrue();

    stream.next({ name: 'answer', data: answer });
    await Promise.resolve();

    expect(stream.observed).toBeFalse();
    expect(store.turns().length).toBe(2);
  });

  it('falls back to the plain endpoint when the stream cannot be opened', () => {
    api.streamMessage.and.returnValue(throwError(() => new Error('502')));
    api.sendMessage.and.returnValue(of(answer));

    store.ask('Should I train?');

    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'Should I train?', { surface: 'HOME' }, jasmine.any(String));
    expect(store.turns().length).toBe(2);
    expect(store.error()).toBeNull();
  });

  it('surfaces a server-side error event without pretending to have answered', () => {
    store.ask('Should I train?');
    stream.next({ name: 'error', data: 'The coach could not finish that turn.' });
    stream.complete();

    expect(store.error()).toBe('The coach could not finish that turn.');
    expect(store.turns()).toEqual([]);
    expect(store.status()).toBe('idle');
  });

  it('marks the coach unavailable when the answer says the model was off', () => {
    store.ask('Should I train?');
    stream.next({ name: 'answer', data: { ...answer, tier: -1 } });

    expect(store.status()).toBe('unavailable');
  });

  it('ignores a second question while one is in flight', () => {
    store.ask('First');
    store.ask('Second');

    expect(api.streamMessage).toHaveBeenCalledTimes(1);
    expect(store.pendingQuestion()).toBe('First');
  });

  it('reports a stream that closed without answering', () => {
    store.ask('Should I train?');
    stream.complete();

    expect(store.error()).toContain('stopped before answering');
  });

  it('pre-fills the composer from a card and opens the dock, sending nothing', () => {
    const rec: Recommendation = { type: 'NUTRITION_GAP', source: 'RULE', facts: {}, narrative: 'x', generatedAt: '', expiresAt: null };

    store.askAbout(rec);

    expect(store.dockOpen()).toBeTrue();
    expect(store.composerPrefill()).toBe('Tell me more about my nutrition gap');
    expect(api.streamMessage).not.toHaveBeenCalled();
  });

  it('starts a new thread cleanly', () => {
    store.ask('Should I train?');
    stream.next({ name: 'answer', data: answer });
    store.newThread();

    expect(store.thread()).toBeNull();
    expect(store.turns()).toEqual([]);
    expect(store.status()).toBe('idle');
  });

  // --- drafting, which takes its own path rather than the chat loop -----------------------

  const draftView = {
    artifactId: 'a1',
    status: 'DRAFT' as const,
    source: 'MODEL' as const,
    validationAttempts: 1,
    session: { title: 'Upper body push', focus: ['CHEST'], estimatedMinutes: 42, exercises: [], summary: 's' },
    planId: null,
    sessionId: null,
    rejectionReason: null
  };

  it('builds a session through the drafting endpoint and offers it as the latest draft', () => {
    api.draftSession.and.returnValue(of(draftView));

    store.buildSession('chest and back');

    expect(api.draftSession).toHaveBeenCalledWith('chest and back', undefined);
    expect(api.streamMessage).not.toHaveBeenCalled();
    expect(store.latestDraft()?.artifactId).toBe('a1');
    expect(store.drafts().map((d) => d.artifactId)).toEqual(['a1']);
    expect(store.status()).toBe('idle');
    expect(store.pendingQuestion()).toBeNull();
  });

  it('carries the thread into the draft when a conversation is open', () => {
    store.ask('Should I train?');
    stream.next({ name: 'answer', data: answer });
    api.draftSession.and.returnValue(of(draftView));

    store.buildSession();

    expect(api.draftSession).toHaveBeenCalledWith(undefined, 't1');
  });

  it("shows the server's own reason when nothing could be built", () => {
    api.draftSession.and.returnValue(
      throwError(() => ({ status: 503, error: { message: 'Everything available trains a muscle group worked yesterday.' } }))
    );

    store.buildSession();

    expect(store.error()).toContain('worked yesterday');
    expect(store.latestDraft()).toBeNull();
    expect(store.status()).toBe('idle');
  });

  it('marks a draft accepted with the plan and session it became, and clears the dock card', () => {
    api.draftSession.and.returnValue(of(draftView));
    store.buildSession();
    api.acceptSessionDraft.and.returnValue(
      of({ artifactId: 'a1', status: 'ACCEPTED' as const, planId: 'p1', sessionId: 's1', sessionStarted: true })
    );

    store.acceptDraft('a1').subscribe();

    expect(store.drafts()[0].status).toBe('ACCEPTED');
    expect(store.drafts()[0].planId).toBe('p1');
    expect(store.latestDraft()).toBeNull();
  });

  it('drops a rejected draft from the latest-draft card but keeps it in the list', () => {
    api.draftSession.and.returnValue(of(draftView));
    store.buildSession();
    api.rejectSessionDraft.and.returnValue(of({ ...draftView, status: 'DISCARDED' as const, rejectionReason: 'too long' }));

    store.rejectDraft('a1', 'too long').subscribe();

    expect(store.latestDraft()).toBeNull();
    expect(store.drafts()[0].status).toBe('DISCARDED');
    expect(store.drafts()[0].rejectionReason).toBe('too long');
  });

  it('orders the current surface insights first in the dock feed', () => {
    const recs: Recommendation[] = [
      { type: 'WEEKLY_ADHERENCE', source: 'RULE', facts: {}, narrative: 'w', generatedAt: '', expiresAt: null },
      { type: 'NUTRITION_GAP', source: 'RULE', facts: {}, narrative: 'n', generatedAt: '', expiresAt: null }
    ];
    api.listRecommendations.and.returnValue(of(recs) as Observable<Recommendation[]>);
    store.loadRecommendations();

    // The test router sits at "/", which maps to the dashboard surface: nutrition first.
    expect(store.orderedRecommendations().map((r) => r.type)).toEqual(['NUTRITION_GAP', 'WEEKLY_ADHERENCE']);
  });
});

/**
 * Pinning a reading from an insight panel, and how it shapes the next question.
 *
 * The surface here is faked rather than driven through the router, so a test can move the store
 * between surfaces without a real navigation. What matters is the context `ask` builds and how the
 * pin and the citations it grounds are kept or dropped across a surface change and a new thread.
 */
describe('CoachStore — pinned reading', () => {
  let store: CoachStore;
  let api: jasmine.SpyObj<CoachApiService>;
  let stream: Subject<CoachStreamEvent>;
  let surface: WritableSignal<Surface>;

  const workoutSurface: Surface = { id: 'workout', label: 'Workout, this week', inlineTypes: [], suggestions: [], code: 'WORKOUT' };
  const nutritionSurface: Surface = { id: 'nutrition', label: 'Nutrition, this week', inlineTypes: [], suggestions: [], code: 'NUTRITION' };
  const coachSurface: Surface = { id: 'coach', label: 'Coach workspace', inlineTypes: [], suggestions: [], code: null };

  const thread = { threadId: 't1', title: null, turnCount: 0, lastActiveAt: '', createdAt: '' };
  const detail: CoachThreadDetail = { thread: { ...thread, turnCount: 2 }, turns: [] };

  const workoutReading: CoachReading = {
    surface: 'WORKOUT',
    status: 'READY',
    readingId: 'r1',
    period: 'THIS_WEEK',
    periodStart: '2026-09-22',
    periodEnd: '2026-09-28',
    facts: [],
    reading: { headline: 'Your sessions held steady.', body: 'Body.', citations: [], source: 'MODEL', generatedAt: null },
    lifts: []
  };

  const answer = (overrides: Partial<CoachMessageResponse> = {}): CoachMessageResponse => ({
    threadId: 't1',
    turnId: 'u2',
    answer: 'Train today.',
    tier: 2,
    toolsUsed: [],
    latencyMs: 900,
    pinnedReadingId: null,
    ...overrides
  });

  beforeEach(() => {
    stream = new Subject<CoachStreamEvent>();
    surface = signal(workoutSurface);
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', ['listRecommendations', 'createThread', 'getThread', 'sendMessage', 'streamMessage']);
    api.listRecommendations.and.returnValue(of([]));
    api.createThread.and.returnValue(of(thread));
    api.getThread.and.returnValue(of(detail));
    api.streamMessage.and.returnValue(stream.asObservable());

    TestBed.configureTestingModule({
      providers: [{ provide: CoachApiService, useValue: api }, { provide: CoachContextService, useValue: { surface } }]
    });
    store = TestBed.inject(CoachStore);
  });

  it('pins a reading and opens the dock, sending nothing', () => {
    store.askAboutReading(workoutReading);

    expect(store.pinnedReading()).toBe(workoutReading);
    expect(store.dockOpen()).toBeTrue();
    expect(api.streamMessage).not.toHaveBeenCalled();
  });

  it('lets go of the pinned reading', () => {
    store.askAboutReading(workoutReading);
    store.letGoOfReading();

    expect(store.pinnedReading()).toBeNull();
  });

  it('sends the surface, and the readingId when a reading is pinned', () => {
    store.askAboutReading(workoutReading);

    store.ask('Should my core get a day off?');

    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Should my core get a day off?', {
      surface: 'WORKOUT',
      readingId: 'r1'
    }, jasmine.any(String));
  });

  it('sends only the surface when nothing is pinned', () => {
    store.ask('Should I train today?');

    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Should I train today?', { surface: 'WORKOUT' }, jasmine.any(String));
  });

  it('sends no context on a surface the server does not know', () => {
    surface.set(coachSurface);

    store.ask('Should I train today?');

    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Should I train today?', undefined, jasmine.any(String));
  });

  it('records a cited turn when the answer is grounded in the pinned reading', () => {
    store.askAboutReading(workoutReading);
    store.ask('Should my core get a day off?');

    stream.next({ name: 'answer', data: answer({ pinnedReadingId: 'r1' }) });

    expect(store.citedTurns().get('u2')).toBe(workoutReading);
  });

  it('does not record a cited turn when the server did not ground the answer in it', () => {
    store.askAboutReading(workoutReading);
    store.ask('Should my core get a day off?');

    stream.next({ name: 'answer', data: answer({ pinnedReadingId: null }) });

    expect(store.citedTurns().size).toBe(0);
  });

  it('clears the pin when the surface moves away from the reading', () => {
    store.askAboutReading(workoutReading);

    surface.set(nutritionSurface);
    // The store's effect runs on the application's next change-detection pass, not synchronously
    // on the signal write, so the pass is driven explicitly rather than guessed at with a delay.
    TestBed.inject(ApplicationRef).tick();

    expect(store.pinnedReading()).toBeNull();
  });

  it('holds an offered reading without pinning it or opening the dock', () => {
    store.offerReading(workoutReading);

    expect(store.availableReading()).toBe(workoutReading);
    expect(store.pinnedReading()).toBeNull();
    expect(store.dockOpen()).toBeFalse();
  });

  it('drops an offered reading when the surface moves to another page', () => {
    store.offerReading(workoutReading);

    surface.set(nutritionSurface);
    TestBed.inject(ApplicationRef).tick();

    expect(store.availableReading()).toBeNull();
  });

  it('keeps the pin but forgets which turns were cited when a new thread starts', () => {
    store.askAboutReading(workoutReading);
    store.ask('Should my core get a day off?');
    stream.next({ name: 'answer', data: answer({ pinnedReadingId: 'r1' }) });

    store.newThread();

    expect(store.pinnedReading()).toBe(workoutReading);
    expect(store.citedTurns().size).toBe(0);
  });
});
