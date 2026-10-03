import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  InjectionToken,
  Injector,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachStore } from '../../core/coach/coach.store';
import { CoachCardContext, CoachReading, CoachTurn, Recommendation } from '../../core/coach/coach.models';
import { CARD_LABELS, cardPeriod, cardPlaceholder, cardQuestions } from './card-questions';
import { CoachHistoryComponent } from './coach-history.component';
import { CoachTraceComponent } from './coach-trace.component';
import { questionsFor } from './insight/reading-questions';
import { ReadingSegment, readingSegments, withoutCitations } from './insight/reading-text';
import { dateRange } from './insight/slope-chart.geometry';
import { RecommendationCardComponent } from './recommendation-card.component';

/** The browser's `matchMedia`, injectable so a test can decide whether the sidebar is showing. */
export const MATCH_MEDIA = new InjectionToken<(query: string) => MediaQueryList | null>('MATCH_MEDIA', {
  providedIn: 'root',
  factory: () => (query: string) => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : null)
});

/** The shell shows its sidebar, and with it the coach entry, above this width. */
const SIDEBAR_QUERY = '(min-width: 861px)';

/** One suggested question, from a pinned reading or from the page the user is on. */
interface DockSuggestion {
  text: string;
  /** True when the question builds a session, which takes the drafting path. */
  draft: boolean;
}

/**
 * The coach, docked to the right edge and always mounted.
 *
 * Docked rather than floating, because a bubble covers the thing being discussed. No scrim, so
 * the page stays readable and the user can see the card they are asking about. It never opens
 * itself: the launcher and Ctrl/Cmd+K are the only ways in, and Escape or the close button the
 * ways out.
 *
 * The header says what the coach is looking at. The first screen offers the page's reading, at most
 * three questions and the input, and the older insight cards wait in a collapsed row. The thread
 * shows each turn with its trace. While a turn runs, the steps the coach is taking
 * appear one by one from the progress stream, then the persisted answer replaces them.
 */
