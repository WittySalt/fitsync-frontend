import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Surface } from '../../core/coach/coach-context.service';
import { CoachCardContext, CoachReading, CoachThreadDetail, CoachThreadSummary, CoachTurn, SessionDraftView } from '../../core/coach/coach.models';
import { CoachStatus, CoachStore, LiveStep } from '../../core/coach/coach.store';
import { CoachDockComponent, MATCH_MEDIA, isBuildRequest } from './coach-dock.component';

/**
 * Which messages take the drafting path rather than the chat loop.
 *
 * The rule is a literal keyword match, so the cases here are the contract: the suggested
 * generative question routes to drafting, ordinary questions do not, and a message that names a
 * session without asking to build one is still a question.
 */
describe('isBuildRequest', () => {
  it('routes the suggested build question to drafting', () => {
    expect(isBuildRequest('Build me a session for today')).toBeTrue();
  });

  it('accepts the usual ways of asking for one', () => {
    for (const text of [
      'make me a workout for tonight',
      'Can you create a training plan for chest?',
      'draft a session, I have a barbell',
      'put together a routine for my shoulders'
    ]) {
      expect(isBuildRequest(text)).withContext(text).toBeTrue();
    }
  });

  it('leaves questions about training as questions', () => {
    for (const text of ['Should I train today?', 'How was my last session?', 'What should I eat tonight?']) {
      expect(isBuildRequest(text)).withContext(text).toBeFalse();
    }
  });

  it('needs both the verb and the subject', () => {
    expect(isBuildRequest('build me something')).toBeFalse();
    expect(isBuildRequest('my workout was hard')).toBeFalse();
  });
});

const WORKOUT_SURFACE: Surface = {
  id: 'workout',
  label: 'Workout, this week',
  suggestions: [{ text: 'Should I train today?', generative: false }],
  code: 'WORKOUT'
};

const PINNED_READING: CoachReading = {
  surface: 'WORKOUT',
  status: 'READY',
  readingId: 'r1',
  period: 'THIS_WEEK',
  periodStart: '2026-09-22',
  periodEnd: '2026-09-28',
  facts: [
    { number: 1, key: 'MOST_TRAINED', label: 'Sessions with core work', value: '4', unit: 'of 4', numericValue: 4, note: 'Every one', detail: '' },
    { number: 2, key: 'VOLUME_PER_SESSION', label: 'Weight moved per session', value: '1,923', unit: 'kg', numericValue: 1923, note: 'Up 12%', detail: '' }
  ],
  reading: { headline: 'Your sessions held steady.', body: 'Body.', citations: [], source: 'MODEL', generatedAt: null },
  lifts: []
};

/** A minimal stand-in for CoachStore: real signals for reactivity, spies for every action it takes. */
class FakeCoachStore {
  dockOpen = signal(true);
  status = signal<CoachStatus>('idle');
  error = signal<string | null>(null);
  thread = signal<CoachThreadDetail | null>(null);
  liveSteps = signal<LiveStep[]>([]);
  pendingQuestion = signal<string | null>(null);
  latestDraft = signal<SessionDraftView | null>(null);
  draftRequest = signal<string | null>(null);
  composerPrefill = signal<string | null>(null);
  pinnedReading = signal<CoachReading | null>(null);
  pinnedCard = signal<CoachCardContext | null>(null);
  availableReading = signal<CoachReading | null>(null);
  citedTurns = signal<ReadonlyMap<string, CoachReading>>(new Map());
  surface = signal<Surface>(WORKOUT_SURFACE);
  limitNotice = signal<string | null>(null);
  limited = (): boolean => this.limitNotice() !== null;
  historyOpen = signal(false);
  history = signal<CoachThreadSummary[]>([]);
  historyStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  historyHasMore = signal(false);
  historyLoadingMore = signal(false);
  historyNotice = signal<string | null>(null);
  currentThreadId = (): string | null => this.thread()?.thread.threadId ?? null;

  // Plain functions rather than real computed signals: the template only ever calls them, and a
  // fresh read on every change-detection pass is all a fake needs to stay in sync with `thread`.
  turns = (): CoachTurn[] => this.thread()?.turns ?? [];

