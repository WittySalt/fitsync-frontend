import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Surface } from '../../core/coach/coach-context.service';
import { CoachReading, CoachThreadDetail, CoachTurn, Recommendation, SessionDraftView } from '../../core/coach/coach.models';
import { CoachStatus, CoachStore, LiveStep } from '../../core/coach/coach.store';
import { CoachDockComponent, isBuildRequest } from './coach-dock.component';

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
  inlineTypes: [],
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
  recommendations = signal<Recommendation[]>([]);
  recommendationsLoadedAt = signal<string | null>('2026-09-28T00:00:00Z');
  thread = signal<CoachThreadDetail | null>(null);
  liveSteps = signal<LiveStep[]>([]);
  pendingQuestion = signal<string | null>(null);
  latestDraft = signal<SessionDraftView | null>(null);
  composerPrefill = signal<string | null>(null);
  pinnedReading = signal<CoachReading | null>(null);
  citedTurns = signal<ReadonlyMap<string, CoachReading>>(new Map());
  surface = signal<Surface>(WORKOUT_SURFACE);

  // Plain functions rather than real computed signals: the template only ever calls them, and a
  // fresh read on every change-detection pass is all a fake needs to stay in sync with `thread`.
  orderedRecommendations = (): Recommendation[] => this.recommendations();
  inlineRecommendations = (): Recommendation[] => this.recommendations();
  turns = (): CoachTurn[] => this.thread()?.turns ?? [];

  open = jasmine.createSpy('open');
  close = jasmine.createSpy('close');
  toggle = jasmine.createSpy('toggle');
  newThread = jasmine.createSpy('newThread');
  ask = jasmine.createSpy('ask');
  buildSession = jasmine.createSpy('buildSession');
  askAbout = jasmine.createSpy('askAbout');
  letGoOfReading = jasmine.createSpy('letGoOfReading').and.callFake(() => this.pinnedReading.set(null));
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

    expect(element.querySelector('.pinned-headline')?.textContent?.trim()).toBe("This week's measured facts");
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

    const buttons = Array.from(element.querySelectorAll('.follow-q')) as HTMLButtonElement[];
    // Two candidates apply (day-off, next-lift) plus the build question, capped at three.
    expect(buttons.map((b) => b.querySelector('span:first-child')?.textContent?.trim())).toEqual([
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

  it('hides the recommendation cards while a reading is pinned', () => {
    store.recommendations.set([{ type: 'WEEKLY_ADHERENCE', source: 'RULE', facts: {}, narrative: 'w', generatedAt: '', expiresAt: null }]);
    store.pinnedReading.set(PINNED_READING);
    render();

    expect(element.querySelector('app-recommendation-card')).toBeNull();
  });

  it('shows the recommendation cards again once nothing is pinned', () => {
    store.recommendations.set([{ type: 'WEEKLY_ADHERENCE', source: 'RULE', facts: {}, narrative: 'w', generatedAt: '', expiresAt: null }]);
    render();

    expect(element.querySelector('app-recommendation-card')).not.toBeNull();
  });

  it('shows the header line as "one reading pinned" instead of the insight count', () => {
    store.pinnedReading.set(PINNED_READING);
    render();

    expect(element.querySelector('.looking')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Looking at Workout, this week · one reading pinned');
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
