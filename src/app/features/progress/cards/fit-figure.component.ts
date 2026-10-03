import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MuscleFigureComponent } from '../../../shared/charts/muscle-figure/muscle-figure.component';
import { hostWidth } from './host-width';

/** The gap the figure leaves between its front and back views. */
const VIEW_GAP = 18;

/** The gap and the width of the scale (swatch, gap and its labels) beside the BACK figure. */
const SCALE_GAP = 16;
const SCALE_WIDTH = 96;

/** The tallest view whose pair, the gap and the scale together fit in `width` px. */
export function fittingHeight(width: number): number {
  return Math.floor(((width - SCALE_GAP - SCALE_WIDTH - VIEW_GAP) / 2) * 2.2);
}

/** The FRONT and BACK labels under the views, with the gap above them. */
const LABEL_ROOM = 20;
/** The block (views and labels) is never shorter or taller than this beside the strip. */
const BLOCK_MIN = 160;
const BLOCK_MAX = 260;

/**
 * The height each view is drawn at. Given the height of the column beside it, the block of views and
 * labels matches that column (between 160 and 260 px) and its width follows from that;
 * without one, the views keep their aspect to the width, between 140 and 200 px.
 */
export function figureHeight(width: number, blockHeight: number | null = null): number {
  if (blockHeight === null || blockHeight <= 0) {
    return Math.min(200, Math.max(140, Math.round(((width - VIEW_GAP) / 2) * 2.2)));
  }
  return Math.max(BLOCK_MIN, Math.min(BLOCK_MAX, blockHeight)) - LABEL_ROOM;
}

/** The muscle figure pair, sized to the width it is given and never wider than it. A picture only. */
@Component({
  selector: 'app-fit-figure',
  imports: [MuscleFigureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-muscle-figure [setsByGroup]="sets()" [interactive]="false" [height]="height()" />`,
  styles: `:host { display: block; width: max-content; max-width: 100%; }`
})
export class FitFigureComponent {
  readonly sets = input.required<Record<string, number>>();
  /** The height of the column beside the figures, which the block matches. */
  readonly blockHeight = input<number | null>(null);
  /** The tallest a view may be so the block fits the width it has; null when nothing limits it. */
  readonly maxHeight = input<number | null>(null);

  private readonly width = hostWidth(170);
  protected readonly height = computed(() => {
    const height = figureHeight(this.width(), this.blockHeight());
    const cap = this.maxHeight();
    return cap === null ? height : Math.max(100, Math.min(height, cap));
  });
}
