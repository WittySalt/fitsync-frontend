import { Component, computed, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { groupColour, iconFor } from '../../../shared/food/food-groups';
import { gramsText } from './cook-format';
import { scaledGrams } from './cook-recipe';
import { CookIngredient } from './cook.models';

/**
 * "Step N of M · add now": a large card with a box for each ingredient the step uses, with its
 * scaled grams. Ticking marks the ingredient as added; the card dims but stays. A step that uses
 * nothing says so in one quiet line, so the cook sees why the block is empty.
 */
@Component({
  selector: 'app-cook-add-now',
  imports: [FoodGlyphComponent],
  template: `
    <h2 class="eyebrow">Step {{ stepNumber() }} of {{ stepCount() }} · add now</h2>
    @if (ingredients().length > 0) {
      <ul>
        @for (ingredient of ingredients(); track ingredient.id) {
          @let on = added().has(ingredient.id);
          <li [style.--tile]="colour(ingredient)" [class.added]="on">
            <label>
              <input type="checkbox" class="sr-only" [checked]="on" (change)="toggled.emit(ingredient.id)" />
              <span class="icon">
                @if (icon(ingredient); as name) {
                  <app-food-glyph [name]="name" [size]="30" />
                }
              </span>
              <span class="text">
                <strong>{{ ingredient.name }}</strong>
                <span class="grams">{{ amount(ingredient) }}</span>
              </span>
              <span class="box" aria-hidden="true">
                @if (on) {
                  <app-food-glyph name="CHECK" [size]="14" [strokeWidth]="3" />
                }
              </span>
            </label>
          </li>
        }
      </ul>
      @if (allAdded()) {
        <p class="quiet">All added</p>
      }
    } @else if (assigned()) {
      <p class="quiet">Nothing new to add in this step</p>
    }
  `,
  styleUrl: './cook-add-now.component.scss'
})
export class CookAddNowComponent {
  readonly ingredients = input.required<CookIngredient[]>();
  readonly stepNumber = input.required<number>();
  readonly stepCount = input.required<number>();
  readonly factor = input(1);
  readonly added = input<ReadonlySet<string>>(new Set<string>());
  /** False while the backend names no ingredients in any step, so "nothing to add" would be a guess. */
  readonly assigned = input(true);
  readonly toggled = output<string>();

  protected readonly allAdded = computed(() => this.ingredients().length > 0 && this.ingredients().every((ingredient) => this.added().has(ingredient.id)));

  protected colour(ingredient: CookIngredient): string {
    return groupColour(ingredient.foodGroup);
  }

  protected icon(ingredient: CookIngredient): string | null {
    return iconFor(ingredient.foodGroup, ingredient.categoryCode);
  }

  protected amount(ingredient: CookIngredient): string {
    const grams = scaledGrams(ingredient.grams, this.factor());
    return grams === null ? ingredient.displayText : gramsText(grams);
  }
}
