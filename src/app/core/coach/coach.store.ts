import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, Subscription, tap } from 'rxjs';

import { CoachApiService, limitFromError } from './coach-api.service';
import { CoachContextService } from './coach-context.service';
import {
  AcceptSessionDraftResponse,
  CoachCardContext,
  CoachMessageContext,
  CoachMessageResponse,
  CoachProgressEvent,
  CoachLimit,
  CoachReading,
  CoachThreadDetail,
  CoachThreadSummary,
  CoachTurn,
  Recommendation,
  SessionDraftView
} from './coach.models';

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

const HISTORY_PAGE_SIZE = 20;

export type CoachStatus = 'idle' | 'loading' | 'answering' | 'unavailable';

/** A step the coach is taking right now, rendered in the thread while the turn runs. */
export interface LiveStep {
  tool: string | null;
  kind: CoachProgressEvent['kind'];
  summary: string | null;
  latencyMs: number | null;
}

/**
 * One store, many surfaces.
 *
 * The recommendation list is fetched once and read by every inline anchor and by the dock, so
 * adding the coach to another page costs no extra requests. The thread is the same: the dock and
 * any page that links into a conversation read one signal.
 *
 * The streamed turn is the interesting part. Progress events accumulate in `liveSteps` while the
 * turn runs, then the answer replaces them with a persisted turn that carries the same facts as its
 * trace. If the stream cannot be opened at all, the plain endpoint is used instead and the user
 * loses the progress view rather than the answer.
 */
@Injectable({ providedIn: 'root' })
export class CoachStore {
  private readonly api = inject(CoachApiService);
  private readonly context = inject(CoachContextService);

  readonly dockOpen = signal(false);
  readonly status = signal<CoachStatus>('idle');
  readonly error = signal<string | null>(null);

  readonly recommendations = signal<Recommendation[]>([]);
  readonly recommendationsLoadedAt = signal<string | null>(null);

  readonly thread = signal<CoachThreadDetail | null>(null);
  readonly liveSteps = signal<LiveStep[]>([]);
  /** The question in flight, shown as a user turn before the server has stored it. */
  readonly pendingQuestion = signal<string | null>(null);

  /** A draft produced from the conversation, offered as a card under the answer. */
  readonly latestDraft = signal<SessionDraftView | null>(null);

  /**
   * Text a surface wants in the composer, set by a card's "Ask about this". The dock consumes it
   * once and clears it; nothing is sent until the user does.
   */
  readonly composerPrefill = signal<string | null>(null);

  /** Opens the dock with a card as the subject of the next question. */
  askAbout(recommendation: Recommendation): void {
    const label = recommendation.type.toLowerCase().replace(/_/g, ' ');
    this.composerPrefill.set(`Tell me more about my ${label}`);
    this.open();
  }

  /**
   * The reading a page's insight panel asked about, pinned as the subject of the conversation.
   * Pinning opens the dock but sends nothing; the composer is left alone, because the follow-up
   * questions built from the reading are the usual way in.
   */
  readonly pinnedReading = signal<CoachReading | null>(null);

  /**
   * Turns whose answer the server grounded in the pinned reading, so the dock knows which turns
   * may show citation badges. Session state only: it is rebuilt from nothing on a fresh thread and
   * is never sent anywhere.
   */
  readonly citedTurns = signal<ReadonlyMap<string, CoachReading>>(new Map());

  askAboutReading(reading: CoachReading): void {
    // One subject at a time: a reading pinned after a card takes the card's place.
    this.pinnedCard.set(null);
    this.pinnedReading.set(reading);
    this.open();
  }

  letGoOfReading(): void {
    this.pinnedReading.set(null);
  }

  /**
   * The Progress card a question is about: its kind, id and days. Like a reading, pinning opens the
   * dock and sends nothing; the card's own questions are offered, and the context goes with the
   * next question so the server reads the same figures the card showed.
   */
  readonly pinnedCard = signal<CoachCardContext | null>(null);

  askAboutCard(card: CoachCardContext, prefill?: string): void {
    this.pinnedReading.set(null);
    this.pinnedCard.set({ ...card });
    if (prefill) {
      this.composerPrefill.set(prefill);
    }
    this.open();
  }

  letGoOfCard(): void {
    this.pinnedCard.set(null);
  }

  /**
   * The reading the current page has on show, offered by the page's insight panel so the dock can
   * list it on its first screen. Unlike the pinned reading it is not the subject of anything yet:
   * pressing it in the dock pins it.
   */
  readonly availableReading = signal<CoachReading | null>(null);

