import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';

/**
 * The bar of a timer: one segment, or two for "each side" with a dot where the turn is. A finished
 * segment gets a tick in its label, and while a stage has just ended the bar steps back to 30% and
 * a light runs along the segment that filled to the turn dot.
 */
@Component({
  selector: 'app-cook-segments',
  imports: [FoodGlyphComponent],
  template: `
    <div class="bars" [class.celebrating]="celebrating()" role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent()">
      @for (fill of fills(); track $index) {
        <div class="seg">
          <div class="track" [class.sweep]="celebrating() && sweepIndex() === $index">
            <span class="fill" [style.width.%]="fill * 100"></span>
          </div>
          <span class="label" [class.on]="activeIndex() === $index">
            @if (fill >= 1) {
              <app-food-glyph name="CHECK" [size]="12" [strokeWidth]="3" />
            }
            {{ labels()[$index] }}
          </span>
        </div>
        @if ($index === 0 && fills().length === 2) {
          <span class="dot" [class.lit]="fills()[0] >= 1" aria-hidden="true"></span>
        }
      }
    </div>
  `,
  styleUrl: './cook-segments.component.scss'
})
export class CookSegmentsComponent {
  readonly fills = input.required<number[]>();
  readonly labels = input<string[]>([]);
  /** The segment that is counting or next, whose label is brighter. */
  readonly activeIndex = input(-1);
  readonly celebrating = input(false);
  /** The segment that has just filled. */
  readonly sweepIndex = input(0);

  protected readonly percent = computed(() => {
    const fills = this.fills();
    return Math.round((fills.reduce((sum, fill) => sum + fill, 0) / Math.max(1, fills.length)) * 100);
  });
}
