import { ChangeDetectionStrategy, Component, computed, ElementRef, input, signal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DayMeal, NutritionSummary } from '../../../core/fitsync.models';
import {
  budgetFigure,
  defaultMealSlot,
  fillPercent,
  MEAL_SLOTS,
  MealSlot,
  macroEnergyShares,
  percentOfTarget,
  summariseSlots,
  wholeNumber
} from './today-meals';
import { tabIndexForKey } from './today-tab';

@Component({
  selector: 'app-today-food',
  imports: [RouterLink],
  templateUrl: './today-food.component.html',
  styleUrl: './today-food.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayFoodComponent {
  readonly nutrition = input.required<NutritionSummary>();
  readonly meals = input.required<DayMeal[]>();
  readonly now = input.required<Date>();

  readonly definitions = MEAL_SLOTS;
  readonly wholeNumber = wholeNumber;

  private readonly slotButtons = viewChildren<ElementRef<HTMLButtonElement>>('slotButton');
  // What the person picked. Until they pick, the card's own choice below applies.
  private readonly picked = signal<MealSlot | null>(null);

  readonly summaries = computed(() => summariseSlots(this.meals()));
  readonly selected = computed<MealSlot>(() => this.picked() ?? defaultMealSlot(this.meals(), this.now()));
  readonly selectedDefinition = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.selected()) ?? MEAL_SLOTS[0]);
  readonly current = computed(() => this.summaries()[this.selected()]);

  readonly caloriesTarget = computed(() => this.nutrition().targetCalories);
  readonly proteinTarget = computed(() => this.nutrition().targetProteinGrams);
  readonly caloriesFigure = computed(() => budgetFigure(this.nutrition().totalCalories, this.caloriesTarget(), 'kcal'));
  readonly proteinFigure = computed(() => budgetFigure(this.nutrition().totalProteinGrams, this.proteinTarget(), 'g'));
  readonly caloriesFill = computed(() => fillPercent(this.nutrition().totalCalories, this.caloriesTarget()));
  readonly proteinFill = computed(() => fillPercent(this.nutrition().totalProteinGrams, this.proteinTarget()));

  readonly share = computed(() => percentOfTarget(this.current().calories, this.caloriesTarget()));
  readonly macroShares = computed(() => {
    const meal = this.current();
    return macroEnergyShares(meal.proteinGrams, meal.carbsGrams, meal.fatGrams);
  });
  readonly macroLabel = computed(() => {
    const meal = this.current();
    return `Protein ${wholeNumber(meal.proteinGrams)} g, carbs ${wholeNumber(meal.carbsGrams)} g, fat ${wholeNumber(meal.fatGrams)} g`;
  });

  pick(slot: MealSlot): void {
    this.picked.set(slot);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const target = tabIndexForKey(event.key, index, MEAL_SLOTS.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.pick(MEAL_SLOTS[target].key);
    this.slotButtons()[target]?.nativeElement.focus();
  }

  foodLine(item: { calories: number; proteinGrams: number }): string {
    return `${wholeNumber(item.calories)} kcal · ${wholeNumber(item.proteinGrams)} g protein`;
  }
}
