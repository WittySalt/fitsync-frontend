import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { hostWidth } from './host-width';

/** The gap the figure leaves between its front and back views. */
const VIEW_GAP = 18;

/** The FRONT and BACK labels under the views, with the gap above them. */
const LABEL_ROOM = 20;
/** The block (views and labels) is never shorter or taller than this beside the strip. */
const BLOCK_MIN = 160;
const BLOCK_MAX = 260;

/**
 * The height each view is drawn at. Given the height of the column beside it, the block of views and
 * labels matches that column (between 160 and 260 px) but never grows wider than its width allows;
 * without one, the views keep their aspect to the width, between 140 and 200 px.
 */
export function figureHeight(width: number, blockHeight: number | null = null): number {
  const byWidth = Math.round(((width - VIEW_GAP) / 2) * 2.2);
  if (blockHeight === null || blockHeight <= 0) {
    return Math.min(200, Math.max(140, byWidth));
  }
  return Math.min(Math.max(BLOCK_MIN, Math.min(BLOCK_MAX, blockHeight)) - LABEL_ROOM, Math.max(byWidth, 100));
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
  /** The height of the column beside the figures, which the block matches. */
  readonly blockHeight = input<number | null>(null);

  private readonly width = hostWidth(170);
  protected readonly height = computed(() => figureHeight(this.width(), this.blockHeight()));
}