@Component({
  selector: 'app-coach-dock',
  imports: [RouterLink, NgTemplateOutlet, RecommendationCardComponent, CoachTraceComponent, CoachHistoryComponent],
  template: `
    @if (!store.dockOpen()) {
      @if (!sidebarVisible()) {
        <button type="button" class="launch" (click)="store.open()" aria-label="Open the coach (Ctrl+K)">
          <span class="mark" aria-hidden="true">C</span>
          <span>Coach</span>
        </button>
      }
    } @else {
      @let empty = !store.turns().length && !store.pendingQuestion();
      <aside
        class="dock dock-wide"
        [class.kb]="viewport() !== null"
        [style.--dock-vh]="viewport() ? viewport()!.height + 'px' : null"
        [style.--dock-kb]="viewport() ? viewport()!.inset + 'px' : null"
        aria-label="Coach"
        role="complementary"
      >
        <div class="sr" aria-live="polite" aria-atomic="true">{{ announcement() }}</div>
        <div class="dock-head">
          <div class="dock-title">
            <span class="mark" aria-hidden="true">C</span>
            <strong>Coach</strong>
            <button type="button" class="tgl" [attr.aria-pressed]="store.historyOpen()" (click)="toggleHistory()" title="Earlier conversations">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
              History
            </button>
            @if (store.turns().length || store.historyOpen()) {
              <button type="button" class="tgl" (click)="startNew()" title="Start a new conversation">New</button>
            }
            <button type="button" class="tgl close" (click)="store.close()" aria-label="Close the coach">×</button>
          </div>
          <p class="looking">
            @if (store.pinnedReading()) {
              Looking at <b>{{ pinnedLabel(store.pinnedReading()!) }}</b> · one reading pinned
            } @else if (store.pinnedCard(); as card) {
              Looking at <b>{{ cardLabel(card) }}</b> · one card pinned
            } @else {
              Looking at <b>{{ store.surface().label }}</b>
              @if (store.inlineRecommendations().length) {
                · {{ store.inlineRecommendations().length }} {{ store.inlineRecommendations().length === 1 ? 'insight' : 'insights' }}
              }
            }
          </p>
        </div>

        @if (store.historyOpen()) {
          <app-coach-history />
        } @else {
        <div class="feed" #feed>
          @if (store.pinnedReading(); as pinned) {
            <section class="pinned" aria-label="The reading you are asking about">
              <div class="pinned-top">
                <span class="pinned-label">You are asking about</span>
                <button type="button" class="pinned-release" (click)="store.letGoOfReading()">Let go of it</button>
              </div>
              <h3 class="pinned-headline">{{ pinnedHeadline(pinned) }}</h3>
              <div class="pinned-facts">
                @for (fact of pinned.facts; track fact.number) {
                  <span class="pinned-chip" [title]="chipLabel(fact)" [attr.aria-label]="chipLabel(fact)">
                    <span class="pinned-chip-number">{{ fact.number }}</span>
                    <span class="pinned-chip-value">{{ fact.value }} {{ fact.unit }}</span>
                  </span>
                }
              </div>
            </section>
          } @else if (store.pinnedCard(); as card) {
            <section class="card-pin" aria-label="The card you are asking about">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>
              <span class="card-pin-text">
                <strong>{{ cardLabel(card) }}</strong>
                <span>{{ cardPeriod(card) }}</span>
              </span>
              <button type="button" class="card-pin-release" (click)="store.letGoOfCard()">Let go</button>
            </section>
          } @else if (empty && store.availableReading(); as reading) {
            <button type="button" class="reading-row" (click)="store.askAboutReading(reading)">
              <span class="reading-text">
                <span class="reading-label">Reading</span>
                <span class="reading-headline">{{ pinnedHeadline(reading) }}</span>
              </span>
              <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            </button>
          }

          @if (empty) {
            <ng-container [ngTemplateOutlet]="suggestionList" />
            @if (!store.pinnedReading() && !store.pinnedCard() && store.orderedRecommendations().length) {
              <section class="earlier">
                <button type="button" class="earlier-toggle" [attr.aria-expanded]="earlierOpen()" (click)="earlierOpen.set(!earlierOpen())">
                  <span class="earlier-title">Earlier notes</span>
                  <span class="earlier-count">{{ store.orderedRecommendations().length }}</span>
                  <svg class="chevron" [class.open]="earlierOpen()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6"></path>
                  </svg>
                </button>
                @if (earlierOpen()) {
                  @for (rec of store.orderedRecommendations(); track rec.type) {
                    <app-recommendation-card [recommendation]="rec" (ask)="askAbout($event)" />
                  }
                }
              </section>
            }
          }

          <div class="thread">
            @for (turn of store.turns(); track turn.turnId) {
              @if (turn.role === 'USER') {
                <div class="turn-q">{{ turn.content }}</div>
              } @else if (turn.role === 'ASSISTANT') {
                <div class="turn-a">
                  <p>@if (citedReading(turn); as citedFrom) {@for (segment of citedSegments(turn, citedFrom); track $index) {@if (segment.kind === 'text') {<span>{{ segment.text }}</span>} @else {<span class="cite-badge" [attr.aria-label]="'fact ' + segment.number">{{ segment.number }}</span>}}} @else {<span>{{ uncitedAnswer(turn) }}</span>}</p>
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
                      <span>Thinking</span>
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
                  <div class="step"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Connecting</span></div>
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

            @if (store.limitNotice(); as notice) {
              <div class="turn-a warn" role="status">{{ notice }}</div>
            }

            @if (store.error(); as error) {
              <div class="turn-a warn" role="alert">{{ error }}</div>
            }
          </div>
        </div>

        <div class="dock-foot">
          @if (store.status() === 'unavailable') {
            <p class="envelope">The coach's model is switched off right now. The insights above are computed locally and are still current.</p>
          }
          @if (!empty) {
            <ng-container [ngTemplateOutlet]="suggestionList" />
          }
          <form class="composer" (submit)="submit($event)">
            <input
              #input
              type="text"
              [value]="draft()"
              (input)="draft.set(input.value)"
              [placeholder]="composerPlaceholder()"
              autocomplete="off"
              aria-label="Ask the coach"
              [disabled]="store.status() === 'answering' || store.limited()"
            />
            <button type="submit" class="send" [disabled]="store.status() === 'answering' || store.limited() || !draft().trim()">Send</button>
          </form>
          <p class="envelope">
            The coach reads your computed facts, recent training and the exercise and food catalogues.
            It does not write to your data; accepting a draft does.
          </p>
        </div>
        }
      </aside>
    }

    <ng-template #suggestionList>
      <div class="suggs">
        @for (s of suggestions(); track s.text) {
          <button type="button" class="sugg" (click)="pick(s)" [disabled]="store.status() === 'answering' || store.limited()">
            <span class="sugg-text">{{ s.text }}</span>
            @if (s.draft) {
              <span class="draft-pill">Makes a draft</span>
            }
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6"></path>
            </svg>
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: contents;
        /* The citation badge sits on the turn bubble, whose background is var(--surface) and so
           already flips with the theme. Translated from the insight panel's own badge tokens. */
        --dock-badge: var(--slate-900);
        --dock-badge-ink: var(--white);
      }
      :host-context([data-theme='dark']) {
        --dock-badge: var(--slate-100);
        --dock-badge-ink: var(--slate-900);
      }
      @media (prefers-color-scheme: dark) {
        :host-context(:root:not([data-theme='light'])) {
          --dock-badge: var(--slate-100);
          --dock-badge-ink: var(--slate-900);
        }
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
        min-height: 44px;
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
        width: min(420px, 100vw);
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
        padding: 6px 14px 11px;
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
        padding: 0 10px;
        min-width: 44px;
        min-height: 44px;
        border-radius: var(--radius-sm);
      }
      .tgl[aria-pressed='true'] {
        background: var(--surface-sunken);
        color: var(--text-primary);
      }
      .tgl svg {
        vertical-align: -2px;
        margin-right: 3px;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
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
        margin: 0;
        overflow-wrap: anywhere;
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
      .pinned {
        box-sizing: border-box;
        border-radius: 18px;
        background: linear-gradient(145deg, var(--slate-900) 0%, var(--slate-900) 62%, var(--green-900) 100%);
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .pinned-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .pinned-label {
        font-size: 12px;
        font-weight: var(--fw-bold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--green-400);
      }
      .pinned-release {
        min-height: 44px;
        border: 0;
        background: none;
        cursor: pointer;
        color: var(--slate-300);
        font-size: 12px;
        font-weight: var(--fw-semibold);
        padding: 0 2px;
        margin: -14px -2px;
        display: inline-flex;
        align-items: center;
      }
      .pinned-release:hover {
        color: var(--white);
      }
      .pinned-headline {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 20px;
        line-height: 1.25;
        color: var(--white);
        text-wrap: balance;
        overflow-wrap: anywhere;
      }
      /* Two equal columns, so the chips line up whatever their values are. The dock is too
         narrow for four in a row. */
      .pinned-facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .pinned-chip {
        min-height: 34px;
        max-width: 100%;
        box-sizing: border-box;
        padding: 0 10px 0 4px;
        border-radius: var(--radius-full);
        background: rgba(255, 255, 255, 0.1);
        color: var(--slate-200);
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .pinned-chip-number {
        flex: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
        color: var(--white);
        font-size: 11px;
        font-weight: var(--fw-bold);
        display: flex;
        align-items: center;
        justify-content: center;
        font-variant-numeric: tabular-nums;
      }
      .pinned-chip-value {
        min-width: 0;
        color: var(--white);
        font-weight: var(--fw-bold);
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
      }
      .card-pin {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--surface-tint);
        border: 1px solid var(--accent-subtle);
        color: var(--accent-text);
      }
      .card-pin-text {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 12px;
      }
      .card-pin-text strong {
        font-size: 13px;
      }
      .card-pin-release {
        border: 0;
        background: none;
        min-height: 32px;
        font: inherit;
        font-size: 12px;
        font-weight: var(--fw-semibold);
        color: var(--accent-text);
        cursor: pointer;
      }
      .reading-row {
        box-sizing: border-box;
        width: 100%;
        min-height: 60px;
        padding: 14px 14px 14px 16px;
        border: 0;
        border-radius: 18px;
        background: linear-gradient(145deg, var(--slate-900) 0%, var(--slate-900) 62%, var(--green-900) 100%);
        text-align: left;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }
      .reading-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .reading-label {
        font-size: 12px;
        font-weight: var(--fw-bold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--green-400);
      }
      .reading-headline {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 17px;
        line-height: 1.3;
        color: var(--white);
        text-wrap: balance;
        overflow-wrap: anywhere;
      }
      .reading-row .chevron {
        flex: none;
        color: var(--slate-300);
      }
      .chevron {
        flex: none;
        color: var(--text-muted);
      }
      .draft-pill {
        flex: none;
        height: 22px;
        box-sizing: border-box;
        padding: 0 8px;
        border-radius: var(--radius-full);
        background: var(--accent-subtle);
        border: 1px solid var(--border-accent);
        color: var(--accent-text);
        font-size: 11px;
        font-weight: var(--fw-bold);
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
      }
      .cite-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin: 0 0 0 4px;
        border-radius: 50%;
        background: var(--dock-badge);
        color: var(--dock-badge-ink);
        font-size: 11px;
        font-weight: var(--fw-bold);
        line-height: 1;
        vertical-align: 2px;
        font-variant-numeric: tabular-nums;
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
        background: var(--surface-sunken);
        border-color: var(--border-strong);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
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
        background: var(--surface-sunken);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        padding: 11px 12px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .draft-link b {
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .draft-link span {
        overflow-wrap: anywhere;
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
        flex-direction: column;
        gap: 8px;
      }
      .dock-foot .suggs {
        margin-bottom: 10px;
      }
      .sugg {
        min-height: 52px;
        box-sizing: border-box;
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        color: var(--text-primary);
        font: inherit;
        font-size: 15px;
        font-weight: var(--fw-medium);
        text-align: left;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }
      .sugg:hover:not(:disabled) {
        border-color: var(--accent);
      }
      .sugg:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .sugg-text {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .earlier {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .earlier-toggle {
        min-height: 44px;
        box-sizing: border-box;
        padding: 0 14px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface-sunken);
        color: var(--text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        text-align: left;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }
      .earlier-title {
        flex: 1;
        min-width: 0;
      }
      .earlier-count {
        min-width: 22px;
        height: 22px;
        box-sizing: border-box;
        padding: 0 7px;
        border-radius: var(--radius-full);
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: 11px;
        font-weight: var(--fw-bold);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-variant-numeric: tabular-nums;
      }
      .earlier-toggle .chevron.open {
        transform: rotate(90deg);
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
        min-height: 44px;
        box-sizing: border-box;
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
        min-height: 44px;
        min-width: 56px;
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
      .pinned-release:focus-visible,
      .reading-row:focus-visible,
      .earlier-toggle:focus-visible,
      .sugg:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      @media (max-width: 640px) {
        .dock-foot {
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        }
        .dock.kb .dock-foot {
          padding-bottom: 12px;
        }
        .dock {
          top: auto;
          height: 82vh;
          max-height: var(--dock-vh, 100vh);
          bottom: var(--dock-kb, 0px);
          width: 100vw;
          border-left: 0;
          border-top: 1px solid var(--border);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }
      }
      /* Below the sidebar breakpoint the bottom navigation is on screen, so the launcher rides above it,
         and above the bar of a workout in progress when that is showing. */
      @media (max-width: 860px) {
        .launch {
          bottom: calc(88px + var(--workout-bar-space, 0px));
        }
      }
    `
  ]
})
export class CoachDockComponent {
  protected readonly store = inject(CoachStore);
  protected readonly draft = signal('');
  /** Whether the first screen's row of earlier insight cards is open. */
  protected readonly earlierOpen = signal(false);

