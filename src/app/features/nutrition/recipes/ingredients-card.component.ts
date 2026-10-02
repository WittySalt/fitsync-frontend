import { Component, computed, effect, input, signal, untracked } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { gramsText, ingredientGrams, loadTicks, saveTicks, servingsLabel, sessionStore } from './recipes-figures';
import { RecipeIngredient } from './recipes.models';

/**
 * The ingredients with a box to tick each one off, kept for the session so a reload in the middle
 * of cooking does not lose them. The amounts follow the servings chosen above, or show the whole
 * recipe. Each line is the text as written, with the grams the nutrition was worked out from.
 */
@Component({
  selector: 'app-ingredients-card',
  imports: [FoodGlyphComponent, FoodIconComponent],
  template: `
    <div class="head">
      <h3>Ingredients</h3>
      <div class="unit" role="group" aria-label="Amounts for">
        <button type="button" [class.on]="!whole()" [attr.aria-pressed]="!whole()" (click)="whole.set(false)">{{ label() }}</button>
        <button type="button" [class.on]="whole()" [attr.aria-pressed]="whole()" (click)="whole.set(true)">Whole recipe</button>
      </div>
    </div>
    <p class="hint">Tick them off as you go. Amounts follow the servings above.</p>
    @if (ingredients().length === 0) {
      <p class="hint">This recipe has no ingredients listed.</p>
    }
    <ul>
      @for (row of rows(); track row.id) {
        <li [class.done]="row.done">
          <button
            class="tick"
            type="button"
            role="checkbox"
            [attr.aria-checked]="row.done"
            [attr.aria-label]="row.text"
            (click)="toggle(row.id)"
          >
            @if (row.done) {
              <app-food-glyph name="CHECK" [size]="13" [strokeWidth]="3" />
            }
          </button>
          <app-food-icon [group]="row.group" [categoryCode]="row.category" [size]="30" />
          <span class="text">{{ row.text }}</span>
          <strong class="grams">{{ row.grams }}</strong>
        </li>
      }
    </ul>
  `,
  styleUrl: './ingredients-card.component.scss'
})
export class IngredientsCardComponent {
  readonly recipeId = input.required<string>();
  readonly ingredients = input.required<readonly RecipeIngredient[]>();
  /** The servings the recipe makes. */
  readonly recipeServings = input(1);
  /** The servings chosen to eat. */
  readonly servings = input(1);

  protected readonly whole = signal(false);
  private readonly ticks = signal<ReadonlySet<string>>(new Set());

  protected readonly label = computed(() => servingsLabel(this.servings()));
  protected readonly rows = computed(() =>
    this.ingredients().map((ingredient) => ({
      id: ingredient.ingredientId,
      text: ingredient.name,
      group: ingredient.foodGroup,
      category: ingredient.categoryCode,
      done: this.ticks().has(ingredient.ingredientId),
      grams: gramsText(ingredientGrams(ingredient, this.recipeServings(), this.servings(), this.whole()))
    }))
  );

  constructor() {
    effect(() => {
      const id = this.recipeId();
      untracked(() => this.ticks.set(loadTicks(sessionStore(), id)));
    });
  }

  protected toggle(ingredientId: string): void {
    const next = new Set(this.ticks());
    if (!next.delete(ingredientId)) {
      next.add(ingredientId);
    }
    this.ticks.set(next);
    saveTicks(sessionStore(), this.recipeId(), next);
  }
}
