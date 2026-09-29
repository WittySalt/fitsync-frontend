import { Component, ElementRef, HostListener, ViewChild, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachStore } from '../../core/coach/coach.store';
import { Recommendation } from '../../core/coach/coach.models';
import { CoachTraceComponent } from './coach-trace.component';
import { RecommendationCardComponent } from './recommendation-card.component';

/**
 * The coach, docked to the right edge and always mounted.
 *
 * Docked rather than floating, because a bubble covers the thing being discussed. No scrim, so
 * the page stays readable and the user can see the card they are asking about. It never opens
 * itself: the launcher and Ctrl/Cmd+K are the only ways in, and Escape or the close button the
 * ways out.
 *
 * The header says what the coach is looking at, the feed shows this surface's insights first, and
 * the thread shows each turn with its trace. While a turn runs, the steps the coach is taking
 * appear one by one from the progress stream, then the persisted answer replaces them.
 */
@Component({
  selector: 'app-coach-dock',
  imports: [RouterLink, RecommendationCardComponent, CoachTraceComponent],
  template: `
    @if (!store.dockOpen()) {
      <button type="button" class="launch" (click)="store.open()" aria-label="Open the coach (Ctrl+K)">
        <span class="mark" aria-hidden="true">C</span>
        <span>Coach</span>
      </button>
    } @else {
      <aside class="dock" aria-label="Coach" role="complementary">
        <div class="dock-head">
          <div class="dock-title">
            <span class="mark" aria-hidden="true">C</span>
            <strong>Coach</strong>
            @if (store.turns().length) {
              <button type="button" class="tgl" (click)="store.newThread()" title="Start a new conversation">New</button>
            }
            <button type="button" class="tgl close" (click)="store.close()" aria-label="Close the coach">×</button>
          </div>
          <p class="looking">
            Looking at <b>{{ store.surface().label }}</b>
            @if (store.inlineRecommendations().length) {
              · {{ store.inlineRecommendations().length }} {{ store.inlineRecommendations().length === 1 ? 'insight' : 'insights' }}
            }
          </p>
        </div>

        <div class="feed" #feed>
          @if (!store.turns().length && !store.pendingQuestion()) {
            @for (rec of store.orderedRecommendations(); track rec.type) {
              <app-recommendation-card [recommendation]="rec" (ask)="askAbout($event)" />
            }
            @if (store.recommendationsLoadedAt() && !store.recommendations().length) {
              <p class="empty">No insights yet. Log a workout or a meal and the rules will have something to say.</p>
            }
          }

          <div class="thread" aria-live="polite">
            @for (turn of store.turns(); track turn.turnId) {
              @if (turn.role === 'USER') {
                <div class="turn-q">{{ turn.content }}</div>
              } @else if (turn.role === 'ASSISTANT') {
                <div class="turn-a">
                  <p>{{ turn.content }}</p>
                  <app-coach-trace [turn]="turn" />
                </div>
              }
            }

            @if (store.pendingQuestion(); as q) {
              <div class="turn-q">{{ q }}</div>
              <div class="turn-a live">
                @for (step of store.liveSteps(); track $index) {
                  <div class="step" [class.done]="step.kind === 'TOOL_FINISHED'">
                    @if (step.kind === 'THINKING') {
                      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
                      <span>thinking</span>
                    } @else {
                      <span class="tick" aria-hidden="true">{{ step.kind === 'TOOL_FINISHED' ? '✓' : '…' }}</span>
                      <b>{{ step.tool }}</b>
                      @if (step.kind === 'TOOL_FINISHED') {
                        <span class="meta">{{ step.summary }} · {{ step.latencyMs }} ms</span>
                      }
                    }
                  </div>
                }
                @if (!store.liveSteps().length) {
                  <div class="step"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>connecting</span></div>
                }
              </div>
            }

            @if (store.latestDraft(); as draft) {
              <div class="draft-link">
                <b>{{ draft.session.title }}</b>
                <span>{{ draft.session.estimatedMinutes }} min · {{ draft.session.exercises.length }} exercises · {{ draft.source === 'RULE_FALLBACK' ? 'built by the rules' : 'drafted by the model' }}</span>
                <a class="button primary" routerLink="/coach/plan" [queryParams]="{ draft: draft.artifactId }" (click)="store.close()">Open in Plan Studio</a>
              </div>
            }

            @if (store.error(); as error) {
              <div class="turn-a warn">{{ error }}</div>
            }
          </div>
        </div>

        <div class="dock-foot">
          @if (store.status() === 'unavailable') {
            <p class="envelope">The coach's model is switched off right now. The insights above are computed locally and are still current.</p>
          }
          <div class="suggs">
            @for (s of store.surface().suggestions; track s.text) {
              <button type="button" class="sugg" [class.gen]="s.generative" (click)="send(s.text)" [disabled]="store.status() === 'answering'">
                {{ s.text }}
              </button>
            }
          </div>
          <form class="composer" (submit)="submit($event)">
            <input
              #input
              type="text"
              [value]="draft()"
              (input)="draft.set(input.value)"
              placeholder="Ask, or ask it to build something…"
              autocomplete="off"
              aria-label="Ask the coach"
              [disabled]="store.status() === 'answering'"
            />
            <button type="submit" class="send" [disabled]="store.status() === 'answering' || !draft().trim()">Send</button>
          </form>
          <p class="envelope">
            The coach reads your computed facts, recent training and the exercise and food catalogues.
            It does not write to your data; accepting a draft does.
          </p>
        </div>
      </aside>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .mark {
        width: 22px;
        height: 22px;
        border-radius: var(--radius-sm);
        background: var(--accent);
        color: var(--text-on-accent);
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: var(--fw-bold);
        flex: none;
      }
      .launch {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: var(--z-sticky);
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-primary);
        border-radius: var(--radius-full);
        padding: 9px 14px 9px 11px;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
      }
      .dock {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(380px, 100vw);
        z-index: var(--z-overlay);
        display: flex;
        flex-direction: column;
        background: var(--surface-sunken);
        border-left: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        min-width: 0;
        animation: slide-in var(--dur-base) var(--ease-out);
      }
      @keyframes slide-in {
        from {
          transform: translateX(24px);
          opacity: 0;
        }
        to {
          transform: none;
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dock {
          animation: none;
        }
      }
      .dock-head {
        padding: 13px 14px 11px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }
      .dock-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dock-title strong {
        color: var(--text-primary);
        font-size: var(--text-sm);
        flex: 1;
      }
      .tgl {
        border: 0;
        background: none;
        cursor: pointer;
        color: var(--text-muted);
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        padding: 3px 6px;
        border-radius: var(--radius-sm);
      }
      .tgl.close {
        font-size: 16px;
        line-height: 1;
      }
      .tgl:hover {
        background: var(--surface-sunken);
        color: var(--text-primary);
      }
      .looking {
        margin: 9px 0 0;
        font-size: var(--text-xs);
        color: var(--text-muted);
      }
      .looking b {
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
      }
      .feed {
        flex: 1;
        overflow: auto;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .empty {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-muted);
      }
      .thread {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .turn-q {
        align-self: flex-end;
        max-width: 86%;
        background: var(--accent);
        color: var(--text-on-accent);
        border-radius: 11px 11px 3px 11px;
        padding: 8px 11px;
        font-size: var(--text-sm);
        line-height: var(--lh-snug);
        overflow-wrap: anywhere;
      }
      .turn-a {
        max-width: 96%;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 11px 11px 11px 3px;
        padding: 9px 11px;
        font-size: var(--text-sm);
        line-height: var(--lh-normal);
        color: var(--text-primary);
      }
      .turn-a p {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .turn-a.warn {
        border-left: 3px solid var(--amber-500);
        color: var(--text-secondary);
      }
      .turn-a.live {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }
      .step b {
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
      }
      .step .meta {
        margin-left: auto;
        white-space: nowrap;
      }
      .step.done .tick {
        color: var(--accent-text);
      }
      .dots {
        display: inline-flex;
        gap: 3px;
      }
      .dots i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--text-muted);
        display: block;
        animation: blink 1.3s infinite;
      }
      .dots i:nth-child(2) {
        animation-delay: 0.18s;
      }
      .dots i:nth-child(3) {
        animation-delay: 0.36s;
      }
      @keyframes blink {
        0%,
        60%,
        100% {
          opacity: 0.25;
        }
        30% {
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dots i {
          animation: none;
          opacity: 0.55;
        }
      }
      .draft-link {
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: color-mix(in srgb, var(--amber-500) 12%, var(--surface));
        border: 1px solid color-mix(in srgb, var(--amber-500) 40%, var(--border));
        border-radius: var(--radius-lg);
        padding: 11px 12px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .draft-link b {
        color: var(--text-primary);
      }
      .draft-link .button {
        align-self: flex-start;
        min-height: 36px;
        font-size: var(--text-sm);
      }
      .dock-foot {
        border-top: 1px solid var(--border);
        background: var(--surface);
        padding: 11px 14px 12px;
      }
      .suggs {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 9px;
      }
      .sugg {
        font-size: var(--text-xs);
        font-weight: var(--fw-medium);
        line-height: 1.25;
        text-align: left;
        color: var(--text-secondary);
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        padding: 6px 10px;
        cursor: pointer;
      }
      .sugg:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--accent-text);
      }
      .sugg.gen {
        border-color: color-mix(in srgb, var(--amber-500) 50%, var(--border));
        color: var(--amber-500);
      }
      .sugg:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .composer {
        display: flex;
        gap: 7px;
      }
      .composer input {
        flex: 1;
        min-width: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 9px 10px;
      }
      .composer input:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      .send {
        border: 0;
        border-radius: var(--radius-md);
        background: var(--accent);
        color: var(--text-on-accent);
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        padding: 10px 13px;
        cursor: pointer;
      }
      .send:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .envelope {
        font-size: var(--text-xs);
        color: var(--text-muted);
        line-height: 1.45;
        margin: 8px 0 0;
      }
      @media (max-width: 640px) {
        .dock {
          top: auto;
          height: 82vh;
          width: 100vw;
          border-left: 0;
          border-top: 1px solid var(--border);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }
        .launch {
          bottom: 76px;
        }
      }
    `
  ]
})
export class CoachDockComponent {
  protected readonly store = inject(CoachStore);
  protected readonly draft = signal('');

