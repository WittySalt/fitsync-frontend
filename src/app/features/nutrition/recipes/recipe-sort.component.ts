import { Component, computed, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FitLine } from './recipes-figures';
import { RecipeSort } from './recipes.models';

const LABELS: Record<RecipeSort, string> = { fit: 'Fits today', name: 'A to Z', protein: 'Most protein' };

/**
 * "Sort: Fits today / A to Z / Most protein", and under Fits today the line that says what today
 * leaves room for. Fits today is offered only while the server can sort that way.
 */
@Component({
  selector: 'app-recipe-sort',
  imports: [FoodGlyphComponent],
  template: `
    <div class="row">
      <span class="label" aria-hidden="true">Sort</span>
      <div class="segmented" role="group" aria-label="Sort">
        @for (option of options(); track option.key) {
          <button type="button" [class.on]="value() === option.key" [attr.aria-pressed]="value() === option.key" (click)="chosen.emit(option.key)">
            {{ option.label }}
          </button>
        }
      </div>
    </div>
    @if (line(); as shown) {
      <p class="why">
        <app-food-glyph name="SPARK" [size]="16" [strokeWidth]="2" />
        <span><strong>{{ shown.lead }}</strong>{{ shown.rest }}</span>
      </p>
    }
  `,
  styleUrl: './recipe-sort.component.scss'
})
export class RecipeSortComponent {
  readonly value = input.required<RecipeSort>();
  /** False when the server does not sort by fit, so the choice is not offered. */
  readonly fitOffered = input(true);
  readonly line = input<FitLine | null>(null);
  readonly chosen = output<RecipeSort>();

  protected readonly options = computed(() =>
    (['fit', 'name', 'protein'] as const)
      .filter((key) => key !== 'fit' || this.fitOffered())
      .map((key) => ({ key, label: LABELS[key] }))
  );
}
