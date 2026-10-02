import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { gramsText } from './cook-format';
import { scaledGrams } from './cook-recipe';
import { CookIngredient } from './cook.models';

/**
 * "All ingredients" with "X of Y added": every ingredient has a box to tick as it goes into the pan.
 * The ingredients some step names come first, in the order the steps use them; the rest follow
 * under "Not in a step". The ticks belong to the cook session, so the list in the step and this one
 * always agree.
 */
@Component({
  selector: 'app-cook-ingredients',
  imports: [FoodGlyphComponent, NgTemplateOutlet],
  template: `
    @if (!bare()) {
      <div class="head">
        <h2 class="eyebrow">All ingredients</h2>
        <span class="count">{{ count() }}</span>
      </div>
    }
    @if (ingredients().length > 0) {
      <ul>
        @for (ingredient of ingredients(); track ingredient.id) {
          <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: ingredient }" />
        }
      </ul>
    }
    @if (others().length > 0) {
      @if (ingredients().length > 0) {
        <h3 class="rest">Not in a step</h3>
      }
      <ul>
        @for (ingredient of others(); track ingredient.id) {
          <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: ingredient }" />
        }
      </ul>
    }
    <ng-template #row let-ingredient>
      @let on = isAdded(ingredient);
      <li [class.added]="on">
        <label>
          <input type="checkbox" class="sr-only" [checked]="on" (change)="toggled.emit(ingredient.id)" />
          <span class="box" aria-hidden="true">
            @if (on) {
              <app-food-glyph name="CHECK" [size]="11" [strokeWidth]="3" />
            }
          </span>
          <span class="name">{{ ingredient.name }}</span>
          @if (amount(ingredient); as grams) {
            <span class="grams">{{ grams }}</span>
          }
        </label>
      </li>
    </ng-template>
  `,
  styleUrl: './cook-ingredients.component.scss'
})
export class CookIngredientsComponent {
  /** The ingredients the steps name, in the order they are used. */
  readonly ingredients = input.required<CookIngredient[]>();
  /** The ingredients no step names. */
  readonly others = input<CookIngredient[]>([]);
  readonly added = input.required<ReadonlySet<string>>();
  readonly factor = input(1);
  /** Leaves the heading out, for a place that already has one. */
  readonly bare = input(false);
  readonly toggled = output<string>();

  protected readonly count = computed(() => {
    const all = [...this.ingredients(), ...this.others()];
    return `${all.filter((ingredient) => this.added().has(ingredient.id)).length} of ${all.length} added`;
  });

  protected isAdded(ingredient: CookIngredient): boolean {
    return this.added().has(ingredient.id);
  }

  protected amount(ingredient: CookIngredient): string {
    const grams = scaledGrams(ingredient.grams, this.factor());
    return grams === null ? '' : gramsText(grams);
  }
}
