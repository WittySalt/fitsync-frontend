import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { hostWidth } from './host-width';

/** The gap the figure leaves between its front and back views. */
const VIEW_GAP = 18;

/** The tallest and the shortest a view is drawn; the pair keeps its aspect between them. */
export function figureHeight(width: number): number {
  return Math.min(200, Math.max(120, Math.round(((width - VIEW_GAP) / 2) * 2.2)));
}

/** The muscle figure pair, sized to the width it is given and never wider than it. A picture only. */
@Component({
  selector: 'app-fit-figure',
  imports: [MuscleFigureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-muscle-figure [setsByGroup]="sets()" [interactive]="false" [height]="height()" />`,
  styles: `:host { display: block; width: 100%; }`
})
export class FitFigureComponent {
  readonly sets = input.required<Record<string, number>>();

  private readonly width = hostWidth(170);
  protected readonly height = computed(() => figureHeight(this.width()));
}
