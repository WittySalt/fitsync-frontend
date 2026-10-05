import { Component, computed, input } from '@angular/core';

import { FoodIconComponent } from './food-icon.component';
import { groupForCategory } from './food-groups';

/**
 * The leading tile of a food row: the photo when the food has one, a brand tile (the brand's first
 * letter on ink) when the food carries a brand, otherwise the icon of its food group in the group's
 * colour. The brand always comes from data, never from the name.
 */
@Component({
  selector: 'app-food-tile',
  imports: [FoodIconComponent],
  template: `
    @if (imageUrl(); as url) {
      <img [src]="url" alt="" loading="lazy" />
    } @else if (brandInitial(); as initial) {
      <span class="brand" [attr.title]="brandName()">{{ initial }}</span>
    } @else {
      <app-food-icon [group]="group()" [categoryCode]="categoryCodeValue()" [size]="size()" />
    }
  `,
  styles: [
    `
      :host {
        flex: none;
        display: inline-flex;
        overflow: hidden;
        border-radius: 12px;
      }

      img,
      .brand {
        box-sizing: border-box;
        width: var(--tile-size);
        height: var(--tile-size);
      }

      img {
        display: block;
        object-fit: cover;
        background: var(--surface-sunken);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--text-primary);
        color: var(--surface);
        font-size: 17px;
        font-weight: var(--fw-bold);
      }
    `
  ],
  host: {
    '[style.--tile-size.px]': 'size()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()'
  }
})
export class FoodTileComponent {
  readonly brandName = input<string | null | undefined>(null);
  readonly imageUrl = input<string | null | undefined>(null);
  /** The backend category code, which picks the group and the fish and egg drawings. */
  readonly categoryCode = input<string | null | undefined>(null);
  readonly size = input(40);

  protected readonly group = computed(() => groupForCategory(this.categoryCode()));
  protected readonly categoryCodeValue = computed(() => this.categoryCode() ?? null);
  protected readonly brandInitial = computed(() => (this.brandName() ?? '').trim().charAt(0).toUpperCase());
}
