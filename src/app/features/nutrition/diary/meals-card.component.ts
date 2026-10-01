import { Component, computed, input, output } from '@angular/core';

import { UsualMeal } from '../../../core/fitsync.models';
import { slotForMealType, usualCombination } from '../../dashboard/today/today-meals';
import { DiaryMeal } from './diary.models';
import { MealPart, mealParts } from './diary-food';
import { MealPartComponent } from './meal-part.component';

/** The day's four meals in one card: Breakfast, Lunch, Dinner and Snack. */
@Component({
  selector: 'app-meals-card',
  imports: [MealPartComponent],
  template: `
    @for (part of parts(); track part.slot) {
      <app-meal-part
        [part]="part"
        [usual]="usualFor(part)"
        [busy]="busy()"
        (add)="addMeal.emit(part.slot)"
        (logAgain)="logAgain.emit(part)"
        (saveAsMeal)="saveAsMeal.emit(part)"
        (deleteMeal)="deleteMeal.emit(part)"
        (logUsual)="logUsual.emit($event)"
      />
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-sizing: border-box;
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: var(--surface);
      }

      @media (max-width: 520px) {
        :host {
          padding: 16px;
        }
      }
    `
  ]
})
export class MealsCardComponent {
  readonly meals = input.required<DiaryMeal[]>();
  /** The usual meals from the last two weeks, one per meal type. */
  readonly usual = input<UsualMeal[]>([]);
  readonly busy = input(false);
  readonly addMeal = output<string>();
  readonly logAgain = output<MealPart>();
  readonly saveAsMeal = output<MealPart>();
  readonly deleteMeal = output<MealPart>();
  readonly logUsual = output<UsualMeal>();

  protected readonly parts = computed(() => mealParts(this.meals()));

  /** The usual meal offered in a part that has nothing logged. A snack has none to offer. */
  protected usualFor(part: MealPart): UsualMeal | null {
    if (part.logged || part.slot === 'SNACK') {
      return null;
    }
    const meal = usualCombination(this.usual(), part.slot);
    return meal && meal.items.length > 0 && slotForMealType(meal.mealType) === part.slot ? meal : null;
  }
}
