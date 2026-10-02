import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { RecipeStep } from './recipes.models';

/**
 * The steps with large light-green numbers. A step with times in it carries a small note that the
 * timer lives in cook mode; no timer runs here. The credit for the recipe, the photo and the
 * nutrition closes the card.
 */
@Component({
  selector: 'app-recipe-steps',
  imports: [FoodGlyphComponent, RouterLink],
  template: `
    <div class="head">
      <h3>Steps</h3>
      @if (steps().length) {
        <a class="cook" [routerLink]="['/nutrition/recipes', recipeId(), 'cook']">Start cooking</a>
      }
    </div>
    @if (steps().length === 0) {
      <p class="hint">No steps are written for this recipe.</p>
    }
    <ol>
      @for (step of steps(); track step.stepNumber) {
        <li>
          <span class="number" aria-hidden="true">{{ step.stepNumber }}</span>
          <div class="body">
            <p>{{ step.text }}</p>
            @if (step.timers.length) {
              <span class="timer"><app-food-glyph name="CLOCK" [size]="13" [strokeWidth]="2.2" />Timer in cook mode</span>
            }
          </div>
        </li>
      }
    </ol>
    <p class="credit">Recipe and photo from TheMealDB. Nutrition worked out from USDA FoodData Central.</p>
  `,
  styleUrl: './recipe-steps.component.scss'
})
export class RecipeStepsComponent {
  readonly recipeId = input.required<string>();
  readonly steps = input.required<readonly RecipeStep[]>();
}
