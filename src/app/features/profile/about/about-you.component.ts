import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { AboutData, AboutField, dietLabel, equipmentLabels, focusCaption, focusSets, injuryLabels, leadParts, leadSentence } from './about-you';
import { DayLineComponent } from './day-line.component';

/**
 * About you: what the coach reads, as the inputs the person can change. A lead sentence, the muscle
 * figure coloured by the focus areas, the usual day on one line, and chips for equipment, injuries
 * and diet. Each element opens the place where it is changed.
 */
@Component({
  selector: 'app-about-you',
  imports: [MuscleFigureComponent, DayLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-you.component.html',
  styleUrl: './about-you.component.scss'
})
export class AboutYouComponent {
  readonly data = input.required<AboutData>();
  /** The person pressed an element; the page opens the sheet that changes it. */
  readonly edit = output<AboutField>();

  protected readonly lead = computed(() => leadSentence(this.data()));
  protected readonly sets = computed(() => focusSets(this.data().focusAreas));
  protected readonly caption = computed(() => focusCaption(this.data().focusAreas));
  protected readonly equipment = computed(() => equipmentLabels(this.data().equipment));
  protected readonly injuries = computed(() => injuryLabels(this.data().injuries));
  protected readonly diet = computed(() => dietLabel(this.data().diet));
  protected readonly nothingSet = computed(() => this.lead() === 'Nothing set yet.');
  protected readonly parts = computed(() => {
    const { training, goal } = leadParts(this.data());
    return { training: training.charAt(0).toUpperCase() + training.slice(1), goal };
  });
}
