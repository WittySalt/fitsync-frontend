import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from './food-glyph.component';
import { FoodGroup, groupColour, iconFor } from './food-groups';

/**
 * A food's drawn icon on a tile tinted with the colour of its group. A food with no known group
 * gets the neutral tile colour and the plate and fork.
 */
@Component({
  selector: 'app-food-icon',
  imports: [FoodGlyphComponent],
  template: `
    @if (icon(); as name) {
      <app-food-glyph [name]="name" [size]="glyphSize()" />
    }
  `,
  styles: [
    `
      :host {
        flex: none;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--tile);
        background: color-mix(in srgb, var(--tile) 14%, transparent);
      }
    `
  ],
  host: {
    '[style.--tile]': 'colour()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius.px]': 'radius()',
    'aria-hidden': 'true'
  }
})
export class FoodIconComponent {
  readonly group = input<FoodGroup | null>(null);
  /** The backend category code, which picks the fish and egg drawings. */
  readonly categoryCode = input<string | null>(null);
  readonly size = input(36);

  protected readonly colour = computed(() => groupColour(this.group(), this.categoryCode()));
  protected readonly icon = computed(() => iconFor(this.group(), this.categoryCode()));
  protected readonly glyphSize = computed(() => Math.round(this.size() * 0.56));
  protected readonly radius = computed(() => Math.round(this.size() * 0.3));
}
