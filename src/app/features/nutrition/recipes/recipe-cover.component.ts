import { Component, computed, input, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodGroup, groupColour, iconFor } from '../../../shared/food/food-groups';
import { fallbackCover } from './recipes-figures';

/**
 * A recipe's picture with a fixed shape, so cards do not jump while photos load. The photo loads
 * lazily. When there is none, or it fails to load, a cover is drawn from the recipe's top food
 * groups instead: their icons on their food tints. No broken image is ever shown.
 */
@Component({
  selector: 'app-recipe-cover',
  imports: [FoodGlyphComponent],
  template: `
    @if (photo(); as src) {
      <img [src]="src" alt="" loading="lazy" decoding="async" (error)="failedUrl.set(src)" />
      @if (credit()) {
        <span class="credit" [class.top]="creditTop()">Photo from TheMealDB</span>
      }
    } @else {
      <span class="fallback" [style.background]="cover().background">
        @for (icon of icons(); track icon.group) {
          <span class="dot" [style.color]="icon.colour" [style.width.px]="dot()" [style.height.px]="dot()">
            <app-food-glyph [name]="icon.name" [size]="glyph()" [strokeWidth]="1.9" />
          </span>
        }
      </span>
    }
  `,
  styleUrl: './recipe-cover.component.scss',
  host: {
    '[style.aspect-ratio]': 'height() === null ? ratio() : null',
    '[style.height.px]': 'height()',
    '[style.width.px]': 'width()',
    '[style.border-radius.px]': 'radius()',
    'aria-hidden': 'true'
  }
})
export class RecipeCoverComponent {
  readonly imageUrl = input<string | null>(null);
  readonly groups = input<readonly FoodGroup[]>([]);
  /** The shape of the picture as a CSS ratio, used when no height is given. */
  readonly ratio = input('16 / 10');
  /** A fixed height in pixels, for the small cover of a Diary row. */
  readonly height = input<number | null>(null);
  readonly width = input<number | null>(null);
  readonly radius = input(0);
  /** The size of the icons of the fallback cover, in pixels. */
  readonly glyph = input(22);
  /** Show the TheMealDB credit on a photo. */
  readonly credit = input(false);
  /** Put the credit at the top right in white on dark, for a photo with a title over it. */
  readonly creditTop = input(false);

  protected readonly failedUrl = signal<string | null>(null);
  protected readonly photo = computed(() => {
    const src = this.imageUrl();
    return src && src !== this.failedUrl() ? src : null;
  });
  protected readonly cover = computed(() => fallbackCover(this.groups()));
  protected readonly dot = computed(() => Math.round(this.glyph() * 1.9));
  protected readonly icons = computed(() =>
    this.cover().groups.map((group) => ({ group, colour: groupColour(group), name: iconFor(group) ?? 'PLUS' }))
  );
}