  open = jasmine.createSpy('open');
  close = jasmine.createSpy('close');
  toggle = jasmine.createSpy('toggle');
  newThread = jasmine.createSpy('newThread');
  openHistory = jasmine.createSpy('openHistory').and.callFake(() => {
    this.historyOpen.set(true);
    this.historyStatus.set('ready');
  });
  closeHistory = jasmine.createSpy('closeHistory').and.callFake(() => this.historyOpen.set(false));
  loadMoreHistory = jasmine.createSpy('loadMoreHistory');
  openThread = jasmine.createSpy('openThread');
  archiveThread = jasmine.createSpy('archiveThread');
  ask = jasmine.createSpy('ask');
  buildSession = jasmine.createSpy('buildSession');
  askAboutReading = jasmine.createSpy('askAboutReading').and.callFake((reading: CoachReading) => this.pinnedReading.set(reading));
  letGoOfReading = jasmine.createSpy('letGoOfReading').and.callFake(() => this.pinnedReading.set(null));
  letGoOfCard = jasmine.createSpy('letGoOfCard').and.callFake(() => this.pinnedCard.set(null));
}

function turn(overrides: Partial<CoachTurn>): CoachTurn {
  return {
    turnId: 't-assistant',
    seq: 1,
    role: 'ASSISTANT',
    content: '',
    tier: 2,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 10,
    guardrailVerdict: null,
    tools: [],
    createdAt: '',
    ...overrides
  };
}

/**
 * The dock's handling of a pinned reading: the card it shows, the questions it offers, and how a
 * cited answer is told apart from an ordinary one so a stray `[2]` never reaches the screen as text.
 */
