import { Component, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../shared/food/food-glyph.component';
import { FrequentDrink } from './diary/diary.models';
import { BOTTLE_ML, GLASS_ML } from './diary/diary-water';

/**
 * The Drinks row of the meal builder: a glass and a bottle of water, the drinks the person has most
 * often, and a chip that narrows the search to drinks. A tap adds a drink to the meal like any food.
 */
@Component({
  selector: 'app-builder-drinks',
  imports: [FoodGlyphComponent],
  template: `
    <section class="drinks" aria-label="Drinks">
      <span class="eyebrow">Drinks</span>
      <div class="chips">
        @if (hasWater()) {
          <button type="button" (click)="water.emit(glassMl)">
            <app-food-glyph name="GLASS" [size]="16" />
            Glass {{ glassMl }} ml
          </button>
          <button type="button" (click)="water.emit(bottleMl)">
            <app-food-glyph name="BOTTLE" [size]="16" />
            Bottle {{ bottleMl }} ml
          </button>
        }
        @for (drink of recent(); track $index) {
          <button type="button" (click)="pick.emit(drink)">
            <app-food-glyph name="DRINKS" [size]="16" />
            {{ drink.name }}
          </button>
        }
        <button type="button" class="search" [disabled]="!canSearch()" (click)="narrow.emit()">Search drinks</button>
      </div>
    </section>
  `,
  styles: [
    `
      .drinks {
        display: grid;
        gap: 8px;
      }

      .eyebrow {
        font-size: 12px;
        font-weight: var(--fw-bold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-text);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--surface);
        color: var(--text-primary);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      button.search {
        color: var(--accent-text);
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `
  ]
})
export class BuilderDrinksComponent {
  /** True once the catalogue's water is known, so a glass and a bottle can be added. */
  readonly hasWater = input(false);
  readonly recent = input<FrequentDrink[]>([]);
  readonly canSearch = input(false);
  readonly water = output<number>();
  readonly pick = output<FrequentDrink>();
  readonly narrow = output<void>();

  protected readonly glassMl = GLASS_ML;
  protected readonly bottleMl = BOTTLE_ML;
}
