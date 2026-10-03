import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CoachCardContext } from '../../core/coach/coach.models';
import { CARD_LABELS, cardPeriod } from './card-questions';

/** The small chip the coach shows for a pinned Progress card: its name, its days, and "Let go". */
@Component({
  selector: 'app-card-pin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pin" aria-label="The card you are asking about">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>
      <span class="text">
        <strong>{{ label() }}</strong>
        <span>{{ period() }}</span>
      </span>
      <button type="button" class="release" (click)="release.emit()">Let go</button>
    </section>
  `,
  styles: `
    .pin { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--surface-tint); border: 1px solid var(--accent-subtle); color: var(--accent-text); }
    .text { flex-grow: 1; display: flex; flex-direction: column; gap: 1px; font-size: 12px; }
    strong { font-size: 13px; }
    .release { border: 0; background: none; min-height: 32px; font: inherit; font-size: 12px; font-weight: 600; color: var(--accent-text); cursor: pointer; }
    .release:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
  `
})
export class CardPinComponent {
  readonly card = input.required<CoachCardContext>();
  readonly release = output<void>();

  protected readonly label = computed(() => CARD_LABELS[this.card().kind] ?? 'Card');
  protected readonly period = computed(() => cardPeriod(this.card()));
}
