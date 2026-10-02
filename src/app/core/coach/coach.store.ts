import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, Subscription, tap } from 'rxjs';

import { CoachApiService } from './coach-api.service';
import { CoachContextService } from './coach-context.service';
import {
  AcceptSessionDraftResponse,
  CoachMessageContext,
  CoachMessageResponse,
  CoachProgressEvent,
  CoachReading,
  CoachThreadDetail,
  CoachTurn,
  Recommendation,
  SessionDraftView
} from './coach.models';

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
    this.pinnedReading.set(reading);
    this.open();
  }

  letGoOfReading(): void {
    this.pinnedReading.set(null);
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

  readonly turns = computed<CoachTurn[]>(() => this.thread()?.turns ?? []);

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
    if (!text || this.status() === 'answering') {
      return;
    }
    this.error.set(null);
    this.status.set('answering');
    this.pendingQuestion.set(text);
    this.liveSteps.set([]);

    const context = this.buildContext(about);
    const threadId = this.thread()?.thread.threadId;
    if (threadId) {
      this.stream(threadId, text, context);
      return;
    }
    this.api.createThread().subscribe({
      next: (thread) => {
        this.thread.set({ thread, turns: [] });
        this.stream(thread.threadId, text, context);
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
    const code = about?.recipeId ? 'NUTRITION' : this.surface().code;
    if (!code) {
      return undefined;
    }
    const context: CoachMessageContext = { surface: code };
    if (about?.recipeId) {
      context.recipeId = about.recipeId;
    }
    const reading = this.pinnedReading();
    if (reading?.readingId) {
      context.readingId = reading.readingId;
      context.timezone = deviceTimezone();
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
    if (this.status() === 'answering') {
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
        if (this.latestDraft()?.artifactId === artifactId) {
          this.latestDraft.update((d) => (d ? { ...d, status: 'ACCEPTED', planId: accepted.planId, sessionId: accepted.sessionId } : d));
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

  private stream(threadId: string, text: string, context: CoachMessageContext | undefined): void {
    this.inflight?.unsubscribe();
    let answered = false;
    this.inflight = this.api.streamMessage(threadId, text, context).subscribe({
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
      error: () => {
        // The stream could not be opened: a proxy that does not pass it through, or a network that
        // dropped it. The plain endpoint gives the same answer without the progress view.
        this.api.sendMessage(threadId, text, context).subscribe({
          next: (response) => this.finish(threadId, response),
          error: () => this.fail('The coach could not answer just now. Your computed insights are still on the dashboard.')
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

  private fail(message: string): void {
    this.error.set(message);
    this.pendingQuestion.set(null);
    this.liveSteps.set([]);
    this.status.set('idle');
  }
}

/** The device's IANA zone, guarded because an unsupported environment can throw rather than return one. */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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
