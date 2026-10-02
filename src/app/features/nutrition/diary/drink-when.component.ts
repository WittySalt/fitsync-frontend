import { Component, computed, input, model, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { clockText, dayLabel } from './diary-time';

/** When a drink is logged: now for today, or a time the person picks with Change. */
@Component({
  selector: 'app-drink-when',
  imports: [FoodGlyphComponent],
  template: `
    <app-food-glyph name="CLOCK" [size]="16" [strokeWidth]="2" />
    <span class="text">{{ text() }}@if (note()) { · {{ note() }} }</span>
    @if (editing()) {
      <input type="time" aria-label="Time of this drink" [value]="clock() || fallback()" (change)="onTime($event)" />
      <button type="button" (click)="editing.set(false)">Done</button>
    } @else {
      <button type="button" (click)="editing.set(true)">Change</button>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        font-size: 13px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .text {
        min-width: 0;
        flex: 1 1 auto;
      }

      input {
        height: 32px;
        padding: 0 8px;
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text-primary);
        font: inherit;
      }

      button {
        padding: 4px 0;
        border: 0;
        background: transparent;
        color: var(--accent-text);
        font: inherit;
        font-weight: var(--fw-semibold);
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }
    `
  ]
})
export class DrinkWhenComponent {
  readonly date = input.required<string>();
  readonly today = input.required<string>();
  /** The time on the clock when the dialog opened, shown as "Now". */
  readonly opened = input.required<Date>();
  /** What the time decides, such as "counts in Snack". */
  readonly note = input('');
  /** The chosen "HH:mm", or empty for now (today) or noon (another day). */
  readonly clock = model('');

  protected readonly editing = signal(false);
  protected readonly fallback = computed(() => (this.date() === this.today() ? clockText(this.opened()) : '12:00'));
  protected readonly text = computed(() => {
    const clock = this.clock();
    if (this.date() === this.today()) {
      return clock ? `Today, ${clock}` : `Now, ${clockText(this.opened())}`;
    }
    return `${dayLabel(this.date())}, ${clock || '12:00'}`;
  });

  protected onTime(event: Event): void {
    this.clock.set((event.target as HTMLInputElement).value);
  }
}