  /** True while the shell's sidebar is showing, which carries the coach entry in place of the floating button. */
  protected readonly sidebarVisible = signal(false);

  /** Set while the on-screen keyboard covers part of the screen, so the sheet shrinks and rides above it. */
  protected readonly viewport = signal<{ height: number; inset: number } | null>(null);

  /** The latest answer, in a live region of its own, so a screen reader reads each new answer once and not the whole thread. */
  protected readonly announcement = signal('');

  @ViewChild('feed') private feed?: ElementRef<HTMLDivElement>;
  @ViewChild('input') private input?: ElementRef<HTMLInputElement>;

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** What had focus when the dock opened, so closing can give it back. */
  private opener: HTMLElement | null = null;
  private wasOpen = false;
  private wasAnswering = false;

  constructor() {
    const query = inject(MATCH_MEDIA)(SIDEBAR_QUERY);
    if (query) {
      this.sidebarVisible.set(query.matches);
      const onChange = (event: MediaQueryListEvent): void => this.sidebarVisible.set(event.matches);
      query.addEventListener?.('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener?.('change', onChange));
    }
    this.watchVisualViewport();
    // Opening moves focus into the dock; closing gives it back to whatever opened it.
    effect(() => {
      const open = this.store.dockOpen();
      untracked(() => this.onOpenChange(open));
    });
    // A finished turn is announced once. Opening an old conversation changes the thread without
    // changing the status, so it is not read out.
    effect(() => {
      const answering = this.store.status() === 'answering';
      untracked(() => {
        if (this.wasAnswering && !answering) {
          const last = [...this.store.turns()].reverse().find((turn) => turn.role === 'ASSISTANT');
          this.announcement.set(last ? withoutCitations(last.content) : '');
        }
        this.wasAnswering = answering;
      });
    });
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

  /** Tracks the visual viewport, which shrinks when a phone's keyboard opens while the layout viewport does not. */
  private watchVisualViewport(): void {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) {
      return;
    }
    const update = (): void => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      this.viewport.set(inset > KEYBOARD_MIN_INSET ? { height: Math.round(vv.height), inset: Math.round(inset) } : null);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    inject(DestroyRef).onDestroy(() => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    });
  }

