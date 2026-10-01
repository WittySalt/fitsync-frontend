import { Component, computed, input, output } from '@angular/core';

/**
 * The one row above the exercise screen: put it away, how far the workout has come (one segment
 * for each exercise), the sets done, and the time. It stays quiet so the exercise has the room.
 */
@Component({
  selector: 'app-player-top-strip',
  template: `
    <div class="strip">
      <button type="button" class="minimise" aria-label="Minimise" (click)="minimise.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>
      </button>
      <div class="segments" role="img" [attr.aria-label]="progressLabel()">
        @for (fill of segments(); track $index) {
          <span class="segment"><span class="fill" [style.width.%]="fill * 100"></span></span>
        }
      </div>
      <span class="sets">{{ setsDone() }} of {{ setsTotal() }}<span class="word"> sets</span></span>
      <span class="elapsed">{{ clock() }}</span>
    </div>
  `,
  styleUrl: './player-top-strip.component.scss'
})
export class PlayerTopStripComponent {
  /** The share of each exercise that is done, from 0 to 1, in the order of the workout. */
  readonly segments = input.required<number[]>();
  readonly current = input(0);
  readonly setsDone = input(0);
  readonly setsTotal = input(0);
  readonly clock = input('0:00');
  readonly minimise = output<void>();

  protected readonly progressLabel = computed(
    () => `Exercise ${this.current() + 1} of ${this.segments().length}, ${this.setsDone()} of ${this.setsTotal()} sets done`
  );
}