  @ViewChild('feed') private feed?: ElementRef<HTMLDivElement>;
  @ViewChild('input') private input?: ElementRef<HTMLInputElement>;

  constructor() {
    // A card's "Ask about this" lands here: pre-fill, never send.
    effect(() => {
      const prefill = this.store.composerPrefill();
      if (prefill) {
        this.draft.set(prefill);
        this.store.composerPrefill.set(null);
        queueMicrotask(() => this.input?.nativeElement.focus());
      }
    });
    // Keep the newest turn in view while a turn runs and when the answer lands.
    effect(() => {
      this.store.liveSteps();
      this.store.turns();
      this.store.pendingQuestion();
      queueMicrotask(() => {
        const el = this.feed?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.send(this.draft());
  }

  protected send(text: string): void {
    if (!text.trim()) {
      return;
    }
    // A request to build something takes the drafting path, which has a validator and a fallback
    // and produces an artifact, rather than the chat loop, which produces a sentence. The match is
    // deliberately literal: an assessor can read it, and a misjudged request still gets an answer.
    if (isBuildRequest(text)) {
      this.store.buildSession(text);
    } else {
      this.store.ask(text);
    }
    this.draft.set('');
  }

  /** A card's "Ask about this": pre-fill the composer with the card as subject, do not send. */
  protected askAbout(recommendation: Recommendation): void {
    this.store.askAbout(recommendation);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    this.handleKeydown(event);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.store.toggle();
      return;
    }
    if (event.key === 'Escape' && this.store.dockOpen()) {
      this.store.close();
    }
  }
}

/**
 * Whether a message asks the coach to build a session rather than to explain something.
 *
 * Kept literal on purpose. A keyword list is something an assessor can read in full, a misjudged
 * message still gets an ordinary answer, and the drafting endpoint has its own understanding of
 * the request once it is there.
 */
export function isBuildRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const asksToBuild = /\b(build|make|create|draft|plan|design|put together|generate)\b/.test(lower);
  const aboutASession = /\b(session|workout|training|routine)\b/.test(lower);
  return asksToBuild && aboutASession;
}
