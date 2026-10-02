import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { gramsText } from './cook-format';
import { scaledGrams } from './cook-recipe';
import { CookIngredient } from './cook.models';

/**
 * "Ingredients" with "X of Y used". An ingredient is used once a step before the current one
 * has it. Without step assignments the list stays plain, with no count and no ticks.
 */
@Component({
  selector: 'app-cook-ingredients',
  imports: [FoodGlyphComponent],
  template: `
    <div class="head">
      <h2 class="eyebrow">Ingredients</h2>
      <span class="count">{{ count() }}</span>
    </div>
    <ul>
      @for (ingredient of ingredients(); track ingredient.id) {
        @let used = isUsed(ingredient);
        <li [class.used]="used">
          <span class="box">
            @if (used) {
              <app-food-glyph name="CHECK" [size]="11" [strokeWidth]="3" />
            }
          </span>
          <span class="name">{{ ingredient.name }}</span>
          @if (amount(ingredient); as grams) {
            <span class="grams">{{ grams }}</span>
          }
        </li>
      }
    </ul>
  `,
  styleUrl: './cook-ingredients.component.scss'
})
export class CookIngredientsComponent {
  readonly ingredients = input.required<CookIngredient[]>();
  readonly used = input.required<ReadonlySet<string>>();
  readonly factor = input(1);
  readonly assigned = input(true);

  protected readonly count = computed(() => {
    const total = this.ingredients().length;
    if (!this.assigned()) {
      return `${total} ${total === 1 ? 'ingredient' : 'ingredients'}`;
    }
    return `${this.ingredients().filter((ingredient) => this.used().has(ingredient.id)).length} of ${total} used`;
  });

  protected isUsed(ingredient: CookIngredient): boolean {
    return this.assigned() && this.used().has(ingredient.id);
  }

  protected amount(ingredient: CookIngredient): string {
    const grams = scaledGrams(ingredient.grams, this.factor());
    return grams === null ? '' : gramsText(grams);
  }
}
