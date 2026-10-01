import { Component, computed, input, output } from '@angular/core';

import { discardLine } from './workout-live.service';
import { WorkoutModalComponent } from './workout-modal.component';

/**
 * The question asked before something is ended: finishing while sets are still open, or discarding
 * the workout. Finishing is the filled green action, discarding is red, and "Keep going" leaves
 * the workout as it is.
 */
@Component({
  selector: 'app-player-confirm',
  imports: [WorkoutModalComponent],
  template: `
    <app-workout-modal [heading]="question() === 'finish' ? 'Finish now?' : 'Discard this workout?'" (dismissed)="keepGoing.emit()">
      @if (question() === 'finish') {
        <p class="ask">{{ openSets() }} {{ openSets() === 1 ? 'set is' : 'sets are' }} still open.</p>
        <div class="choices">
          <button class="button primary" type="button" [disabled]="ending()" (click)="finishNow.emit()">Finish and save</button>
          <button class="button secondary" type="button" (click)="keepGoing.emit()">Keep going</button>
          <button class="text-button danger-text" type="button" (click)="askDiscard.emit()">Discard workout</button>
        </div>
      } @else {
        <p class="ask">{{ discardText() }}</p>
        <div class="choices">
          @if (doneSets() > 0) {
            <button class="button primary" type="button" [disabled]="ending()" (click)="finishNow.emit()">Finish and save</button>
          }
          <button class="button danger-solid" type="button" [disabled]="ending()" (click)="discard.emit()">Discard</button>
          <button class="button secondary" type="button" (click)="keepGoing.emit()">Keep going</button>
        </div>
      }
    </app-workout-modal>
  `,
  styleUrl: './player-confirm.component.scss'
})
export class PlayerConfirmComponent {
  readonly question = input.required<'finish' | 'discard'>();
  /** How many sets of the whole workout are neither done nor skipped. */
  readonly openSets = input(0);
  readonly ending = input(false);
  /** Sets already done, which discarding would leave out of every total. */
  readonly doneSets = input(0);
  protected readonly discardText = computed(() => discardLine(this.doneSets()));

  readonly finishNow = output<void>();
  readonly discard = output<void>();
  readonly keepGoing = output<void>();
  readonly askDiscard = output<void>();
}
