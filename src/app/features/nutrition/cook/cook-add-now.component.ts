import { Component, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { groupColour, iconFor } from '../../../shared/food/food-groups';
import { gramsText } from './cook-format';
import { scaledGrams } from './cook-recipe';
import { CookIngredient } from './cook.models';

/** "Step N of M · add now": a large card for each ingredient the step uses, with its scaled grams. */
@Component({
  selector: 'app-cook-add-now',
  imports: [FoodGlyphComponent],
  template: `
    <h2 class="eyebrow">Step {{ stepNumber() }} of {{ stepCount() }} · add now</h2>
    @if (ingredients().length > 0) {
      <ul>
        @for (ingredient of ingredients(); track ingredient.id) {
          <li [style.--tile]="colour(ingredient)">
            <span class="icon">
              @if (icon(ingredient); as name) {
                <app-food-glyph [name]="name" [size]="30" />
              }
            </span>
            <span class="text">
              <strong>{{ ingredient.name }}</strong>
              <span class="grams">{{ amount(ingredient) }}</span>
            </span>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './cook-add-now.component.scss'
})
export class CookAddNowComponent {
  readonly ingredients = input.required<CookIngredient[]>();
  readonly stepNumber = input.required<number>();
  readonly stepCount = input.required<number>();
  readonly factor = input(1);

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
