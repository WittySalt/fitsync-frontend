import { Component, DestroyRef, WritableSignal, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { AccountDataService } from '../../../core/account-data.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { AddRequest, DiarySummary, DiaryMeal, FrequentDrink, LOADING, Load, NutrientSummary, RangeDay, WaterDay } from './diary.models';
import { MealPart } from './diary-food';
import { dayLabel } from './diary-time';
import { loggedMoment } from './diary-water';
import { AddDrinkDialogComponent } from './add-drink-dialog.component';
import { BalanceCardComponent } from './balance-card.component';
import { BudgetCardComponent } from './budget-card.component';
import { DrinkAdd } from './drink-drink-panel.component';
import { WaterAdd } from './drink-water-panel.component';
import { MealsCardComponent } from './meals-card.component';
import { NutritionDiaryService } from './nutrition-diary.service';
import { PlateCardComponent } from './plate-card.component';
import { VitaminsCardComponent } from './vitamins-card.component';
import { weekRange } from './vitamins-week';
import { WaterCardComponent } from './water-card.component';

const UNDO_MS = 6000;
const VITAMINS_FAILURE = 'Vitamins and minerals could not load. Please retry.';
const DAY_START_HOUR = 6;
const DAY_SPAN_HOURS = 16;

/** The Diary for one day: meals, water, plate, budget, balance and vitamins, each loading and failing on its own. */
@Component({
  selector: 'app-diary-day',
  imports: [
    AddDrinkDialogComponent,
    BalanceCardComponent,
    BudgetCardComponent,
    ConfirmDialogComponent,
    MealsCardComponent,
    PlateCardComponent,
    StatePanelComponent,
    VitaminsCardComponent,
    WaterCardComponent
  ],
  template: `
    <div class="layout">
      <div class="column main">
        <div class="slot c-meals">
          @let m = meals();
          @if (m.status === 'ready') {
            <app-meals-card
              [meals]="m.data"
              [usual]="usual()"
              [busy]="busy()"
              (addMeal)="addMeal.emit($event)"
              (addFrom)="addFrom.emit($event)"
              (logAgain)="logAgain($event)"
              (saveAsMeal)="saveAsMeal($event)"
              (deleteMeal)="confirming.set($event)"
              (logUsual)="logUsual($event)"
            />
          } @else if (m.status === 'error') {
            <app-state-panel title="Meals unavailable" [message]="m.message" actionLabel="Retry" [error]="true" (action)="loadMeals()" />
          } @else {
            <div class="skeleton tall" aria-busy="true"></div>
          }
        </div>
        <div class="slot c-water">
          @let w = water();
          @if (w.status === 'ready') {
            <app-water-card
              [day]="w.data"
              [goal]="waterGoal()"
              [frequent]="frequent()"
              [nowPercent]="nowPercent()"
              [busy]="busy()"
              (glass)="quickWater(250, 'a glass of water')"
              (bottle)="quickWater(500, 'a bottle of water')"
              (quickDrink)="quickDrink($event)"
              (another)="dialogOpen.set(true)"
            />
          } @else if (w.status === 'error') {
            <app-state-panel title="Water unavailable" [message]="w.message" actionLabel="Retry" [error]="true" (action)="loadWater()" />
          } @else {
            <div class="skeleton" aria-busy="true"></div>
          }
        </div>
        <div class="slot c-plate">
          @let p = meals();
          @if (p.status === 'ready') {
            <app-plate-card [items]="items()" [isToday]="isToday()" />
          } @else if (p.status === 'loading') {
            <div class="skeleton tall" aria-busy="true"></div>
          }
        </div>
      </div>
      <div class="column side">
        <div class="slot c-budget">
          @let s = summary();
          @if (s.status === 'ready') {
            <app-budget-card [summary]="s.data" [label]="isToday() ? 'Today' : label()" />
          } @else if (s.status === 'error') {
            <app-state-panel title="Summary unavailable" [message]="s.message" actionLabel="Retry" [error]="true" (action)="loadSummary()" />
          } @else {
            <div class="skeleton" aria-busy="true"></div>
          }
        </div>
        <div class="slot c-balance">
          @let b = summary();
          @if (b.status === 'ready') {
            @if (b.data.balance || b.data.proteinByMeal) {
              <app-balance-card [entries]="b.data.balance ?? []" [proteinByMeal]="b.data.proteinByMeal" [days]="days()" [dates]="dates()" [today]="today()" />
            }
          } @else if (b.status === 'loading') {
            <div class="skeleton tall" aria-busy="true"></div>
          }
        </div>
        <div class="slot c-vitamins">
          <app-vitamins-card [state]="nutrients()" [week]="weekNutrients()" [date]="date()" [today]="today()" (retry)="retryNutrients()" />
        </div>
      </div>
    </div>
    @if (confirming(); as part) {
      <app-confirm-dialog
        [title]="'Delete ' + part.label.toLowerCase() + '?'"
        [message]="'Its foods are removed from ' + label() + '.'"
        confirmLabel="Delete"
        [danger]="true"
        [busy]="busy()"
        (confirmed)="deleteMeal(part)"
        (cancelled)="confirming.set(null)"
      />
    }
    @if (dialogOpen()) {
      <app-add-drink-dialog [date]="date()" [today]="today()" [busy]="busy()" (closed)="dialogOpen.set(false)" (addWater)="addWater($event)" (addDrink)="addDrink($event)" />
    }
  `,
  styleUrl: './diary-day.component.scss'
})
export class DiaryDayComponent {
  private readonly service = inject(NutritionDiaryService);
  private readonly data = inject(FitSyncDataService);
  private readonly account = inject(AccountDataService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** The day shown, "YYYY-MM-DD". */
  readonly date = input.required<string>();
  /** The seven dates of the current week, Monday first, for the week dots. */
  readonly dates = input.required<string[]>();
  readonly today = input.required<string>();
  /** The week's days from the range endpoint. */
  readonly days = input<RangeDay[]>([]);
  /** Raise this number to reload the day, for example after a meal was saved in the builder. */
  readonly refresh = input(0);
  /** Something was added, removed or copied, so the week card should reload. */
  readonly changed = output<void>();
  /** The person wants to log food for this meal type. */
  readonly addMeal = output<string>();
  /** The person chose recipes, saved meals or quick add from a meal's Add menu. */
  readonly addFrom = output<AddRequest>();

  protected readonly summary = signal<Load<DiarySummary>>(LOADING);
  protected readonly meals = signal<Load<DiaryMeal[]>>(LOADING);
  protected readonly water = signal<Load<WaterDay>>(LOADING);
  protected readonly nutrients = signal<Load<NutrientSummary>>(LOADING);
  protected readonly weekNutrients = signal<Load<NutrientSummary>>(LOADING);
  protected readonly usual = signal<UsualMeal[]>([]);
  protected readonly frequent = signal<FrequentDrink[]>([]);
  protected readonly waterGoal = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirming = signal<MealPart | null>(null);
  protected readonly dialogOpen = signal(false);

  private readonly weekStart = computed(() => weekRange(this.date()).monday);
  protected readonly isToday = computed(() => this.date() === this.today());
  protected readonly label = computed(() => dayLabel(this.date()));
  protected readonly items = computed(() => {
    const state = this.meals();
    return state.status === 'ready' ? state.data.flatMap((meal) => meal.items) : [];
  });
  /** How far the day has gone between 6:00 and 22:00, for today only. */
  protected readonly nowPercent = computed(() => {
    if (!this.isToday()) {
      return null;
    }
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    return Math.min(Math.max(((hours - DAY_START_HOUR) / DAY_SPAN_HOURS) * 100, 0), 100);
  });

  // A reload that starts while an older one is still on its way makes the older answer stale.
  private generation = 0;
  // The vitamin loads count on their own: a day change must not make the week answer stale while the week stays the same.
  private readonly stamps = { today: 0, week: 0 };

  constructor() {
    effect(() => {
      this.date();
      this.refresh();
      untracked(() => this.loadDay());
    });
    effect(() => {
      this.date();
      this.refresh();
      untracked(() => this.loadNutrients());
    });
    // Tracks the Monday only, so moving between the days of one week keeps the week that is already loaded.
    effect(() => {
      this.weekStart();
      this.refresh();
      untracked(() => this.loadWeekNutrients());
    });
    this.data
      .getUsualMeals()
      .pipe(catchError(() => of([] as UsualMeal[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((meals) => this.usual.set(meals));
    this.account
      .getCurrentUser()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        const goal = user?.preferences?.nutrition?.waterGoalMl ?? null;
        this.waterGoal.set(goal !== null && goal > 0 ? goal : null);
      });
    this.loadFrequent();
  }

  protected loadSummary(silent = false): void {
    this.fetch(this.summary, this.service.getSummary(this.date()), 'The summary could not load. Please retry.', silent);
  }

  protected loadMeals(silent = false): void {
    this.fetch(this.meals, this.service.getMeals(this.date()), 'The meals could not load. Please retry.', silent);
  }

  protected loadWater(silent = false): void {
    this.fetch(this.water, this.service.getWater(this.date()), 'Water could not load. Please retry.', silent);
  }

  /** The selected day alone. The old figures stay on screen while the new ones are on their way. */
  protected loadNutrients(silent = false): void {
    const day = this.date();
    this.fetch(this.nutrients, this.service.getNutrients(day, day), VITAMINS_FAILURE, silent, 'today');
  }

  /** The week of the selected day, Monday to Sunday. */
  protected loadWeekNutrients(silent = false): void {
    const { monday, sunday } = weekRange(this.date());
    this.fetch(this.weekNutrients, this.service.getNutrients(monday, sunday), VITAMINS_FAILURE, silent, 'week');
  }

  protected retryNutrients(): void {
    this.loadNutrients();
    this.loadWeekNutrients();
  }

  private loadDay(): void {
    this.generation += 1;
    this.loadSummary();
    this.loadMeals();
    this.loadWater();
  }

  private loadFrequent(): void {
    this.service
      .frequentDrinks(2)
      .pipe(catchError(() => of([] as FrequentDrink[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((drinks) => this.frequent.set(drinks));
  }

  /** Everything a changed meal touches, reloaded without blanking the cards. */
  private afterMealChange(): void {
    this.loadSummary(true);
    this.loadMeals(true);
    this.loadWater(true);
    this.loadNutrients(true);
    this.loadWeekNutrients(true);
    this.loadFrequent();
    this.changed.emit();
  }

  private fetch<T>(target: WritableSignal<Load<T>>, source: Observable<T>, failure: string, silent: boolean, stamp?: 'today' | 'week'): void {
    const current = (): number => (stamp ? this.stamps[stamp] : this.generation);
    if (stamp) {
      this.stamps[stamp] += 1;
    }
    const expected = current();
    // The vitamin cards keep their previous figures while a refetch runs instead of falling back to a skeleton.
    if (!silent && !(stamp && target().status === 'ready')) {
      target.set(LOADING);
    }
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (current() === expected) {
          target.set({ status: 'ready', data });
        }
      },
      error: () => {
        if (current() === expected && !silent) {
          target.set({ status: 'error', message: failure });
        }
      }
    });
  }

  // ---- meal actions

  protected deleteMeal(part: MealPart): void {
    this.busy.set(true);
    forkJoin(part.mealIds.map((id) => this.service.deleteMeal(id))).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirming.set(null);
        this.toast.success(`Deleted ${part.label.toLowerCase()}.`);
        this.afterMealChange();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to delete that meal. Please retry.');
      }
    });
  }

  protected logAgain(part: MealPart): void {
    this.busy.set(true);
    forkJoin(part.meals.map((meal) => this.data.copyMeal(meal.mealId, meal.mealType))).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Logged ${part.label.toLowerCase()} again for now.`);
        this.afterMealChange();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to log that meal again. Please retry.');
      }
    });
  }

  protected saveAsMeal(part: MealPart): void {
    const name = part.meals.find((meal) => meal.name)?.name || `${part.label}${part.time ? ', ' + part.time : ''}`;
    this.busy.set(true);
    this.data.createMealTemplate({ name, mealType: part.slot, note: '', items: part.items.map((item) => item.draft) }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Saved as a meal. You will find it under Saved meals when you add food.');
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to save that meal. Please retry.');
      }
    });
  }

  protected logUsual(meal: UsualMeal): void {
    if (!meal.sourceMealId) {
      return;
    }
    this.busy.set(true);
    this.data.copyMeal(meal.sourceMealId, meal.mealType, this.isToday() ? undefined : loggedMoment(this.date(), meal.usualTime ?? '', this.today(), new Date()).toISOString()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Logged your usual meal.');
        this.afterMealChange();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to log that meal. Please retry.');
      }
    });
  }

  // ---- water and drinks

  protected quickWater(ml: number, words: string): void {
    this.saveWater(ml, loggedMoment(this.date(), '', this.today(), new Date()), `Added ${words}.`);
  }

  protected addWater(add: WaterAdd): void {
    this.saveWater(add.ml, add.at, `Added ${add.ml} ml of water.`);
  }

  private saveWater(ml: number, at: Date, message: string): void {
    this.busy.set(true);
    this.service.logWater(ml, at).subscribe({
      next: ({ waterId }) => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.loadWater(true);
        this.toast.success(message, UNDO_MS, waterId ? { label: 'Undo', run: () => this.undoWater(waterId) } : undefined);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to add water. Please retry.');
      }
    });
  }

  private undoWater(waterId: string): void {
    this.service.deleteWater(waterId).subscribe({
      next: () => {
        this.loadWater(true);
        this.toast.info('Removed.');
      },
      error: () => this.toast.error('Unable to undo that. Please retry.')
    });
  }

  protected quickDrink(drink: FrequentDrink): void {
    this.saveDrink(drink.draft, loggedMoment(this.date(), '', this.today(), new Date()), drink.name);
  }

  protected addDrink(add: DrinkAdd): void {
    this.saveDrink(add.item, add.at, add.name);
  }

  private saveDrink(item: DrinkAdd['item'], at: Date, name: string): void {
    this.busy.set(true);
    this.service.logDrink(item, at).subscribe({
      next: (meal) => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.afterMealChange();
        this.toast.success(`Added ${name}.`, UNDO_MS, meal.mealId ? { label: 'Undo', run: () => this.undoDrink(meal.mealId) } : undefined);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to add that drink. Please retry.');
      }
    });
  }

  private undoDrink(mealId: string): void {
    this.service.deleteMeal(mealId).subscribe({
      next: () => {
        this.afterMealChange();
        this.toast.info('Removed.');
      },
      error: () => this.toast.error('Unable to undo that. Please retry.')
    });
  }
}
