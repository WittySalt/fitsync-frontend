import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { CoachApiService } from './coach-api.service';
import { CoachContextService } from './coach-context.service';
import {
  CoachMessageResponse,
  CoachProgressEvent,
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

  readonly surface = this.context.surface;

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
  ask(question: string): void {
    const text = question.trim();
    if (!text || this.status() === 'answering') {
      return;
    }
    this.error.set(null);
    this.status.set('answering');
    this.pendingQuestion.set(text);
    this.liveSteps.set([]);

    const threadId = this.thread()?.thread.threadId;
    if (threadId) {
      this.stream(threadId, text);
      return;
    }
    this.api.createThread().subscribe({
      next: (thread) => {
        this.thread.set({ thread, turns: [] });
        this.stream(thread.threadId, text);
      },
      error: () => this.fail('The coach could not open a conversation. Try again in a moment.')
    });
  }

  /** Starts a fresh conversation. The old one stays on the server and in the thread list. */
  newThread(): void {
    this.inflight?.unsubscribe();
    this.thread.set(null);
    this.liveSteps.set([]);
    this.pendingQuestion.set(null);
    this.latestDraft.set(null);
    this.status.set('idle');
    this.error.set(null);
  }

  private stream(threadId: string, text: string): void {
    this.inflight?.unsubscribe();
    let answered = false;
    this.inflight = this.api.streamMessage(threadId, text).subscribe({
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
        this.api.sendMessage(threadId, text).subscribe({
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
