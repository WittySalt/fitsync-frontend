import { Component, input } from '@angular/core';

/**
 * The two short cues over the exercise screen: "Done" when a set was saved, and "Next set ready"
 * when a rest is over. They pop in at the top right of the screen and are gone after a second.
 */
@Component({
  selector: 'app-player-cue',
  template: `
    @if (done()) {
      <output class="set-complete-badge" [class.still]="reducedMotion()">
        <span aria-hidden="true">✓</span>
        <strong>Done</strong>
      </output>
    }
    @if (next()) {
      <output class="next-set-cue" [class.still]="reducedMotion()">Next set ready</output>
    }
  `,
  styleUrl: './player-cue.component.scss'
})
export class PlayerCueComponent {
  readonly done = input(false);
  readonly next = input(false);
  readonly reducedMotion = input(false);
}
