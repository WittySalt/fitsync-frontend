import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Surface } from '../../core/coach/coach-context.service';
import { CoachReading, CoachThreadDetail, CoachThreadSummary, CoachTurn, Recommendation, SessionDraftView } from '../../core/coach/coach.models';
import { CoachStatus, CoachStore, LiveStep } from '../../core/coach/coach.store';
import { CoachDockComponent, isTypingOutsideDock } from './coach-dock.component';

const SURFACE: Surface = {
  id: 'workout',
  label: 'Workout, this week',
  inlineTypes: [],
  suggestions: [{ text: 'Should I train today?', generative: false }],
  code: 'WORKOUT'
};

function assistant(content: string, id = 'a1'): CoachTurn {
  return {
    turnId: id,
    seq: 2,
    role: 'ASSISTANT',
    content,
    tier: 2,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 1,
    guardrailVerdict: null,
    tools: [],
    createdAt: ''
  };
}

class FakeStore {
  dockOpen = signal(true);
  status = signal<CoachStatus>('idle');
  error = signal<string | null>(null);
  recommendations = signal<Recommendation[]>([]);
  recommendationsLoadedAt = signal<string | null>('x');
  thread = signal<CoachThreadDetail | null>(null);
  liveSteps = signal<LiveStep[]>([]);
  pendingQuestion = signal<string | null>(null);
  latestDraft = signal<SessionDraftView | null>(null);
  composerPrefill = signal<string | null>(null);
  pinnedReading = signal<CoachReading | null>(null);
  availableReading = signal<CoachReading | null>(null);
  citedTurns = signal<ReadonlyMap<string, CoachReading>>(new Map());
  surface = signal<Surface>(SURFACE);
  limitNotice = signal<string | null>(null);
  limited = (): boolean => this.limitNotice() !== null;
  historyOpen = signal(false);
  history = signal<CoachThreadSummary[]>([]);
  historyStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('ready');
  historyHasMore = signal(false);
  historyLoadingMore = signal(false);
  historyNotice = signal<string | null>(null);
  currentThreadId = (): string | null => null;
  orderedRecommendations = (): Recommendation[] => [];
  inlineRecommendations = (): Recommendation[] => [];
  turns = (): CoachTurn[] => this.thread()?.turns ?? [];

  open = jasmine.createSpy('open').and.callFake(() => this.dockOpen.set(true));
  close = jasmine.createSpy('close').and.callFake(() => this.dockOpen.set(false));
  toggle = jasmine.createSpy('toggle');
  newThread = jasmine.createSpy('newThread');
  ask = jasmine.createSpy('ask');
  buildSession = jasmine.createSpy('buildSession');
  askAbout = jasmine.createSpy('askAbout');
  askAboutReading = jasmine.createSpy('askAboutReading');
  letGoOfReading = jasmine.createSpy('letGoOfReading');
  openHistory = jasmine.createSpy('openHistory').and.callFake(() => this.historyOpen.set(true));
  closeHistory = jasmine.createSpy('closeHistory').and.callFake(() => this.historyOpen.set(false));
  loadMoreHistory = jasmine.createSpy('loadMoreHistory');
  openThread = jasmine.createSpy('openThread');
  archiveThread = jasmine.createSpy('archiveThread');
}

