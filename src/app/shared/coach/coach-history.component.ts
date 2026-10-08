import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';

import { CoachThreadSummary } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { HistoryGroup, historyGroup, relativeWhen, surfaceLabel } from './history-time';

interface HistoryRow {
  thread: CoachThreadSummary;
  when: string;
  surface: string | null;
}

const GROUP_ORDER: HistoryGroup[] = ['Today', 'This week', 'Earlier'];

/**
 * The list of earlier conversations, shown inside the dock in place of the current one.
 *
 * Grouped by today, this week and earlier, newest first as the server sends them, with "Show more"
 * paging. Archiving sits in each row's overflow and asks first; the confirm is the only red thing
 * here, because it is the only action that takes something away.
 */
@Component({
  selector: 'app-coach-history',
  template: `
    <section class="history" aria-label="Earlier conversations">
      <div class="bar">
        <button #back type="button" class="back" (click)="store.closeHistory()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
          Back
        </button>
        <h2>History</h2>
      </div>

      @if (store.historyNotice(); as notice) {
        <p class="note" role="status">{{ notice }}</p>
      }

      @switch (store.historyStatus()) {
        @case ('loading') {
          <div class="skeleton" aria-busy="true" aria-label="Loading conversations">
            <i></i><i></i><i></i><i></i>
          </div>
        }
        @case ('error') {
          <div class="state" role="alert">
            <p>The earlier conversations could not be loaded.</p>
            <button type="button" class="quiet" (click)="store.openHistory()">Try again</button>
          </div>
        }
        @default {
          @if (!groups().length) {
            <p class="state">No earlier conversations yet.</p>
          }
          @for (group of groups(); track group.name) {
            <h3>{{ group.name }}</h3>
            <ul>
              @for (row of group.rows; track row.thread.threadId) {
                <li [class.current]="row.thread.threadId === store.currentThreadId()">
                  <button type="button" class="open" [attr.aria-current]="row.thread.threadId === store.currentThreadId() ? 'true' : null" (click)="store.openThread(row.thread.threadId)">
                    <span class="title">{{ row.thread.title || 'Untitled conversation' }}</span>
                    <span class="meta">
                      @if (row.surface) {
                        <span class="chip">{{ row.surface }}</span>
                      }
                      <span>{{ row.when }}</span>
                    </span>
                  </button>
                  <button type="button" class="more" [attr.aria-label]="'More for ' + (row.thread.title || 'this conversation')" [attr.aria-expanded]="openMenuId() === row.thread.threadId" (click)="toggleMenu(row.thread.threadId)">&#8943;</button>
                  @if (openMenuId() === row.thread.threadId) {
                    <div class="menu">
                      @if (confirmingId() === row.thread.threadId) {
                        <span>Archive this conversation? It leaves this list.</span>
                        <button type="button" class="confirm" (click)="archive(row.thread.threadId)">Archive</button>
                        <button type="button" class="quiet" (click)="toggleMenu(null)">Cancel</button>
                      } @else {
                        <button type="button" class="quiet" (click)="confirmingId.set(row.thread.threadId)">Archive</button>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          }
          @if (store.historyHasMore()) {
            <button type="button" class="quiet wide" [disabled]="store.historyLoadingMore()" (click)="store.loadMoreHistory()">
              {{ store.historyLoadingMore() ? 'Loading…' : 'Show more' }}
            </button>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      .history {
        padding: 6px 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      h2 {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      h3 {
        margin: 8px 0 0;
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      li {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: stretch;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
      }
      li.current {
        border-color: var(--accent);
        background: var(--accent-subtle);
      }
      button {
        font: inherit;
        cursor: pointer;
        color: var(--text-primary);
      }
      .back,
      .quiet,
      .more {
        min-height: 44px;
        padding: 0 12px;
        border: 0;
        border-radius: var(--radius-sm);
        background: none;
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        color: var(--text-secondary);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .more {
        min-width: 44px;
        justify-content: center;
        font-size: 18px;
      }
      .back:hover,
      .quiet:hover,
      .more:hover {
        background: var(--surface-sunken);
        color: var(--text-primary);
      }
      .wide {
        align-self: center;
      }
      .open {
        min-height: 56px;
        padding: 9px 4px 9px 14px;
        border: 0;
        background: none;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .title {
        font-size: var(--text-sm);
        font-weight: var(--fw-medium);
        overflow-wrap: anywhere;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--text-xs);
        color: var(--text-muted);
      }
      .chip {
        padding: 1px 8px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border);
        background: var(--surface-sunken);
        color: var(--text-secondary);
        font-weight: var(--fw-semibold);
      }
      .menu {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        padding: 0 10px 8px 14px;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .menu span {
        flex: 1 1 100%;
      }
      .confirm {
        min-height: 44px;
        padding: 0 14px;
        border: 0;
        border-radius: var(--radius-md);
        background: var(--danger);
        color: var(--white);
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
      }
      :host-context([data-theme='dark']) .confirm {
        color: var(--slate-900);
      }
      .note,
      .state {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .state {
        padding: 18px 4px;
        text-align: center;
      }
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .skeleton i {
        height: 56px;
        border-radius: 14px;
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        animation: pulse 1.4s ease-in-out infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton i {
          animation: none;
        }
      }
      button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
    `
  ]
})
export class CoachHistoryComponent {
  protected readonly store = inject(CoachStore);
  private readonly injector = inject(Injector);
  private readonly backButton = viewChild<ElementRef<HTMLButtonElement>>('back');

  /** The conversation whose overflow is open, and the one waiting on its archive confirm. */
  protected readonly openMenuId = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly groups = computed(() => {
    const now = new Date();
    const byGroup = new Map<HistoryGroup, HistoryRow[]>();
    for (const thread of this.store.history()) {
      const group = historyGroup(thread.lastMessageAt, now);
      const rows = byGroup.get(group) ?? [];
      rows.push({ thread, when: relativeWhen(thread.lastMessageAt, now), surface: surfaceLabel(thread.surface) });
      byGroup.set(group, rows);
    }
    return GROUP_ORDER.filter((name) => byGroup.has(name)).map((name) => ({ name, rows: byGroup.get(name) ?? [] }));
  });

  constructor() {
    // Opening the list moves focus into it, as opening the dock moves focus into the dock.
    afterNextRender(() => this.backButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected toggleMenu(id: string | null): void {
    this.confirmingId.set(null);
    this.openMenuId.set(id === null || this.openMenuId() === id ? null : id);
  }

  protected archive(id: string): void {
    this.store.archiveThread(id);
    this.toggleMenu(null);
  }
}
