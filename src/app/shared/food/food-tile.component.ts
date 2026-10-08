import { Component, computed, input, signal } from '@angular/core';

import { FoodIconComponent } from './food-icon.component';
import { FoodGroup, groupForCategory } from './food-groups';

/**
 * The leading tile of a food row: the photo when the food has one, then the brand logo, otherwise the
 * icon of its food group in the group's colour (the plate and fork on the neutral colour when it has
 * no group). A logo that fails to load falls back to the icon.
 */
@Component({
  selector: 'app-food-tile',
  imports: [FoodIconComponent],
  template: `
    @if (imageUrl(); as url) {
      <img [src]="url" alt="" loading="lazy" />
    } @else if (logo(); as logoSrc) {
      <img class="logo" [src]="logoSrc" [alt]="brandName() ?? ''" loading="lazy" (error)="failedLogo.set(logoSrc)" />
    } @else {
      <app-food-icon [group]="resolvedGroup()" [categoryCode]="categoryCodeValue()" [size]="size()" />
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

      img {
        box-sizing: border-box;
        width: var(--tile-size);
        height: var(--tile-size);
        display: block;
        object-fit: cover;
        background: var(--surface-sunken);
      }

      img.logo {
        padding: 4px;
        object-fit: contain;
        background: #fff;
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
  readonly imageUrl = input<string | null | undefined>(null);
  /** The backend category code, which picks the group and the fish and egg drawings. */
  readonly categoryCode = input<string | null | undefined>(null);
  /** The food group when the caller already knows it; otherwise it comes from the category code. */
  readonly group = input<FoodGroup | null | undefined>(null);
  readonly size = input(40);
  /** The brand's logo, drawn when the food has no photo of its own. */
  readonly logoUrl = input<string | null | undefined>(null);
  readonly brandName = input<string | null | undefined>(null);

  protected readonly failedLogo = signal<string | null>(null);
  protected readonly logo = computed(() => {
    const url = this.logoUrl();
    return url && url !== this.failedLogo() ? url : null;
  });

  protected readonly resolvedGroup = computed(() => this.group() ?? groupForCategory(this.categoryCode()));
  protected readonly categoryCodeValue = computed(() => this.categoryCode() ?? null);
}
