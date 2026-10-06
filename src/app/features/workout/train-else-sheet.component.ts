import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { WorkoutModalComponent } from './workout-modal.component';

/**
 * The sheet behind "Train something else" on a planned day: a free workout first, then the plans.
 * The owner closes the sheet and carries out the choice.
 */
@Component({
  selector: 'app-train-else-sheet',
  imports: [WorkoutModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-workout-modal heading="Train something else" (dismissed)="dismissed.emit()">
      <div class="rows">
        <button type="button" class="row free" (click)="chosen.emit('free')">
          <span class="text">
            <strong>A free workout</strong>
            <small>Name it, pick a type and start a timer.</small>
          </span>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
        <button type="button" class="row browse" (click)="chosen.emit('browse')">
          <span class="text">
            <strong>Browse plans</strong>
            <small>See your plans and the starters.</small>
          </span>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </div>
      <div class="foot">
        <button type="button" class="button secondary" (click)="dismissed.emit()">Not now</button>
      </div>
    </app-workout-modal>
  `,
  styleUrl: './train-else-sheet.component.scss'
})
export class TrainElseSheetComponent {
  readonly chosen = output<'free' | 'browse'>();
  readonly dismissed = output<void>();
}
