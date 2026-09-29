import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { Recommendation } from '../../core/coach/coach.models';

/**
 * One insight: the sentence and the numbers it came from, side by side.
 *
 * The fact chips are the point of the card. Without them this is a chat bubble; with them the
 * user can check the sentence against the figures, and an assessor can see that the system
 * computed and the model only phrased. The freshness line is the other non-negotiable: every card
 * says when it was generated, because presenting stored state as live state was the defect family
 * of an entire week and the newest surface must not reintroduce it.
 */
@Component({
  selector: 'app-recommendation-card',
  template: `
    <article class="rec-card" [class.ai]="recommendation.source === 'AI'">
      <div class="rec-top">
        <span class="rec-type">{{ typeLabel() }}</span>
        <span class="rec-badge">{{ recommendation.source }}</span>
        <span class="rec-fresh" [attr.title]="recommendation.generatedAt">{{ freshness() }}</span>
      </div>
      <p class="rec-say">{{ recommendation.narrative }}</p>
      @if (chips().length) {
        <div class="rec-chips">
          @for (chip of chips(); track chip) {
            <span class="rec-chip">{{ chip }}</span>
          }
        </div>
      }
      @if (askable) {
        <div class="rec-acts">
          <button type="button" class="rec-btn" (click)="ask.emit(recommendation)">Ask about this</button>
        </div>
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rec-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 12px 13px;
      }
      .rec-card.ai {
        border-color: color-mix(in srgb, var(--amber-500) 45%, var(--border));
      }
      .rec-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .rec-type {
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent-text);
      }
      .rec-card.ai .rec-type {
        color: var(--amber-500);
      }
      .rec-badge {
        font-size: 10px;
        font-weight: var(--fw-semibold);
        letter-spacing: 0.06em;
        padding: 3px 5px;
        border-radius: var(--radius-sm);
        background: var(--accent-subtle);
        color: var(--accent-text);
      }
      .rec-card.ai .rec-badge {
        background: color-mix(in srgb, var(--amber-500) 16%, var(--surface));
        color: var(--amber-500);
      }
      .rec-fresh {
        margin-left: auto;
        font-size: var(--text-xs);
        color: var(--text-muted);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .rec-say {
        margin: 0;
        color: var(--text-primary);
        font-size: var(--text-sm);
        line-height: var(--lh-normal);
      }
      .rec-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 9px;
      }
      .rec-chip {
        font-size: var(--text-xs);
        font-weight: var(--fw-medium);
        color: var(--text-secondary);
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px 6px;
        font-variant-numeric: tabular-nums;
      }
      .rec-acts {
        display: flex;
        gap: 12px;
        margin-top: 10px;
        padding-top: 9px;
        border-top: 1px solid var(--border);
      }
      .rec-btn {
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--accent-text);
      }
      .rec-btn:hover {
        text-decoration: underline;
      }
    `
  ]
})
export class RecommendationCardComponent {
  private readonly rec = signal<Recommendation | null>(null);

  @Input({ required: true })
  set recommendation(value: Recommendation) {
    this.rec.set(value);
  }
  get recommendation(): Recommendation {
    return this.rec()!;
  }

  @Input() askable = true;
  @Output() ask = new EventEmitter<Recommendation>();

  readonly typeLabel = computed(() => (this.rec()?.type ?? '').toLowerCase().replace(/_/g, ' '));

  readonly freshness = computed(() => relativeTime(this.rec()?.generatedAt));

  /**
   * The facts as short chips, in the order the server gave them. Only scalars are shown: a nested
   * object is a structure for the model, not a number for a person.
   */
  readonly chips = computed(() => factChips(this.rec()?.facts ?? {}));
}

export function factChips(facts: Record<string, unknown>): string[] {
  const chips: string[] = [];
  for (const [key, value] of Object.entries(facts)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'number') {
      chips.push(`${humanKey(key)} ${Number.isInteger(value) ? value : value.toFixed(1)}`);
    } else if (typeof value === 'string' && value.length <= 40) {
      chips.push(`${humanKey(key)} ${value.toLowerCase().replace(/_/g, ' ')}`);
    } else if (typeof value === 'boolean') {
      chips.push(`${humanKey(key)} ${value ? 'yes' : 'no'}`);
    }
    if (chips.length >= 5) {
      break;
    }
  }
  return chips;
}

function humanKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toLowerCase();
}

export function relativeTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) {
    return '';
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