  private onOpenChange(open: boolean): void {
    if (open === this.wasOpen) {
      return;
    }
    this.wasOpen = open;
    if (open) {
      const active = document.activeElement;
      this.opener = active instanceof HTMLElement && active !== document.body ? active : null;
      // The history list moves focus to itself when it is what the dock opens on.
      afterNextRender(() => (this.store.historyOpen() ? undefined : this.input?.nativeElement.focus()), { injector: this.injector });
    } else {
      const opener = this.opener;
      this.opener = null;
      afterNextRender(
        () => {
          const target = opener?.isConnected ? opener : opener ? this.host.nativeElement.querySelector<HTMLElement>('.launch') : null;
          target?.focus();
        },
        { injector: this.injector }
      );
    }
  }

  protected toggleHistory(): void {
    if (this.store.historyOpen()) {
      this.store.closeHistory();
    } else {
      this.store.openHistory();
    }
  }

  protected startNew(): void {
    this.store.newThread();
    this.store.closeHistory();
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

  /**
   * The one list of questions, at most three: those that follow from the pinned reading when there
   * is one, otherwise the page's own.
   */
  protected readonly suggestions = computed<DockSuggestion[]>(() => {
    const card = this.store.pinnedCard();
    if (card) {
      return cardQuestions(card).slice(0, 3).map((text) => ({ text, draft: false }));
    }
    const reading = this.store.pinnedReading();
    if (reading) {
      return questionsFor(reading)
        .slice(0, 3)
        .map((q) => ({ text: q.text, draft: q.makesDraft }));
    }
    return this.store
      .surface()
      .suggestions.slice(0, 3)
      .map((s) => ({ text: s.text, draft: s.generative }));
  });

  /** A suggestion: the drafting path for one that builds a session, the chat loop otherwise. */
  protected pick(suggestion: DockSuggestion): void {
    if (suggestion.draft) {
      this.store.buildSession(suggestion.text);
    } else {
      this.store.ask(suggestion.text);
    }
    this.draft.set('');
  }

  /** What the composer invites while a reading or a card is pinned. */
  protected readonly composerPlaceholder = computed(() => {
    const card = this.store.pinnedCard();
    if (card) {
      return cardPlaceholder(card);
    }
    return this.store.pinnedReading() ? 'Ask about this reading' : 'Ask, or ask it to build something…';
  });

  protected cardLabel(card: CoachCardContext): string {
    return CARD_LABELS[card.kind] ?? 'Card';
  }

  protected cardPeriod(card: CoachCardContext): string {
    return cardPeriod(card);
  }

  /** The pinned card's headline, or a fallback for a reading that is facts only. */
  protected pinnedHeadline(reading: CoachReading): string {
    return reading.reading?.headline || 'Your measured facts';
  }

  /**
   * The page and the days a pinned reading describes, for example "Workout, 21 to 27 Sept".
   * A reading describes the last full week until the current one has enough sessions, so the
   * surface's own label, which says "this week", would name the wrong days.
   */
  protected pinnedLabel(reading: CoachReading): string {
    const page = reading.surface.charAt(0) + reading.surface.slice(1).toLowerCase();
    const days = dateRange(reading.periodStart, reading.periodEnd);
    return days ? `${page}, ${days}` : page;
  }

  protected chipLabel(fact: CoachReading['facts'][number]): string {
    return `fact ${fact.number}: ${fact.label}, ${fact.value} ${fact.unit}`;
  }

  /** The reading this turn's answer was grounded in, if the server cited one, for badge rendering. */
  protected citedReading(turn: CoachTurn): CoachReading | null {
    return this.store.citedTurns().get(turn.turnId) ?? null;
  }

  protected citedSegments(turn: CoachTurn, reading: CoachReading): ReadingSegment[] {
    return readingSegments(turn.content, reading.facts.length);
  }

  /** An answer the server did not cite: markers are stripped so a stray `[2]` never shows as text. */
  protected uncitedAnswer(turn: CoachTurn): string {
    return withoutCitations(turn.content);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    this.handleKeydown(event);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      // Typing somewhere else on the page keeps the browser's own shortcut; only the dock's own
      // composer, where the shortcut closes the dock, still answers to it.
      if (isTypingOutsideDock(event.target)) {
        return;
      }
      event.preventDefault();
      this.store.toggle();
      return;
    }
    if (event.key === 'Escape' && this.store.dockOpen()) {
      this.store.close();
    }
  }
}

/** The keyboard is taken to be open when the visual viewport is this much shorter than the window. */
const KEYBOARD_MIN_INSET = 120;

/** True when the key press came from a text field, or editable content, that is not inside the dock. */
export function isTypingOutsideDock(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const editable = target.isContentEditable || target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null;
  return editable && target.closest('.dock') === null;
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
