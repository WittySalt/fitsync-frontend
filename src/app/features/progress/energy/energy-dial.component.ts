import { Component, computed, input } from '@angular/core';

import { dialGeometry, dialSummary } from './energy-figures';

const SIZE = 210;

/**
 * The dial: a half circle from 1,000 under to 1,000 over with "even" at the top, and a needle at
 * the daily average of the week. One colour on either side, since over is not a warning.
 */
@Component({
  selector: 'app-energy-dial',
  template: `
    <svg [attr.viewBox]="'0 0 ' + dial().width + ' ' + dial().height" role="img" [attr.aria-label]="summary()" focusable="false">
      <path class="track" [attr.d]="dial().track"></path>
      @if (dial().value) {
        <path class="value" [attr.d]="dial().value"></path>
      }
      <line class="tick" [attr.x1]="dial().tick.x1" [attr.y1]="dial().tick.y1" [attr.x2]="dial().tick.x2" [attr.y2]="dial().tick.y2"></line>
      <line class="needle" [attr.x1]="dial().cx" [attr.y1]="dial().cy" [attr.x2]="dial().needle.x" [attr.y2]="dial().needle.y"></line>
      <circle class="hub" [attr.cx]="dial().cx" [attr.cy]="dial().cy" r="7"></circle>
      <text [attr.x]="dial().labels.left.x" [attr.y]="dial().labels.left.y" text-anchor="middle">{{ '−1,000' }}</text>
      <text [attr.x]="dial().labels.even.x" [attr.y]="dial().labels.even.y" text-anchor="middle">even</text>
      <text [attr.x]="dial().labels.right.x" [attr.y]="dial().labels.right.y" text-anchor="middle">+1,000</text>
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      svg {
        display: block;
        width: 100%;
        max-width: 220px;
        height: auto;
        margin: 0 auto;
        overflow: visible;
      }

      path {
        fill: none;
        stroke-width: 16;
        stroke-linecap: round;
      }

      .track {
        stroke: var(--border-strong);
      }

      .value {
        stroke: var(--accent);
      }

      .tick,
      .needle {
        stroke: var(--text-primary);
        stroke-linecap: round;
      }

      .tick {
        stroke-width: 1.5;
      }

      .needle {
        stroke-width: 3;
        transition: all var(--dur-slow) var(--ease-standard);
      }

      .hub {
        fill: var(--text-primary);
      }

      text {
        font: 400 11px var(--font-sans);
        fill: var(--text-secondary);
      }

      @media (prefers-reduced-motion: reduce) {
        .needle {
          transition: none;
        }
      }
    `
  ]
})
export class EnergyDialComponent {
  /** The average daily balance in kcal: negative is under, positive is over. */
  readonly balance = input.required<number>();

  protected readonly dial = computed(() => dialGeometry(SIZE, this.balance()));
  protected readonly summary = computed(() => dialSummary(this.balance()));
}
