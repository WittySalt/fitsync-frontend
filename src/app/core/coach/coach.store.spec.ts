import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CoachApiService } from './coach-api.service';
import { CoachMessageResponse, CoachStreamEvent, CoachThreadDetail, Recommendation } from './coach.models';
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
    latencyMs: 900
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
      'streamMessage'
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
    expect(api.streamMessage).toHaveBeenCalledWith('t1', 'Should I train?');
    expect(store.status()).toBe('answering');
    expect(store.pendingQuestion()).toBe('Should I train?');
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

    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'Should I train?');
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
