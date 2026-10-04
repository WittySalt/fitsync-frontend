import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { HEAT_KEY } from '../../../shared/charts/muscle-figure/muscle-figure';
import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { PlanCoverage, groupSetsForFigure } from './plan-coverage';
import { WeekFigures } from './plan-summary';

/**
 * The "This week" panel. Wide, it is the 300 px column beside the editor: four figures, the muscle
 * figure pair with its key, and up to two reading lines. Folded (medium and narrow) it is one line
 * of figures with a Details button that opens the same content. When the coverage endpoint did not
 * answer, the figure and the key are left out and the figures stay.
 */
@Component({
  selector: 'app-plan-week-panel',
  imports: [MuscleFigureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-panel.component.html',
  styleUrl: './week-panel.component.scss'
})
export class WeekPanelComponent {
  readonly figures = input.required<WeekFigures>();
  readonly shortLine = input.required<string>();
  readonly lines = input<string[]>([]);
  readonly coverage = input<PlanCoverage | null>(null);
  readonly folded = input(false);

  protected readonly open = signal(false);
  protected readonly sets = computed(() => groupSetsForFigure(this.coverage()));
  protected readonly key = [...HEAT_KEY].reverse();
  protected readonly showBody = computed(() => !this.folded() || this.open());
}
