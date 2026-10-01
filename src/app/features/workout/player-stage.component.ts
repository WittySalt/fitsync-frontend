import { Component, input } from '@angular/core';

/**
 * Where the parts of an exercise screen go. The picture and the steps are one column, the rest of
 * the screen is the other; below 720 px of width they stack in the order the person needs them.
 * It only places what it is given, so every state of the screen (a set, the countdown, a timed
 * set, the rest) shares one layout.
 */
@Component({
  selector: 'app-player-stage',
  template: `
    <div class="stage" [class.thumb]="thumb()" [class.centred]="centred()">
      <div class="lead">
        <div class="pic"><ng-content select="[slot=pic]" /></div>
        <div class="steps"><ng-content select="[slot=steps]" /></div>
        <div class="extra"><ng-content select="[slot=extra]" /></div>
      </div>
      <div class="side">
        <div class="head"><ng-content select="[slot=head]" /></div>
        <div class="main"><ng-content select="[slot=main]" /></div>
      </div>
    </div>
  `,
  styleUrl: './player-stage.component.scss'
})
export class PlayerStageComponent {
  /** On a narrow screen the picture is a small square beside the heading, as on the set screen. */
  readonly thumb = input(false);
  /** The side column is centred on the picture, as for the countdown, the timer and the rest. */
  readonly centred = input(false);
}
