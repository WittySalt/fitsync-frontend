import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { LEVEL_NAMES, ladderPosition } from '../lift-math';
import { Lift } from '../training.models';
import { kg } from '../training-format';

interface LadderRow {
  name: string;
  ratio: string;
  level: string;
  next: string;
  position: number;
  ticks: { at: number; label: string }[];
  aria: string;
}

const BANDS = ['Beginner', 'Novice', 'Intermediate', 'Advanced'];

/**
 * Relative strength: each lift's estimated best single divided by body weight, on a track of four
 * levels with the rungs written under it and the next rung named. Private copy of `app-ladder`.
 */
@Component({
  selector: 'app-ladder',
  templateUrl: './ladder.component.html',
  styleUrl: './ladder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LadderComponent {
  readonly lifts = input<readonly Lift[]>([]);
  /** The weight the ratios divide by and the day it was measured, for the line under the title. */
  readonly weightNote = input('');

  protected readonly bands = BANDS;

  protected readonly rows = computed<LadderRow[]>(() =>
    this.lifts()
      .map((lift) => ({ lift, position: ladderPosition(lift) }))
      .filter((entry) => entry.position !== null)
      .map(({ lift, position }) => {
        const place = position!;
        const level = LEVEL_NAMES[place.level];
        const next = place.nextLevel && place.nextAtKg !== null ? `${LEVEL_NAMES[place.nextLevel].toLowerCase()} at ${kg(place.nextAtKg)} kg` : 'top rung';
        const ratio = `${place.ratio.toFixed(2)}×`;
        return {
          name: lift.name,
          ratio,
          level,
          next,
          position: place.position,
          ticks: place.rungs.slice(0, 3).map((rung, index) => ({ at: 25 * (index + 1), label: `${rung}×` })),
          aria: `${lift.name}, ${ratio} body weight, ${level}, next: ${next}`
        };
      })
  );
}
