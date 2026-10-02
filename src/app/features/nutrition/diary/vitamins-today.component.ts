import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { NutrientSummary } from './diary.models';
import { NutrientView, barPercent } from './diary-figures';
import { coverageLine, focusLine, noVitaminData, todayParts } from './vitamins-today';

const RING_SIZE = 54;
const RING_RADIUS = RING_SIZE / 2 - 5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The Today view of the vitamins card: the three lowest nutrients that are not yet met are large
 * with a ring and the richest food the person often eats, everything else is a chip with a tick
 * when the daily amount is met.
 */
@Component({
  selector: 'app-vitamins-today',
  imports: [FoodGlyphComponent],
  template: `
    @if (summary().daysLogged === 0 || summary().nutrients.length === 0) {
      <p class="empty">Log some food to see your vitamins and minerals.</p>
    } @else if (noData()) {
      <p class="empty">None of the foods logged {{ isToday() ? 'today' : 'on this day' }} have vitamin data yet.</p>
    } @else {
      @if (focus()) {
        <p class="focus">{{ focus() }}</p>
      }
      @if (parts().low.length) {
        <div class="lows">
          @for (view of parts().low; track view.row.code) {
            <div class="low">
              <svg class="ring" [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" aria-hidden="true">
                <circle class="track" [style.stroke]="colour(view)" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" fill="none" stroke-width="6"></circle>
                <circle
                  class="arc"
                  [style.stroke]="colour(view)"
                  [attr.cx]="size / 2"
                  [attr.cy]="size / 2"
                  [attr.r]="radius"
                  fill="none"
                  stroke-width="6"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="length * fraction(view) + ' ' + length"
                  [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
                ></circle>
                <text [attr.x]="size / 2" [attr.y]="size / 2" dominant-baseline="central" text-anchor="middle">{{ view.percent }}%</text>
              </svg>
              <div class="low-text">
                <div class="low-head">
                  <strong>{{ view.row.displayName }}</strong>
                  <span>{{ view.amount }}{{ isToday() ? ' so far' : '' }}</span>
                </div>
                @if (view.words) {
                  <span class="words">{{ view.words }}</span>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="reached">Every vitamin and mineral here is reached today.</p>
      }
      @if (parts().rest.length) {
        <div class="rest">
          <strong>The rest</strong>
          <div class="chips">
            @for (view of parts().rest; track view.row.code) {
              <span class="chip">
                <span class="chip-head">
                  <strong>{{ view.row.displayName }}</strong>
                  @if (view.row.met) {
                    <span class="met"><app-food-glyph name="CHECK" [size]="12" [strokeWidth]="3" />{{ view.percent }}%</span>
                  } @else {
                    <span>{{ view.percent }}%</span>
                  }
                </span>
                <span class="mini" [style.background]="tint(view)"><span [style.width.%]="percentOf(view)" [style.background]="ringColour(view)"></span></span>
              </span>
            }
          </div>
        </div>
      }
      @if (coverage()) {
        <p class="coverage">{{ coverage() }}</p>
      }
      <p class="note">
        {{ isToday() ? 'Today so far, lowest' : 'Lowest' }} first among those not yet reached. Daily amounts
        {{ summary().referenceLabel ? summary().referenceLabel + ', from' : 'are from' }} the US National Institutes of Health.
      </p>
    }
  `,
  styleUrl: './vitamins-today.component.scss'
})
export class VitaminsTodayComponent {
  readonly summary = input.required<NutrientSummary>();
  /** The selected day is today, so the amounts are still growing. */
  readonly isToday = input(true);

  protected readonly size = RING_SIZE;
  protected readonly radius = RING_RADIUS;
  protected readonly length = RING_LENGTH;

  protected readonly noData = computed(() => noVitaminData(this.summary()));
  protected readonly parts = computed(() => todayParts(this.summary().nutrients));
  protected readonly focus = computed(() => focusLine(this.summary()));
  protected readonly coverage = computed(() => coverageLine(this.summary()));

  /** Vitamins in the fruit colour and minerals in the dairy colour, as the design boards have them. */
  protected colour(view: NutrientView): string {
    return view.row.kind === 'MINERAL' ? 'var(--food-dairy)' : 'var(--food-fruit)';
  }

  /** The bar of a nutrient above its upper limit is dark grey, never red. */
  protected ringColour(view: NutrientView): string {
    return view.row.aboveUpperLimit ? 'var(--text-secondary)' : this.colour(view);
  }

  protected tint(view: NutrientView): string {
    return `color-mix(in srgb, ${this.colour(view)} 16%, transparent)`;
  }

  protected fraction(view: NutrientView): number {
    return Math.min(Math.max(view.row.share ?? 0, 0), 1);
  }

  protected percentOf(view: NutrientView): number {
    return barPercent(view.row.share ?? 0);
  }
}
