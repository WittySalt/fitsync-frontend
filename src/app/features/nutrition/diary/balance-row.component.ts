import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { BalanceRowView, barPercent } from './diary-figures';

/**
 * One line of the Balance card. An amount to aim for fills a green bar and gets a tick once it is
 * reached. An amount to keep under fills a dark grey bar, says over in words when it is passed and
 * shows a line where the limit is. The seven dots are this week, never red.
 */
@Component({
  selector: 'app-balance-row',
  imports: [FoodGlyphComponent],
  template: `
    <div class="line">
      <span class="label">
        <strong>{{ row().entry.displayName }}</strong>
        <strong>{{ row().value }}</strong>
        @if (row().entry.over) {
          <strong>· over</strong>
        }
        @if (row().metText) {
          <span class="met"><app-food-glyph name="CHECK" [size]="13" [strokeWidth]="3" />{{ row().metText }}</span>
        }
      </span>
      @if (dots().length) {
        <span class="dots" role="img" [attr.aria-label]="dotsLabel()">
          @for (dot of dots(); track $index) {
            <i [class.on]="dot === true" [class.missed]="dot === false"></i>
          }
        </span>
      }
    </div>
    <span class="bar" [class.limit]="row().entry.kind === 'LIMIT'">
      <span class="fill" [style.width.%]="fill()"></span>
      @if (row().marker !== null) {
        <span class="marker" [style.left.%]="row().marker"></span>
      }
    </span>
    <div class="foot">
      <span>{{ row().source }}</span>
      <span class="reference">{{ row().reference }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-variant-numeric: tabular-nums;
      }

      .line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 13px;
        color: var(--text-primary);
      }

      .label {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 2px 6px;
      }

      .met {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--accent-text);
        font-weight: var(--fw-bold);
      }

      .dots {
        flex: none;
        display: flex;
        gap: 4px;
      }

      .dots i {
        width: 8px;
        height: 8px;
        box-sizing: border-box;
        border-radius: 50%;
        background: var(--surface-sunken);
      }

      .dots i.on {
        background: var(--accent);
      }

      .dots i.missed {
        border: 1.5px solid var(--text-secondary);
        background: var(--surface);
      }

      .bar {
        position: relative;
        display: block;
        height: 8px;
        border-radius: 999px;
        background: var(--surface-sunken);
      }

      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 999px;
        background: var(--accent);
      }

      .limit .fill {
        background: var(--text-secondary);
      }

      .marker {
        position: absolute;
        top: -3px;
        bottom: -3px;
        width: 2px;
        background: var(--text-primary);
      }

      .foot {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .reference {
        flex: none;
      }
    `
  ]
})
export class BalanceRowComponent {
  readonly row = input.required<BalanceRowView>();
  /** The seven dots of this week: true on target, false missed, null not yet. */
  readonly dots = input<(boolean | null)[]>([]);

  protected readonly fill = computed(() => barPercent(this.row().entry.share));
  protected readonly dotsLabel = computed(
    () => 'This week: ' + this.dots().map((dot) => (dot === null ? 'not yet' : dot ? 'on target' : 'missed')).join(', ')
  );
}
