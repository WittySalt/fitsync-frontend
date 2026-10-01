import { Component, computed, effect, input, signal, untracked } from '@angular/core';

import { flipOnChange } from './flip-on-change';

/**
 * A large ring with the figure in the middle. The ring is a picture for the eye; its text
 * equivalent is the label, which changes quietly and is not announced.
 *
 * It empties as time runs. With `sweep` the arc empties once for every figure instead, which is
 * how the countdown before a set turns. When the share grows (a rest was lengthened) the arc grows
 * back with an ease, and in the last seconds (`urgent`) the figure pulses.
 */
@Component({
  selector: 'app-player-ring',
  template: `
    <div
      class="ring"
      role="img"
      [attr.aria-label]="label()"
      [class.still]="reducedMotion()"
      [class.grow]="growing()"
      [class.urgent]="urgent()"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle class="track" cx="50" cy="50" r="45" pathLength="100"></circle>
        @if (sweep()) {
          <circle class="arc sweeping" [class.a]="!flipped()" [class.b]="flipped()" cx="50" cy="50" r="45" pathLength="100"></circle>
        } @else {
          <circle class="arc" [class.slate]="tone() === 'slate'" cx="50" cy="50" r="45" pathLength="100"
            [attr.stroke-dasharray]="dash()"></circle>
        }
      </svg>
      <div class="centre" aria-hidden="true">
        <span class="figure" [class.pop]="pop()" [class.pulse]="urgent()" [class.a]="!flipped()" [class.b]="flipped()">{{ centre() }}</span>
        <span class="caption">{{ caption() }}</span>
      </div>
    </div>
  `,
  styleUrl: './player-ring.component.scss'
})
export class PlayerRingComponent {
  /** How much of the ring is still filled, from 0 to 1. */
  readonly share = input.required<number>();
  readonly centre = input.required<string>();
  readonly caption = input('');
  readonly label = input.required<string>();
  readonly tone = input<'accent' | 'slate'>('accent');
  /** With reduced motion the ring jumps to its value; the figure still changes. */
  readonly reducedMotion = input(false);
  /** The countdown before a set: a full sweep for every figure, and each figure pops in. */
  readonly sweep = input(false);
  readonly pop = input(false);
  /** The last seconds: the arc turns a deeper green and the figure pulses. */
  readonly urgent = input(false);

  protected readonly growing = signal(false);
  /** Turns over with every new figure, so the pop, the pulse and the sweep start again. */
  protected readonly flipped = flipOnChange(() => this.centre());
  private previousShare = -1;

  protected readonly dash = computed(() => {
    const share = Math.min(1, Math.max(0, this.share()));
    return `${(share * 100).toFixed(1)} 100`;
  });

  constructor() {
    effect(() => {
      const share = this.share();
      untracked(() => {
        this.growing.set(this.previousShare >= 0 && share > this.previousShare + 0.001);
        this.previousShare = share;
      });
    });
  }
}
