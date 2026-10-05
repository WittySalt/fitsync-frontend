import { Component, computed, input, output } from '@angular/core';

import { UsualMeal } from '../../../core/fitsync.models';
import { MealSlot, slotForMealType, usualCombination } from '../../dashboard/today/today-meals';
import { AddRequest, DiaryMeal } from './diary.models';
import { DayMarkComponent } from './day-mark.component';
import { MealPart, fastedMeal, mealParts } from './diary-food';
import { MealPartComponent } from './meal-part.component';

const USUAL_SLOTS: readonly MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER'];

/** The day's four meals in one card: Breakfast, Lunch, Dinner and Snack. */
@Component({
  selector: 'app-meals-card',
  imports: [DayMarkComponent, MealPartComponent],
  template: `
    @if (showMark()) {
      <app-day-mark
        [date]="date()"
        [fasted]="fasted() !== null"
        [offered]="offered()"
        [hasUsual]="usualDay().length > 0"
        [busy]="busy()"
        (fast)="markFasted.emit()"
        (ate)="ateUnlogged.emit()"
        (usual)="logUsualDay.emit(usualDay())"
        (deleteFast)="deleteFast.emit(fasted()!)"
      />
    }
    @for (part of parts(); track part.slot) {
      <app-meal-part
        [part]="part"
        [usual]="usualFor(part)"
        [busy]="busy()"
        (add)="addMeal.emit(part.slot)"
        (addFrom)="addFrom.emit({ slot: part.slot, source: $event })"
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
  /** The day shown, "YYYY-MM-DD", and today, so that the nothing-logged line never shows on today. */
  readonly date = input('');
  readonly today = input('');
  /** The person said they ate and did not log; the line stays hidden for this day until the page reloads. */
  readonly dismissed = input(false);
  readonly addMeal = output<string>();
  /** A recipes, saved meals or quick add entry of a meal's Add menu. */
  readonly addFrom = output<AddRequest>();
  readonly logAgain = output<MealPart>();
  readonly saveAsMeal = output<MealPart>();
  readonly deleteMeal = output<MealPart>();
  readonly logUsual = output<UsualMeal>();
  readonly markFasted = output<void>();
  readonly ateUnlogged = output<void>();
  readonly deleteFast = output<DiaryMeal>();
  /** The usual breakfast, lunch and dinner of the person, to log in one go on a past day. */
  readonly logUsualDay = output<UsualMeal[]>();

  protected readonly parts = computed(() => mealParts(this.meals()));
  protected readonly fasted = computed(() => fastedMeal(this.meals()));
  private readonly past = computed(() => this.date() !== '' && this.date() < this.today());
  /** A past day with nothing logged at all (a fasted mark counts as logged) and no answer given yet. */
  protected readonly offered = computed(() => this.past() && this.fasted() === null && !this.dismissed() && this.parts().every((part) => !part.logged));
  protected readonly showMark = computed(() => this.fasted() !== null || this.offered());
  /** The usual meals of the three main slots that can be copied; a snack has none to offer. */
  protected readonly usualDay = computed(() => USUAL_SLOTS.map((slot) => this.usualOf(slot)).filter((meal): meal is UsualMeal => meal !== null));

  /** The usual meal offered in a part that has nothing logged. A snack has none to offer. */
  protected usualFor(part: MealPart): UsualMeal | null {
    return part.logged ? null : this.usualOf(part.slot);
  }

  private usualOf(slot: MealSlot): UsualMeal | null {
    if (slot === 'SNACK') {
      return null;
    }
    const meal = usualCombination(this.usual(), slot);
    return meal && meal.items.length > 0 && meal.sourceMealId && slotForMealType(meal.mealType) === slot ? meal : null;
  }
}