describe('CoachDockComponent accessibility, history entry and limit notice', () => {
  let fixture: ComponentFixture<CoachDockComponent>;
  let element: HTMLElement;
  let store: FakeStore;

  function render(): void {
    fixture = TestBed.createComponent(CoachDockComponent);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    element = fixture.nativeElement as HTMLElement;
  }

  function settle(): void {
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  function press(target: EventTarget, init: KeyboardEventInit = { key: 'k', ctrlKey: true }): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  beforeEach(async () => {
    store = new FakeStore();
    await TestBed.configureTestingModule({
      imports: [CoachDockComponent],
      providers: [provideRouter([]), { provide: CoachStore, useValue: store }]
    }).compileComponents();
  });

  describe('Ctrl/Cmd+K', () => {
    let outside: HTMLInputElement;
    beforeEach(() => {
      outside = document.createElement('input');
      document.body.appendChild(outside);
    });
    afterEach(() => outside.remove());

    it('is left to the browser while typing in a field outside the dock', () => {
      render();
      const event = press(outside);

      expect(store.toggle).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBeFalse();
    });

    it('is left alone in editable content outside the dock', () => {
      render();
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      document.body.appendChild(editable);
      press(editable);
      editable.remove();

      expect(store.toggle).not.toHaveBeenCalled();
    });

    it('still toggles the dock from the page and from the dock composer', () => {
      render();
      press(document.body);
      press(element.querySelector('.composer input') as HTMLInputElement);

      expect(store.toggle).toHaveBeenCalledTimes(2);
    });

    it('classifies targets', () => {
      expect(isTypingOutsideDock(outside)).toBeTrue();
      expect(isTypingOutsideDock(document.body)).toBeFalse();
      expect(isTypingOutsideDock(null)).toBeFalse();
    });
  });

  describe('focus', () => {
    it('moves into the composer on open and back to the opener on close', () => {
      store.dockOpen.set(false);
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      render();

      store.dockOpen.set(true);
      settle();
      expect(document.activeElement).toBe(element.querySelector('.composer input'));

      store.dockOpen.set(false);
      settle();
      expect(document.activeElement).toBe(opener);
      opener.remove();
    });

    it('focuses the history list rather than the composer when it opens on history', () => {
      store.dockOpen.set(false);
      store.historyOpen.set(true);
      render();

      store.dockOpen.set(true);
      settle();

      expect(element.querySelector('app-coach-history')).not.toBeNull();
      expect(document.activeElement?.classList.contains('back')).toBeTrue();
    });
  });

  describe('live regions', () => {
    it('keeps the thread out of aria-live and announces only the latest answer, once', () => {
      store.thread.set({
        thread: { threadId: 't', title: null, turnCount: 2, lastActiveAt: '', createdAt: '' },
        turns: [assistant('First answer.', 'a0')]
      });
      render();
      expect(element.querySelector('.thread')?.getAttribute('aria-live')).toBeNull();
      expect(element.querySelectorAll('[aria-live]').length).toBe(1);
      expect(element.querySelector('[aria-live]')?.textContent?.trim()).toBe('');

      store.status.set('answering');
      settle();
      store.thread.set({
        thread: { threadId: 't', title: null, turnCount: 4, lastActiveAt: '', createdAt: '' },
        turns: [assistant('First answer.', 'a0'), assistant('Newest answer.', 'a1')]
      });
      store.status.set('idle');
      settle();

      expect(element.querySelector('[aria-live]')?.textContent?.trim()).toBe('Newest answer.');
    });

    it('capitalises the status words', () => {
      store.pendingQuestion.set('Hi');
      render();
      expect(element.querySelector('.turn-a.live')?.textContent?.trim()).toBe('Connecting');

      store.liveSteps.set([{ tool: null, kind: 'THINKING', summary: null, latencyMs: null }]);
      settle();
      expect(element.querySelector('.turn-a.live')?.textContent?.trim()).toBe('Thinking');
    });
  });

  describe('history entry', () => {
    it('has a History button with an icon and a label, next to New', () => {
      store.thread.set({ thread: { threadId: 't', title: null, turnCount: 2, lastActiveAt: '', createdAt: '' }, turns: [assistant('x')] });
      render();

      const buttons = Array.from(element.querySelectorAll('.dock-title .tgl')).map((b) => b.textContent?.trim());
      expect(buttons).toEqual(['History', 'New', '×']);
      expect(element.querySelector('.dock-title .tgl svg')).not.toBeNull();
    });

    it('opens and closes the list from the button, and swaps the conversation for it', () => {
      render();
      const button = element.querySelector('.dock-title .tgl') as HTMLButtonElement;

      button.click();
      settle();
      expect(store.openHistory).toHaveBeenCalled();
      expect(element.querySelector('app-coach-history')).not.toBeNull();
      expect(element.querySelector('.composer')).toBeNull();

      button.click();
      settle();
      expect(store.closeHistory).toHaveBeenCalled();
      expect(element.querySelector('.composer')).not.toBeNull();
    });
  });

  describe('rate limit notice', () => {
    it('shows the server message quietly and disables the composer', () => {
      store.limitNotice.set('That is 30 questions this hour. Try again in 2 minutes.');
      render();

      const notice = element.querySelector('.turn-a.warn[role="status"]');
      expect(notice?.textContent?.trim()).toBe('That is 30 questions this hour. Try again in 2 minutes.');
      expect(element.querySelector('.turn-a.warn[role="alert"]')).toBeNull();
      expect((element.querySelector('.composer input') as HTMLInputElement).disabled).toBeTrue();
      expect((element.querySelector('.send') as HTMLButtonElement).disabled).toBeTrue();
    });
  });

  describe('phone sheet and keyboard', () => {
    it('shrinks and rides above the keyboard when the visual viewport is shorter than the window', () => {
      const listeners = new Map<string, () => void>();
      const vv = {
        height: window.innerHeight - 300,
        offsetTop: 0,
        addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
        removeEventListener: () => undefined
      };
      spyOnProperty(window, 'visualViewport', 'get').and.returnValue(vv as unknown as VisualViewport);
      render();
      const dock = element.querySelector('.dock') as HTMLElement;
      expect(dock.classList.contains('kb')).toBeFalse();

      listeners.get('resize')?.();
      settle();

      expect(dock.classList.contains('kb')).toBeTrue();
      expect(dock.style.getPropertyValue('--dock-kb')).toBe('300px');
      expect(dock.style.getPropertyValue('--dock-vh')).toBe(`${window.innerHeight - 300}px`);

      vv.height = window.innerHeight;
      listeners.get('resize')?.();
      settle();
      expect(dock.classList.contains('kb')).toBeFalse();
    });
  });
});
