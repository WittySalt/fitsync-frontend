import { Component, input, model } from '@angular/core';

import { PlayerStepperComponent } from './player-stepper.component';

/**
 * The numbers of one set the person decides: reps and weight for a counted set, the time for a
 * timed one. The screen asks for them before a set starts, and the editor asks again when a set
 * went differently. It only shows the steppers; whoever owns the values decides what happens next.
 */
@Component({
  selector: 'app-player-set-values',
  imports: [PlayerStepperComponent],
  template: `
    @if (timed()) {
      <div class="steppers single">
        <app-player-stepper label="Time" format="clock" [step]="5" [min]="5" [max]="21600" [(value)]="duration" />
      </div>
    } @else if (hasReps()) {
      <div class="steppers" [class.single]="!hasWeight() || stacked()">
        <app-player-stepper label="Reps" [min]="1" [max]="999" [(value)]="reps" />
        @if (hasWeight()) {
          <app-player-stepper label="Weight" unit="kg" [step]="2.5" [max]="1000" [(value)]="weight" />
        }
      </div>
    }
  `,
  styleUrl: './player-set-values.component.scss'
})
export class PlayerSetValuesComponent {
  readonly timed = input(false);
  readonly hasReps = input(false);
  readonly hasWeight = input(false);
  /** One stepper under the other, for a narrow place such as the dialog. */
  readonly stacked = input(false);
  readonly reps = model(0);
  readonly weight = model(0);
  readonly duration = model(0);
}
