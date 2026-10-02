import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { servingsText } from './cook-format';

/** The banner: the recipe photo under a dark gradient (a food icon cover without one), "Cooking" and the name. */
@Component({
  selector: 'app-cook-banner',
  imports: [FoodGlyphComponent],
  template: `
    @if (imageUrl(); as url) {
      <img class="photo" [src]="url" alt="" />
    } @else {
      <span class="cover" aria-hidden="true"><app-food-glyph name="PROTEIN" [size]="56" [strokeWidth]="1.4" /></span>
    }
    <span class="shade" aria-hidden="true"></span>
    <div class="text">
      <div class="lines">
        <span class="kicker">Cooking</span>
        <strong class="name">{{ name() }}</strong>
        <span class="meta">{{ meta() }}</span>
      </div>
    </div>
  `,
  styleUrl: './cook-banner.component.scss'
})
export class CookBannerComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly servings = input(1);
  /** False when the browser has no Wake Lock API, so the page does not promise what it cannot do. */
  readonly screenStaysOn = input(true);

  protected readonly meta = computed(
    () => `${servingsText(this.servings())}${this.screenStaysOn() ? ' · the screen stays on' : ''}`
  );
}