describe('CoachDockComponent — pinned reading', () => {
  let fixture: ComponentFixture<CoachDockComponent>;
  let element: HTMLElement;
  let store: FakeCoachStore;

  function render(): void {
    fixture = TestBed.createComponent(CoachDockComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    store = new FakeCoachStore();
    await TestBed.configureTestingModule({
      imports: [CoachDockComponent],
      providers: [provideRouter([]), { provide: CoachStore, useValue: store }]
    }).compileComponents();
  });

  it('shows the pinned card with its headline and a chip for each fact', () => {
    store.pinnedReading.set(PINNED_READING);
    render();

    expect(element.querySelector('.pinned-headline')?.textContent?.trim()).toBe('Your sessions held steady.');
    const numbers = Array.from(element.querySelectorAll('.pinned-chip-number')).map((n) => n.textContent?.trim());
    const values = Array.from(element.querySelectorAll('.pinned-chip-value')).map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(numbers).toEqual(['1', '2']);
    expect(values).toEqual(['4 of 4', '1,923 kg']);
  });

  it('falls back to a facts-only headline when the reading has no text', () => {
    store.pinnedReading.set({ ...PINNED_READING, reading: null });
    render();

    expect(element.querySelector('.pinned-headline')?.textContent?.trim()).toBe('Your measured facts');
  });

  it('lets go of the reading, which clears the pinned card', () => {
    store.pinnedReading.set(PINNED_READING);
    render();

    (element.querySelector('.pinned-release') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.letGoOfReading).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.pinned')).toBeNull();
  });

  it('offers the questions that follow from the reading, and sends the right call for each', () => {
    store.pinnedReading.set(PINNED_READING);
    render();

    const buttons = Array.from(element.querySelectorAll('.sugg')) as HTMLButtonElement[];
    // Two candidates apply (day-off, next-lift) plus the build question, capped at three.
    expect(buttons.map((b) => b.querySelector('.sugg-text')?.textContent?.trim())).toEqual([
      'Should my core get a day off?',
      'What should I lift next time?',
      'Build a session for today'
    ]);
    expect(buttons[2].querySelector('.draft-pill')).not.toBeNull();
    expect(buttons[0].querySelector('.draft-pill')).toBeNull();

    buttons[0].click();
    expect(store.ask).toHaveBeenCalledWith('Should my core get a day off?');

    buttons[2].click();
    expect(store.buildSession).toHaveBeenCalledWith('Build a session for today');
  });

  it('shows the header line as "one reading pinned" instead of the insight count', () => {
    store.pinnedReading.set({ ...PINNED_READING, period: 'PREVIOUS_WEEK', periodStart: '2026-09-21', periodEnd: '2026-09-27' });
    render();

    expect(element.querySelector('.looking')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Looking at Workout, 21 to 27 Sept · one reading pinned'
    );
  });

  it('names the page alone when the pinned reading has no dates', () => {
    store.pinnedReading.set({ ...PINNED_READING, periodStart: null, periodEnd: null });
    render();

    expect(element.querySelector('.looking')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Looking at Workout · one reading pinned');
  });

  it('draws a cited answer through numbered badges and leaves no brackets in the text', () => {
    store.pinnedReading.set(PINNED_READING);
    store.citedTurns.set(new Map([['t-assistant', PINNED_READING]]));
    store.thread.set({
      thread: { threadId: 't1', title: null, turnCount: 1, lastActiveAt: '', createdAt: '' },
      turns: [turn({ content: 'Every session trained core work [1], and load rose [2] this week.' })]
    });
    render();

    const badges = Array.from(element.querySelectorAll('.cite-badge')).map((b) => b.textContent?.trim());
    expect(badges).toEqual(['1', '2']);
    expect(element.querySelector('.turn-a p')?.textContent).not.toContain('[');
  });

  it('strips a stray marker from an answer the server did not cite, showing no badge', () => {
    store.pinnedReading.set(PINNED_READING);
    // citedTurns has no entry for this turn: the answer was not grounded in the pinned reading.
    store.thread.set({
      thread: { threadId: 't1', title: null, turnCount: 1, lastActiveAt: '', createdAt: '' },
      turns: [turn({ content: 'This mentions fact [2] in passing.' })]
    });
    render();

    expect(element.querySelector('.cite-badge')).toBeNull();
    expect(element.querySelector('.turn-a p')?.textContent?.trim()).toBe('This mentions fact in passing.');
  });
});

/** The panel as it first opens: its width, the order of what it shows, and the questions it offers. */
describe('CoachDockComponent — first screen', () => {
  let fixture: ComponentFixture<CoachDockComponent>;
  let element: HTMLElement;
  let store: FakeCoachStore;
  let sidebar: boolean;

  function render(): void {
    fixture = TestBed.createComponent(CoachDockComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string[] {
    return Array.from(element.querySelectorAll(selector)).map((n) => n.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function follows(first: Element | null, second: Element | null): boolean {
    return !!first && !!second && (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  beforeEach(async () => {
    store = new FakeCoachStore();
    sidebar = false;
    await TestBed.configureTestingModule({
      imports: [CoachDockComponent],
      providers: [
        provideRouter([]),
        { provide: CoachStore, useValue: store },
        { provide: MATCH_MEDIA, useValue: () => ({ matches: sidebar, addEventListener: () => undefined, removeEventListener: () => undefined }) }
      ]
    }).compileComponents();
  });

  it('opens at the wide panel width', () => {
    render();

    expect(element.querySelector('aside.dock')?.classList).toContain('dock-wide');
  });

  it('lists the context line, the reading, the suggestions and the input in that order', () => {
    store.availableReading.set(PINNED_READING);
    render();

    const looking = element.querySelector('.looking');
    const reading = element.querySelector('.reading-row');
    const suggestions = element.querySelector('.suggs');
    const composer = element.querySelector('.composer');
    expect(follows(looking, reading)).withContext('reading after context').toBeTrue();
    expect(follows(reading, suggestions)).withContext('suggestions after reading').toBeTrue();
    expect(follows(suggestions, composer)).withContext('input after suggestions').toBeTrue();
    expect(element.querySelector('.reading-headline')?.textContent?.trim()).toBe('Your sessions held steady.');
  });

  it('pins the reading when its row is pressed', () => {
    store.availableReading.set(PINNED_READING);
    render();

    (element.querySelector('.reading-row') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.askAboutReading).toHaveBeenCalledWith(PINNED_READING);
    expect(element.querySelector('.reading-row')).toBeNull();
    expect(element.querySelector('.pinned')).not.toBeNull();
  });

  it('shows no reading row when the page has no reading to offer', () => {
    render();

    expect(element.querySelector('.reading-row')).toBeNull();
  });

  it('shows the suggestions once before a question and once after the answer', () => {
    render();
    expect(text('.sugg-text')).toEqual(['Should I train today?']);

    store.thread.set({
      thread: { threadId: 't1', title: null, turnCount: 1, lastActiveAt: '', createdAt: '' },
      turns: [turn({ content: 'Yes.' })]
    });
    fixture.detectChanges();

    expect(text('.sugg-text')).toEqual(['Should I train today?']);
    expect(element.querySelectorAll('.suggs').length).toBe(1);
  });

  it('offers at most three suggestions', () => {
    store.surface.set({
      ...WORKOUT_SURFACE,
      suggestions: ['a', 'b', 'c', 'd'].map((question) => ({ text: question, generative: false }))
    });
    render();

    expect(text('.sugg-text')).toEqual(['a', 'b', 'c']);
  });

  it('sends a plain suggestion to the chat loop and a generative one to drafting', () => {
    store.surface.set({
      ...WORKOUT_SURFACE,
      suggestions: [
        { text: 'Should I train today?', generative: false },
        { text: 'Build me a session for today', generative: true }
      ]
    });
    render();

    const buttons = Array.from(element.querySelectorAll('.sugg')) as HTMLButtonElement[];
    buttons[0].click();
    buttons[1].click();

    expect(store.ask).toHaveBeenCalledWith('Should I train today?');
    expect(store.buildSession).toHaveBeenCalledWith('Build me a session for today');
  });

  it('draws the floating button when the sidebar is not showing', () => {
    render();

    store.dockOpen.set(false);
    fixture.detectChanges();

    expect(element.querySelector('.launch')).not.toBeNull();
  });

  it('leaves the floating button out when the sidebar is showing', () => {
    sidebar = true;
    render();

    store.dockOpen.set(false);
    fixture.detectChanges();

    expect(element.querySelector('.launch')).toBeNull();
  });

  it('opens the panel from the floating button', () => {
    render();
    store.dockOpen.set(false);
    fixture.detectChanges();

    (element.querySelector('.launch') as HTMLButtonElement).click();

    expect(store.open).toHaveBeenCalledTimes(1);
  });

  it('toggles the panel on Ctrl+K whatever the width', () => {
    sidebar = true;
    render();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    expect(store.toggle).toHaveBeenCalledTimes(1);
  });

  it('has no Earlier notes row and no recommendation cards, on the first screen or after', () => {
    render();

    expect(element.textContent).not.toContain('Earlier notes');
    expect(element.querySelector('.earlier')).toBeNull();
    expect(element.querySelector('app-recommendation-card')).toBeNull();
    expect(element.querySelector('.suggs')).not.toBeNull();
  });

  it('has a Back to page row that closes the dock', () => {
    render();

    const row = element.querySelector('.back-row') as HTMLButtonElement;
    expect(row.textContent).toContain('Back to page');
    row.click();

    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it('draws the scrim, and pressing it closes the dock', () => {
    render();
    const scrimStore = TestBed.inject(CoachStore);

    const scrim = element.querySelector('app-coach-scrim .scrim') as HTMLElement;
    scrim.click();

    expect(scrimStore.close).toHaveBeenCalledTimes(1);
  });

  it('shows what the person asked as a bubble before the draft card', () => {
    store.draftRequest.set('Chest and back, I have a barbell');
    store.latestDraft.set({
      artifactId: 'a1',
      status: 'DRAFT',
      source: 'MODEL',
      validationAttempts: 1,
      session: { title: 'Upper Body Strength', focus: [], estimatedMinutes: 40, exercises: [], summary: '' },
      planId: null,
      sessionId: null,
      rejectionReason: null
    } as SessionDraftView);
    render();

    const bubble = element.querySelector('.turn-q');
    const card = element.querySelector('.draft-link');
    expect(bubble?.textContent?.trim()).toBe('Chest and back, I have a barbell');
    expect(follows(bubble, card)).toBeTrue();
  });

  it('draws the draft card from the app tokens, not a peach or amber colour', () => {
    render();
    const styles = ((CoachDockComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('').replace(/\[_ngcontent-%COMP%\]/g, '');
    const rule = /\.draft-link \{[^}]*\}/.exec(styles)?.[0] ?? '';

    expect(rule).toContain('var(--accent-subtle)');
    expect(rule).not.toMatch(/amber|peach|orange|#f/i);
  });

  it('keeps a long tool step inside the bubble: the name stays whole, the summary is cut short', () => {
    const summary = 'goal progress 2026-09-12 to 2026-10-09 · 3 goals across weight, sessions and protein';
    store.pendingQuestion.set('How did my training go last week?');
    store.liveSteps.set([{ tool: 'readGoalProgress', kind: 'TOOL_FINISHED', summary, latencyMs: 269 }]);
    render();

    expect(text('.turn-a.live .step b')).toEqual(['readGoalProgress']);
    const meta = element.querySelector('.turn-a.live .step .meta');
    expect(meta?.getAttribute('title')).toBe(`${summary} · 269 ms`);

    const styles = ((CoachDockComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('').replace(/\[_ngcontent-%COMP%\]/g, '');
    const name = /\.step\s+b\s*\{[^}]*\}/.exec(styles)?.[0] ?? '';
    const metaRule = /\.step\s+\.meta\s*\{[^}]*\}/.exec(styles)?.[0] ?? '';
    expect(name).toMatch(/flex: none|flex-shrink: 0/);
    expect(metaRule).toContain('min-width: 0');
    expect(metaRule).toContain('overflow: hidden');
    expect(metaRule).toContain('text-overflow: ellipsis');
  });

  it('answers Ctrl+K typed in a text box on the coach workspace, where the request box lives', () => {
    store.surface.set({ id: 'coach', label: 'Coach workspace', suggestions: [], code: null });
    render();
    const box = document.createElement('input');
    document.body.appendChild(box);

    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    box.remove();

    expect(store.toggle).toHaveBeenCalledTimes(1);
  });

  it('leaves Ctrl+K typed in a text box on other pages to the browser', () => {
    render();
    const box = document.createElement('input');
    document.body.appendChild(box);

    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    box.remove();

    expect(store.toggle).not.toHaveBeenCalled();
  });
});

/** A Progress card pinned from its Ask button: the chip, the card's own questions and the composer's words. */
describe('CoachDockComponent — pinned card', () => {
  let fixture: ComponentFixture<CoachDockComponent>;
  let element: HTMLElement;
  let store: FakeCoachStore;
  const card: CoachCardContext = { kind: 'TRAINING', from: '2026-09-06', to: '2026-10-03' };

  function render(): void {
    fixture = TestBed.createComponent(CoachDockComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    store = new FakeCoachStore();
    store.surface.set({ id: 'progress', label: 'Progress', suggestions: [{ text: 'How am I doing?', generative: false }], code: 'PROGRESS' });
    await TestBed.configureTestingModule({
      imports: [CoachDockComponent],
      providers: [provideRouter([]), { provide: CoachStore, useValue: store }]
    }).compileComponents();
  });

  it('pins a small chip with the card and its days, like the recipe pin', () => {
    store.pinnedCard.set(card);
    render();
    expect(text(element.querySelector('app-card-pin strong'))).toBe('Training');
    expect(text(element.querySelector('app-card-pin .text span'))).toContain('from Progress');
    expect(text(element.querySelector('.looking'))).toContain('one card pinned');
  });

  it('offers the questions of the card kind and sends the one picked', () => {
    store.pinnedCard.set(card);
    render();
    const suggestions = Array.from(element.querySelectorAll('.sugg-text')).map((s) => text(s));
    expect(suggestions).toEqual(['Which muscles have I trained least?', 'Why was last week full?', "How do this month's minutes compare?"]);
    element.querySelector<HTMLButtonElement>('.sugg')!.click();
    expect(store.ask).toHaveBeenCalledWith('Which muscles have I trained least?');
  });

  it('asks about the card in the composer and lets go of it', () => {
    store.pinnedCard.set({ ...card, kind: 'FOOD' });
    render();
    expect(element.querySelector('input')?.getAttribute('placeholder')).toBe('Ask about your food');
    element.querySelector<HTMLButtonElement>('app-card-pin .release')!.click();
    fixture.detectChanges();
    expect(store.letGoOfCard).toHaveBeenCalled();
    expect(element.querySelector('app-card-pin')).toBeNull();
    expect(text(element.querySelector('.sugg-text'))).toBe('How am I doing?');
  });
});
