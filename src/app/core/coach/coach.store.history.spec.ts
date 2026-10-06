import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CoachApiService, CoachLimitError } from './coach-api.service';
import { CoachMessageResponse, CoachStreamEvent, CoachThreadDetail } from './coach.models';
import { CoachStore } from './coach.store';

/** Duplicate protection, the rate-limit notice and the conversation history list. */
describe('CoachStore turns, limits and history', () => {
  let store: CoachStore;
  let stream: Subject<CoachStreamEvent>;
  let api: jasmine.SpyObj<CoachApiService>;

  const thread = { threadId: 't1', title: null, turnCount: 0, lastActiveAt: '', createdAt: '' };
  const answer: CoachMessageResponse = {
    threadId: 't1',
    turnId: 'u2',
    answer: 'Train today.',
    tier: 2,
    toolsUsed: [],
    latencyMs: 10,
    pinnedReadingId: null
  };
  const turn = (role: 'USER' | 'ASSISTANT', content: string, id: string): CoachThreadDetail['turns'][number] => ({
    turnId: id,
    seq: 1,
    role,
    content,
    tier: null,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: null,
    guardrailVerdict: null,
    tools: [],
    createdAt: ''
  });
  const detail: CoachThreadDetail = { thread, turns: [turn('USER', 'Should I train?', 'u1'), turn('ASSISTANT', 'Train today.', 'u2')] };
  const row = (id: string) => ({
    threadId: id,
    title: `Thread ${id}`,
    surface: 'HOME' as const,
    lastMessageAt: '2026-10-02T10:00:00Z',
    turnCount: 2
  });

  beforeEach(() => {
    stream = new Subject<CoachStreamEvent>();
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', [
      'createThread',
      'getThread',
      'sendMessage',
      'streamMessage',
      'listThreadPage',
      'archiveThread',
      'draftSession'
    ]);
    api.createThread.and.returnValue(of(thread));
    api.getThread.and.returnValue(of(detail));
    api.streamMessage.and.returnValue(stream.asObservable());
    api.listThreadPage.and.returnValue(of({ items: [row('a'), row('b')], page: 0, hasMore: true }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CoachApiService, useValue: api }] });
    store = TestBed.inject(CoachStore);
  });

  it('sends one client turn id on the stream and the same one on the plain fallback', () => {
    api.streamMessage.and.returnValue(throwError(() => new Error('dropped')));
    api.sendMessage.and.returnValue(of(answer));

    store.ask('Should I train?');

    const streamId = api.streamMessage.calls.mostRecent().args[3];
    const plainId = api.sendMessage.calls.mostRecent().args[3];
    expect(streamId).toMatch(/^[0-9a-f-]{36}$/);
    expect(plainId).toBe(streamId);
  });

  it('uses a new id for the next question', () => {
    store.ask('One?');
    const first = api.streamMessage.calls.mostRecent().args[3];
    stream.next({ name: 'answer', data: answer });
    stream.complete();
    store.ask('Two?');

    expect(api.streamMessage.calls.mostRecent().args[3]).not.toBe(first);
  });

  it('never lists an assistant turn that has no text', () => {
    api.getThread.and.returnValue(of({ thread, turns: [turn('USER', 'Q', 'u1'), turn('ASSISTANT', '  ', 'u2')] }));
    store.openThread('t1');

    expect(store.turns().map((t) => t.role)).toEqual(['USER']);
  });

  describe('the rate limit', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('shows the server message as a notice, not an error, and locks the composer until the wait ends', () => {
      api.streamMessage.and.returnValue(
        throwError(() => new CoachLimitError({ message: 'That is 30 questions this hour. Try again in 2 minutes.', retryAfterSeconds: 120 }))
      );

      store.ask('Should I train?');

      expect(store.limitNotice()).toBe('That is 30 questions this hour. Try again in 2 minutes.');
      expect(store.error()).toBeNull();
      expect(store.limited()).toBeTrue();
      expect(api.sendMessage).not.toHaveBeenCalled();
      expect(store.composerPrefill()).toBe('Should I train?');

      jasmine.clock().tick(119_000);
      expect(store.limited()).toBeTrue();
      jasmine.clock().tick(1_500);
      expect(store.limited()).toBeFalse();
    });

    it('reads a 429 from the plain fallback the same way', () => {
      api.streamMessage.and.returnValue(throwError(() => new Error('dropped')));
      api.sendMessage.and.returnValue(
        throwError(() => ({ status: 429, error: { code: 'COACH_LIMIT', retryAfterSeconds: 30, message: 'Slow down a little.' } }))
      );

      store.ask('Should I train?');

      expect(store.limitNotice()).toBe('Slow down a little.');
      expect(store.error()).toBeNull();
    });

    it('ignores a question asked while limited', () => {
      api.streamMessage.and.returnValue(throwError(() => new CoachLimitError({ message: 'Wait.', retryAfterSeconds: 10 })));
      store.ask('One?');
      api.streamMessage.calls.reset();

      store.ask('Two?');

      expect(api.streamMessage).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('loads the first page and shows the list', () => {
      store.openHistory();

      expect(api.listThreadPage).toHaveBeenCalledWith(0, 20);
      expect(store.historyOpen()).toBeTrue();
      expect(store.history().map((r) => r.threadId)).toEqual(['a', 'b']);
      expect(store.historyHasMore()).toBeTrue();
      expect(store.historyStatus()).toBe('ready');
    });

    it('reports a failed load so the list can offer a retry', () => {
      api.listThreadPage.and.returnValue(throwError(() => new Error('500')));
      store.openHistory();
      expect(store.historyStatus()).toBe('error');

      api.listThreadPage.and.returnValue(of({ items: [row('a')], page: 0, hasMore: false }));
      store.openHistory();
      expect(store.historyStatus()).toBe('ready');
    });

    it('appends the next page without repeating a row', () => {
      store.openHistory();
      api.listThreadPage.and.returnValue(of({ items: [row('b'), row('c')], page: 1, hasMore: false }));

      store.loadMoreHistory();

      expect(api.listThreadPage).toHaveBeenCalledWith(1, 20);
      expect(store.history().map((r) => r.threadId)).toEqual(['a', 'b', 'c']);
      expect(store.historyHasMore()).toBeFalse();
    });

    it('opens an earlier thread with its turns and closes the list', () => {
      store.openHistory();

      store.openThread('t1');

      expect(api.getThread).toHaveBeenCalledWith('t1');
      expect(store.turns().length).toBe(2);
      expect(store.currentThreadId()).toBe('t1');
      expect(store.historyOpen()).toBeFalse();
    });

    it('keeps asking in the opened thread without creating another', () => {
      store.openThread('t1');
      store.ask('And tomorrow?');

      expect(api.createThread).not.toHaveBeenCalled();
      expect(api.streamMessage.calls.mostRecent().args[0]).toBe('t1');
    });

    it('says so when a thread cannot be opened and stays on the list', () => {
      store.openHistory();
      api.getThread.and.returnValue(throwError(() => new Error('404')));

      store.openThread('zzz');

      expect(store.historyNotice()).toContain('could not be opened');
      expect(store.historyOpen()).toBeTrue();
    });

    it('archives a thread, drops its row and starts afresh when it was the open one', () => {
      store.openThread('t1');
      api.listThreadPage.and.returnValue(of({ items: [row('t1'), row('b')], page: 0, hasMore: false }));
      store.openHistory();
      api.archiveThread.and.returnValue(of(undefined));

      store.archiveThread('t1');

      expect(api.archiveThread).toHaveBeenCalledWith('t1');
      expect(store.history().map((r) => r.threadId)).toEqual(['b']);
      expect(store.thread()).toBeNull();
    });

    it('leaves the row in place and says so when archiving fails', () => {
      store.openHistory();
      api.archiveThread.and.returnValue(throwError(() => new Error('500')));

      store.archiveThread('a');

      expect(store.history().length).toBe(2);
      expect(store.historyNotice()).toContain('could not be archived');
    });
  });
});