  offerReading(reading: CoachReading | null): void {
    this.availableReading.set(reading);
  }

  readonly surface = this.context.surface;

  constructor() {
    // An offered reading is about one page, so it goes when the page does.
    effect(() => {
      const reading = this.availableReading();
      if (reading && this.surface().code !== reading.surface) {
        this.availableReading.set(null);
      }
    });

    // Moving to a page about something else drops the pin: a reading pinned from the workout page
    // has nothing to say about the nutrition page, and carrying it across would ground the coach's
    // next answer in the wrong week's facts.
    effect(() => {
      const reading = this.pinnedReading();
      if (reading && this.surface().code !== reading.surface) {
        this.pinnedReading.set(null);
      }
    });

    // A card belongs to Progress and its pages, so it goes when the person leaves them.
    effect(() => {
      if (this.pinnedCard() && this.surface().code !== 'PROGRESS') {
        this.pinnedCard.set(null);
      }
    });
  }

  /** The current surface's insights first, then everything else, so the dock reads as "about here". */
  readonly orderedRecommendations = computed(() => {
    const inline = new Set(this.surface().inlineTypes);
    const all = this.recommendations();
    return [...all.filter((r) => inline.has(r.type)), ...all.filter((r) => !inline.has(r.type))];
  });

  readonly inlineRecommendations = computed(() => {
    const inline = new Set(this.surface().inlineTypes);
    return this.recommendations().filter((r) => inline.has(r.type));
  });

  /**
   * The turns worth showing. An assistant turn with no text is what a stream that died after the
   * server stored the question leaves behind; showing it is an empty bubble, so it is left out.
   */
  readonly turns = computed<CoachTurn[]>(() =>
    (this.thread()?.turns ?? []).filter((turn) => turn.role !== 'ASSISTANT' || turn.content.trim().length > 0)
  );

  /** A quiet notice while the user is over the coach's limit, with the composer locked until it ends. */
  readonly limitNotice = signal<string | null>(null);
  private limitTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while the limit notice is up; the composer reads this to stay disabled. */
  readonly limited = computed(() => this.limitNotice() !== null);

  private startLimit(limit: CoachLimit): void {
    if (this.limitTimer) {
      clearTimeout(this.limitTimer);
    }
    this.limitNotice.set(limit.message);
    this.limitTimer = setTimeout(() => {
      this.limitNotice.set(null);
      this.limitTimer = null;
    }, limit.retryAfterSeconds * 1000);
  }

  // ----- Conversation history -----

  /** Whether the dock shows the list of earlier conversations in place of the current one. */
  readonly historyOpen = signal(false);
  readonly history = signal<CoachThreadSummary[]>([]);
  readonly historyStatus = signal<HistoryStatus>('idle');
  readonly historyHasMore = signal(false);
  readonly historyLoadingMore = signal(false);
  /** A failure of opening or archiving a conversation from the list, shown above it. */
  readonly historyNotice = signal<string | null>(null);
  private historyPage = 0;

  readonly currentThreadId = computed(() => this.thread()?.thread.threadId ?? null);

  /** Shows the history list and reads its first page afresh, so a conversation started a minute ago is in it. */
  openHistory(): void {
    this.historyOpen.set(true);
    this.historyNotice.set(null);
    this.historyStatus.set('loading');
    this.historyPage = 0;
    this.api.listThreadPage(0, HISTORY_PAGE_SIZE).subscribe({
      next: (page) => {
        this.history.set(page.items);
        this.historyHasMore.set(page.hasMore);
        this.historyStatus.set('ready');
      },
      error: () => this.historyStatus.set('error')
    });
  }

  closeHistory(): void {
    this.historyOpen.set(false);
  }

  loadMoreHistory(): void {
    if (!this.historyHasMore() || this.historyLoadingMore()) {
      return;
    }
    this.historyLoadingMore.set(true);
    this.api.listThreadPage(this.historyPage + 1, HISTORY_PAGE_SIZE).subscribe({
      next: (page) => {
        const known = new Set(this.history().map((row) => row.threadId));
        this.history.update((rows) => [...rows, ...page.items.filter((row) => !known.has(row.threadId))]);
        this.historyPage = page.page;
        this.historyHasMore.set(page.hasMore);
        this.historyLoadingMore.set(false);
      },
      error: () => {
        this.historyNotice.set('More conversations could not be loaded just now.');
        this.historyLoadingMore.set(false);
      }
    });
  }

