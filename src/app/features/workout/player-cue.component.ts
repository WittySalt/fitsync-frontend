import { Component, input } from '@angular/core';

/**
 * The short cue over the exercise screen when a rest is over: "Next set ready". It comes in at the
 * top right of the screen and is gone after a moment. A set that was saved has its own check.
 */
@Component({
  selector: 'app-player-cue',
  template: `
    @if (next()) {
      <output class="next-set-cue" [class.still]="reducedMotion()">Next set ready</output>
    }
  `,
  styleUrl: './player-cue.component.scss'
})
export class PlayerCueComponent {
  readonly next = input(false);
  readonly reducedMotion = input(false);
}
