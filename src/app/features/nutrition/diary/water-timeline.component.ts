import { Component, input } from '@angular/core';

import { TimelineMark } from './diary-water';

/** The day from 6:00 to 22:00 as a line with a dot for each drink, larger for a bigger amount. */
@Component({
  selector: 'app-water-timeline',
  template: `
    <div class="axis" role="img" [attr.aria-label]="summary()">
      <span class="line"></span>
      @if (nowPercent() !== null) {
        <span class="elapsed" [style.width.%]="nowPercent()"></span>
      }
      @for (mark of marks(); track mark.key) {
        <span
          class="mark"
          [class.drink]="mark.kind === 'drink'"
          [style.left.%]="mark.left"
          [style.width.px]="mark.size"
          [style.height.px]="mark.size"
          [attr.title]="mark.label"
        ></span>
      }
    </div>
    <div class="ticks" aria-hidden="true">
      <span>6:00</span><span>12:00</span><span>18:00</span><span>22:00</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .axis {
        position: relative;
        height: 22px;
      }

      .line,
      .elapsed {
        position: absolute;
        left: 0;
        top: 50%;
        height: 2px;
        margin-top: -1px;
      }

      .line {
        right: 0;
        background: var(--border);
      }

      .elapsed {
        background: var(--border-strong);
      }

      .mark {
        position: absolute;
        top: 50%;
        box-sizing: border-box;
        transform: translate(-50%, -50%);
        border: 2px solid var(--surface);
        border-radius: 50%;
        background: var(--food-water);
      }

      .mark.drink {
        background: var(--food-drinks);
      }

      .ticks {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }
    `
  ]
})
export class WaterTimelineComponent {
  readonly marks = input<TimelineMark[]>([]);
  /** How far the day has gone, as a percentage, for today only. */
  readonly nowPercent = input<number | null>(null);
  readonly summary = input('Drinks through the day');
}
