import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { E1RM_FORMULA } from '../lift-math';
import { Lift } from '../training.models';
import { kg } from '../training-format';
import { LadderComponent } from './ladder.component';
import { LiftCardComponent } from './lift-card.component';
import { SectionCardComponent } from './section-card.component';

/** Strength: four lift cards, the key to their dots, and the relative-strength ladder (board 18a). */
@Component({
  selector: 'app-strength-section',
  imports: [LadderComponent, LiftCardComponent, SectionCardComponent],
  template: `
    <app-section-card title="Strength" sub="Estimated best single, from your heaviest sets" [quiet]="formula" [card]="card()">
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
          <app-ladder [lifts]="lifts()" [weightNote]="weightNote()" />
        </div>
      } @else {
        <p class="empty">Not enough data yet. A lift shows here once a barbell or dumbbell exercise has three sessions in this period.</p>
      }
    </app-section-card>
  `,
  styleUrl: './strength-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StrengthSectionComponent {
  readonly lifts = input<readonly Lift[]>([]);
  readonly card = input<CoachCardContext | null>(null);

  protected readonly formula = E1RM_FORMULA;
  protected readonly weightNote = computed(() => {
    const weight = this.lifts().find((lift) => lift.bodyWeightKg !== null)?.bodyWeightKg;
    return weight ? `${kg(weight)} kg` : '';
  });
}