  /** Opens an earlier conversation, with its turns, so the user can read it and keep asking in it. */
  openThread(threadId: string): void {
    this.historyNotice.set(null);
    this.api.getThread(threadId).subscribe({
      next: (detail) => {
        this.inflight?.unsubscribe();
        this.thread.set(detail);
        this.liveSteps.set([]);
        this.pendingQuestion.set(null);
        this.latestDraft.set(null);
        this.citedTurns.set(new Map());
        this.status.set('idle');
        this.error.set(null);
        this.historyOpen.set(false);
      },
      error: () => this.historyNotice.set('That conversation could not be opened. Try again in a moment.')
    });
  }

  /** Archives a conversation and drops it from the list. Archiving the open one starts a fresh conversation. */
  archiveThread(threadId: string): void {
    this.historyNotice.set(null);
    this.api.archiveThread(threadId).subscribe({
      next: () => {
        this.history.update((rows) => rows.filter((row) => row.threadId !== threadId));
        if (this.currentThreadId() === threadId) {
          this.newThread();
        }
      },
      error: () => this.historyNotice.set('That conversation could not be archived just now.')
    });
  }

  private inflight: Subscription | null = null;

  open(): void {
    this.dockOpen.set(true);
    if (!this.recommendationsLoadedAt()) {
      this.loadRecommendations();
    }
  }

  close(): void {
    this.dockOpen.set(false);
  }

