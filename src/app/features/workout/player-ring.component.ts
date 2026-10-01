import { Component, computed, input } from '@angular/core';

/**
 * A large ring that empties as time runs, with the figure in the middle. The ring is a picture
 * for the eye; its text equivalent is the label, which changes quietly and is not announced.
 */
@Component({
  selector: 'app-player-ring',
  template: `
    <div class="ring" role="img" [attr.aria-label]="label()" [class.still]="reducedMotion()">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle class="track" cx="50" cy="50" r="45" pathLength="100"></circle>
        <circle class="arc" [class.slate]="tone() === 'slate'" cx="50" cy="50" r="45" pathLength="100"
          [attr.stroke-dasharray]="dash()"></circle>
      </svg>
      <div class="centre" aria-hidden="true">
        <span class="figure">{{ centre() }}</span>
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

  protected readonly dash = computed(() => {
    const share = Math.min(1, Math.max(0, this.share()));
    return `${(share * 100).toFixed(1)} 100`;
  });
}
