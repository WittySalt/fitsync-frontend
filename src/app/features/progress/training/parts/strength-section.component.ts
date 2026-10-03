import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { DetailSectionComponent, LadderComponent, LadderRung, ladderRungs } from '../../../../shared/progress';
import { E1RM_FORMULA, LEVEL_NAMES, ladderPosition, liftChangePct } from '../lift-math';
import { Lift } from '../training.models';
import { kg, signedPct } from '../training-format';
import { LiftCardComponent } from './lift-card.component';

export interface LadderRow {
  name: string;
  ratio: number;
  rungs: LadderRung[];
  level: string;
  next: string;
}

/**
 * A lift's place on the relative-strength ladder: its ratio, the three rungs that start novice,
 * intermediate and advanced, its level and the next rung in kilos. Null without a body weight.
 */
export function ladderRow(lift: Lift): LadderRow | null {
  const place = ladderPosition(lift);
  if (!place) {
    return null;
  }
  const next = place.nextLevel && place.nextAtKg !== null ? `${LEVEL_NAMES[place.nextLevel].toLowerCase()} at ${kg(place.nextAtKg)} kg` : 'top rung';
  return { name: lift.name, ratio: place.ratio, rungs: ladderRungs(lift.name).slice(0, 3), level: LEVEL_NAMES[place.level], next };
}

/** Strength: four lift cards, the key to their dots, and each lift on the relative-strength ladder (board 18a). */
@Component({
  selector: 'app-strength-section',
  imports: [DetailSectionComponent, LadderComponent, LiftCardComponent],
  template: `
    <app-detail-section name="Strength" anchor="strength" [sentence]="sentence()" [context]="card()" [ask]="ask()">
      @if (lifts().length) {
        <div class="lifts">
          @for (lift of lifts(); track lift.exerciseId || lift.name) {
            <app-lift-card [lift]="lift" />
          }
        </div>
        <div class="key" aria-hidden="true">
          <span><i class="record"></i>A new personal record</span>
          <span><i class="session"></i>A session, its heaviest set</span>
        </div>
        <div class="ladder">
          <div class="titles">
            <strong>Relative strength</strong>
          </div>
          @if (rows().length) {
            <ul class="rows">
              @for (row of rows(); track row.name) {
                <li>
                  <div class="row-head">
                    <strong>{{ row.name }}</strong>
                    <span>{{ row.level }} · next: {{ row.next }}</span>
                  </div>
                  <app-ladder [ratio]="row.ratio" [rungs]="row.rungs" [label]="row.name" />
                </li>
              }
            </ul>
          } @else {
            <p class="note">Not enough data yet. Log a body weight on Me to see where each lift sits.</p>
          }
        </div>
      } @else {
        <p class="empty">Not enough data yet. A lift shows here once a barbell or dumbbell exercise has three sessions in this period.</p>
      }
    </app-detail-section>
  `,
  styleUrl: './strength-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StrengthSectionComponent {
  readonly lifts = input<readonly Lift[]>([]);
  readonly card = input<CoachCardContext | null>(null);

  /** The one sentence under the name: the lift that moved most, in its estimated best single. */
  protected readonly sentence = computed(() => {
    const moved = this.lifts()
      .map((lift) => ({ lift, pct: liftChangePct(lift) }))
      .filter((entry): entry is { lift: Lift; pct: number } => entry.pct !== null)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
    const now = moved?.lift.e1rm.at(-1)?.value;
    if (!moved || now === undefined) {
      return 'Estimated best single of each main lift, from your heaviest sets.';
    }
    return `${moved.lift.name} is ${signedPct(moved.pct).startsWith('−') ? 'down' : 'up'} ${signedPct(moved.pct).replace(/^[+−]/, '')} to an estimated best single of ${kg(now)} kg.`;
  });
  protected readonly ask = computed(
    () => `How are my estimated best singles and strength levels worked out? Each is ${E1RM_FORMULA}, from my heaviest sets. The ladder divides it by my body weight${this.weightNote() ? ', ' + this.weightNote() : ''}, and levels are a rough guide, not a target.`
  );
  protected readonly rows = computed(() => this.lifts().map(ladderRow).filter((row): row is LadderRow => row !== null));
  protected readonly weightNote = computed(() => {
    const weight = this.lifts().find((lift) => lift.bodyWeightKg !== null)?.bodyWeightKg;
    return weight ? `${kg(weight)} kg` : '';
  });
}