  toggle(): void {
    if (this.dockOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  loadRecommendations(): void {
    this.api.listRecommendations().subscribe({
      next: (list) => {
        this.recommendations.set(list);
        this.recommendationsLoadedAt.set(new Date().toISOString());
      },
      error: () => {
        // Cards are the passive surface; failing to load them must not make the dock unusable.
        this.recommendationsLoadedAt.set(new Date().toISOString());
      }
    });
  }

  /** After a mutation elsewhere in the app, re-read so a new personal record can surface. */
  refreshRecommendations(): void {
    this.api.refreshRecommendations().subscribe({
      next: () => this.loadRecommendations(),
      error: () => this.loadRecommendations()
    });
  }

  /**
   * Sends a question on the current thread, creating one on first use.
   *
   * Only one turn runs at a time. A second send while one is in flight is ignored rather than
   * queued, because the second question was almost certainly written without the first answer.
   */
  ask(question: string, about?: { recipeId?: string }): void {
    const text = question.trim();
    if (!text || this.status() === 'answering' || this.limited()) {
      return;
    }
    this.error.set(null);
    this.status.set('answering');
    this.pendingQuestion.set(text);
    this.liveSteps.set([]);

    const context = this.buildContext(about);
    // One id per question, sent on the stream and again on the plain fallback, so the server can
    // recognise the retry as the same question and not store it twice.
    const clientTurnId = newTurnId();
    const threadId = this.thread()?.thread.threadId;
    if (threadId) {
      this.stream(threadId, text, context, clientTurnId);
      return;
    }
    this.api.createThread().subscribe({
      next: (thread) => {
        this.thread.set({ thread, turns: [] });
        this.stream(thread.threadId, text, context, clientTurnId);
      },
      error: () => this.fail('The coach could not open a conversation. Try again in a moment.')
    });
  }

  /**
   * The context sent with a question: the current surface, plus the pinned reading when there is
   * one to send. A surface the server does not know (the coach workspace itself, or an unmapped
   * page) sends no context at all, so the server falls back to its own default grounding.
   */
  private buildContext(about?: { recipeId?: string }): CoachMessageContext | undefined {
    // A question about a recipe is always a Nutrition question, whatever page the dock was opened from.
    const card = about?.recipeId ? null : this.pinnedCard();
    const code = about?.recipeId ? 'NUTRITION' : (this.surface().code ?? (card ? 'PROGRESS' : null));
    if (!code) {
      return undefined;
    }
    const context: CoachMessageContext = { surface: code };
    if (about?.recipeId) {
      context.recipeId = about.recipeId;
    }
    if (card) {
      context.card = { kind: card.kind, ...(card.id ? { id: card.id } : {}), from: card.from, to: card.to };
    }
    const reading = this.pinnedReading();
    if (reading?.readingId) {
      context.readingId = reading.readingId;
    }
    return context;
  }

  /**
   * Asks the coach to build a session rather than answer a question.
   *
   * A separate path from `ask` on purpose. Drafting runs its own pipeline on the server, with a
   * validator and a fallback, and its result is an artifact to open in Plan Studio rather than a
   * sentence in the thread. Putting it through the chat loop would nest one inference inside
   * another's and hide the draft's provenance behind a bubble.
   */
  buildSession(request?: string): void {
    if (this.status() === 'answering' || this.limited()) {
      return;
    }
    this.error.set(null);
    this.status.set('answering');
    this.pendingQuestion.set(request?.trim() || 'Build me a session for today');
    this.liveSteps.set([{ tool: 'draftSession', kind: 'TOOL_STARTED', summary: null, latencyMs: null }]);

    this.api.draftSession(request?.trim() || undefined, this.thread()?.thread.threadId).subscribe({
      next: (draft) => {
        this.latestDraft.set(draft);
        this.pendingQuestion.set(null);
        this.liveSteps.set([]);
        this.status.set('idle');
        this.drafts.update((list) => [draft, ...list.filter((d) => d.artifactId !== draft.artifactId)]);
      },
      error: (failure: { status?: number; error?: { message?: string } }) => {
        const limit = limitFromError(failure);
        if (limit) {
          this.fail(null, limit, request);
          return;
        }
        this.fail(
          failure?.status === 503
            ? (failure.error?.message ?? 'Nothing could be built from the exercises available today.')
            : 'The coach could not draft a session just now. Try again in a moment.'
        );
      }
    });
  }

  /** Drafts this user has, newest first, as Plan Studio lists them. */
  readonly drafts = signal<SessionDraftView[]>([]);
  readonly draftsLoadedAt = signal<string | null>(null);

  loadDrafts(): void {
    this.api.listSessionDrafts().subscribe({
      next: (list) => {
        this.drafts.set(list);
        this.draftsLoadedAt.set(new Date().toISOString());
      },
      error: () => this.draftsLoadedAt.set(new Date().toISOString())
    });
  }

  /** Accepts a draft; the caller decides where to go with the plan and session it became. */
  acceptDraft(artifactId: string): Observable<AcceptSessionDraftResponse> {
    return this.api.acceptSessionDraft(artifactId).pipe(
      tap((accepted) => {
        this.drafts.update((list) =>
          list.map((d) =>
            d.artifactId === artifactId
              ? { ...d, status: accepted.status, planId: accepted.planId, sessionId: accepted.sessionId }
              : d
          )
        );
        // The card offered the draft; once it is accepted there is nothing left for it to offer.
        if (this.latestDraft()?.artifactId === artifactId) {
          this.latestDraft.set(null);
        }
      })
    );
  }

  rejectDraft(artifactId: string, reason?: string): Observable<SessionDraftView> {
    return this.api.rejectSessionDraft(artifactId, reason).pipe(
      tap((rejected) => {
        this.drafts.update((list) => list.map((d) => (d.artifactId === artifactId ? rejected : d)));
        if (this.latestDraft()?.artifactId === artifactId) {
          this.latestDraft.set(null);
        }
      })
    );
  }

  /**
   * Starts a fresh conversation. The old one stays on the server and in the thread list. The pin
   * survives: a reading is the subject of a page, not of one conversation, so switching threads
   * while it is still relevant should not lose it. Which turns cited it does not survive, because
   * there are no turns left to cite.
   */
  newThread(): void {
    this.inflight?.unsubscribe();
    this.thread.set(null);
    this.liveSteps.set([]);
    this.pendingQuestion.set(null);
    this.latestDraft.set(null);
    this.citedTurns.set(new Map());
    this.status.set('idle');
    this.error.set(null);
  }

  private stream(threadId: string, text: string, context: CoachMessageContext | undefined, clientTurnId: string): void {
    this.inflight?.unsubscribe();
    let answered = false;
    this.inflight = this.api.streamMessage(threadId, text, context, clientTurnId).subscribe({
      next: (event) => {
        switch (event.name) {
          case 'tool_started':
          case 'tool_finished':
          case 'thinking':
            this.recordStep(event.data);
            break;
          case 'answer':
            answered = true;
            this.finish(threadId, event.data);
            // The answer is the last event by contract. Tearing down here aborts the fetch, so
            // a proxy that holds the connection open after the server has finished cannot leave
            // one dangling socket per turn.
            queueMicrotask(() => this.inflight?.unsubscribe());
            break;
          case 'error':
            answered = true;
            this.fail(event.data);
            queueMicrotask(() => this.inflight?.unsubscribe());
            break;
        }
      },
      error: (streamFailure: unknown) => {
        const limit = limitFromError(streamFailure);
        if (limit) {
          this.fail(null, limit, text);
          return;
        }
        // The stream could not be opened: a proxy that does not pass it through, or a network that
        // dropped it. The plain endpoint gives the same answer without the progress view.
        this.api.sendMessage(threadId, text, context, clientTurnId).subscribe({
          next: (response) => this.finish(threadId, response),
          error: (failure: unknown) => {
            const plainLimit = limitFromError(failure);
            if (plainLimit) {
              this.fail(null, plainLimit, text);
              return;
            }
            this.fail('The coach could not answer just now. Your computed insights are still on the dashboard.');
          }
        });
      },
      complete: () => {
        if (!answered) {
          this.fail('The coach stopped before answering. Try asking again.');
        }
      }
    });
  }

  private recordStep(event: CoachProgressEvent): void {
    this.liveSteps.update((steps) => {
      if (event.kind === 'TOOL_FINISHED') {
        // Close the matching open step rather than appending a second row for the same tool.
        const index = steps.findIndex((s) => s.tool === event.tool && s.kind === 'TOOL_STARTED');
        if (index >= 0) {
          const next = steps.slice();
          next[index] = { tool: event.tool, kind: 'TOOL_FINISHED', summary: event.summary, latencyMs: event.latencyMs };
          return next;
        }
      }
      if (event.kind === 'THINKING' && steps.at(-1)?.kind === 'THINKING') {
        // Consecutive thinking events are one wait from the user's point of view.
        return steps;
      }
      return [...steps, { tool: event.tool, kind: event.kind, summary: event.summary, latencyMs: event.latencyMs }];
    });
  }

  /**
   * Reloads the thread so the answer shown is the persisted turn with its trace, not a client-side
   * reconstruction. Stored state and shown state stay one thing.
   */
  private finish(threadId: string, response: CoachMessageResponse): void {
    this.recordCitation(response);
    this.api.getThread(threadId).subscribe({
      next: (detail) => {
        this.thread.set(detail);
        this.settle(response.tier);
      },
      error: () => {
        // The answer arrived; only the reload failed. Show the answer from the response.
        this.thread.update((current) => appendFromResponse(current, threadId, this.pendingQuestion(), response));
        this.settle(response.tier);
      }
    });
  }

  /** Remembers this turn as citable when the server grounded it in the reading still pinned. */
  private recordCitation(response: CoachMessageResponse): void {
    const reading = this.pinnedReading();
    if (reading?.readingId && response.pinnedReadingId === reading.readingId) {
      this.citedTurns.update((turns) => {
        const next = new Map(turns);
        next.set(response.turnId, reading);
        return next;
      });
    }
  }

  private settle(tier: number): void {
    this.pendingQuestion.set(null);
    this.liveSteps.set([]);
    this.status.set(tier === -1 ? 'unavailable' : 'idle');
  }

  /**
   * Ends a turn that did not produce an answer. A limit is not a fault: it becomes a quiet notice,
   * and the question goes back into the composer so it is not lost while the wait runs out.
   */
  private fail(message: string | null, limit?: CoachLimit, question?: string): void {
    if (limit) {
      this.startLimit(limit);
      if (question) {
        this.composerPrefill.set(question);
      }
    }
    this.error.set(message);
    this.pendingQuestion.set(null);
    this.liveSteps.set([]);
    this.status.set('idle');
  }
}

/** A fresh UUID for one question; the fallback keeps an older WebView working. */
function newTurnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** A minimal thread reconstruction for when the answer arrived but the reload did not. */
function appendFromResponse(
  current: CoachThreadDetail | null,
  threadId: string,
  question: string | null,
  response: CoachMessageResponse
): CoachThreadDetail {
  const turns = current?.turns ?? [];
  const now = new Date().toISOString();
  const seq = turns.length;
  const user: CoachTurn = {
    turnId: `${response.turnId}-q`,
    seq: seq + 1,
    role: 'USER',
    content: question ?? '',
    tier: null,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: null,
    guardrailVerdict: null,
    tools: [],
    createdAt: now
  };
  const assistant: CoachTurn = {
    turnId: response.turnId,
    seq: seq + 2,
    role: 'ASSISTANT',
    content: response.answer,
    tier: response.tier,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: response.latencyMs,
    guardrailVerdict: null,
    tools: response.toolsUsed.map((tool, index) => ({
      seq: index + 1,
      tool,
      args: '{}',
      resultSummary: null,
      latencyMs: 0,
      ok: true,
      error: null
    })),
    createdAt: now
  };
  return {
    thread: current?.thread ?? { threadId, title: question, turnCount: seq + 2, lastActiveAt: now, createdAt: now },
    turns: [...turns, user, assistant]
  };
}
