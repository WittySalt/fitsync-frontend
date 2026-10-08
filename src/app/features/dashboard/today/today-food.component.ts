import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DayMeal, NutritionSummary, UsualMeal } from '../../../core/fitsync.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import {
  budgetFigure,
  defaultMealSlot,
  dueMealSlot,
  fillPercent,
  loggedAhead,
  MEAL_SLOTS,
  MealSlot,
  macroEnergyShares,
  percentOfTarget,
  slotUsualTime,
  summariseSlots,
  todayAt,
  usualCombination,
  usualTimeAhead,
  wholeNumber
} from './today-meals';
import { tabIndexForKey } from './today-tab';

/** What the card is asked to log: a copy of the usual meal at the given moment. */
export interface UsualMealLog {
  mealId: string;
  mealType: MealSlot;
  /** The moment to log the copy for, or null for the moment the request is made. */
  consumedAt: Date | null;
}

@Component({
  selector: 'app-today-food',
  imports: [RouterLink],
  templateUrl: './today-food.component.html',
  styleUrl: './today-food.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayFoodComponent {
  private readonly userTimezone = inject(UserTimezoneService);

  readonly nutrition = input.required<NutritionSummary>();
  readonly meals = input.required<DayMeal[]>();
  readonly now = input.required<Date>();
  readonly usual = input<UsualMeal[]>([]);
  /** True while a copy of a usual meal is being saved. */
  readonly busy = input(false);
  readonly logUsual = output<UsualMealLog>();

  readonly definitions = MEAL_SLOTS;
  readonly wholeNumber = wholeNumber;

  private readonly slotButtons = viewChildren<ElementRef<HTMLButtonElement>>('slotButton');
  // What the person picked. Until they pick, the card's own choice below applies.
  private readonly picked = signal<MealSlot | null>(null);

  readonly summaries = computed(() => summariseSlots(this.meals()));
  readonly selected = computed<MealSlot>(() => this.picked() ?? defaultMealSlot(this.meals(), this.now(), this.usual(), this.userTimezone.zone()));
  readonly selectedDefinition = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.selected()) ?? MEAL_SLOTS[0]);
  readonly current = computed(() => this.summaries()[this.selected()]);

  // The meal to eat now keeps its dot whichever slot the person opens.
  readonly dueSlot = computed(() => dueMealSlot(this.meals(), this.now(), this.usual(), this.userTimezone.zone()));
  readonly combination = computed(() => usualCombination(this.usual(), this.selected()));
  readonly usualFigure = computed(() => {
    const combination = this.combination();
    if (combination === null) {
      return '';
    }
    const parts: string[] = [];
    if (combination.totalCalories !== null) {
      parts.push(`${wholeNumber(combination.totalCalories)} kcal`);
    }
    if (combination.totalProteinGrams !== null) {
      parts.push(`${wholeNumber(combination.totalProteinGrams)} g protein`);
    }
    return parts.join(' · ');
  });
  readonly usualTime = computed(() => slotUsualTime(this.usual(), this.selected()));
  // A usual time that has passed cannot be logged for, so the quiet action is left out.
  readonly usualTimeIsAhead = computed(() => usualTimeAhead(this.usualTime(), this.now(), this.userTimezone.zone()));
  readonly ahead = computed(() => loggedAhead(this.meals(), this.selected(), this.now()));

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

  foodLine(item: { calories: number | null; proteinGrams: number | null }): string {
    const parts: string[] = [];
    if (item.calories !== null) {
      parts.push(`${wholeNumber(item.calories)} kcal`);
    }
    if (item.proteinGrams !== null) {
      parts.push(`${wholeNumber(item.proteinGrams)} g protein`);
    }
    return parts.join(' · ');
  }

  logNow(): void {
    this.request(null);
  }

  logAtUsualTime(): void {
    const moment = todayAt(this.usualTime(), this.now(), this.userTimezone.zone());
    if (moment !== null) {
      this.request(moment);
    }
  }

  private request(consumedAt: Date | null): void {
    const combination = this.combination();
    if (combination?.sourceMealId == null || this.busy()) {
      return;
    }
    // The slot stays open while the copy is saved, so the logged meal appears where the person is looking.
    this.picked.set(this.selected());
    this.logUsual.emit({ mealId: combination.sourceMealId, mealType: this.selected(), consumedAt });
  }
}
