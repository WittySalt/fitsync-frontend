import { Component, inject, input } from '@angular/core';

import { CoachStore } from '../../../core/coach/coach.store';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';

export const RECIPE_QUESTIONS: readonly string[] = ['Does this fit today?', 'Make it higher in protein', 'Something with less fat'];

/**
 * "Ask your coach about this recipe": three questions to tap. Tapping opens the coach dock and sends
 * the question with the recipe attached, so the coach answers about this recipe and not in general.
 */
@Component({
  selector: 'app-recipe-coach-row',
  imports: [FoodGlyphComponent],
  template: `
    <h3><span class="mark" aria-hidden="true"><app-food-glyph name="SPARK" [size]="15" [strokeWidth]="2" /></span>Ask your coach about this recipe</h3>
    <div class="chips">
      @for (question of questions; track question) {
        <button type="button" (click)="ask(question)">{{ question }}</button>
      }
    </div>
  `,
  styleUrl: './recipe-coach-row.component.scss'
})
export class RecipeCoachRowComponent {
  private readonly coach = inject(CoachStore);

  readonly recipeId = input.required<string>();

  protected readonly questions = RECIPE_QUESTIONS;

  protected ask(question: string): void {
    this.coach.open();
    this.coach.ask(question, { recipeId: this.recipeId() });
  }
}
