import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { groupForCategory } from '../../../shared/food/food-groups';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { LOADING, Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { RecipeCoverComponent } from './recipe-cover.component';
import { savedMealLine, topGroupsOf } from './recipes-figures';
import { RecipeDetail, SavedMeal, SavedMealItem } from './recipes.models';
import { RecipesService } from './recipes.service';

const UNDO_MS = 6000;

/** What a saved meal shows as its picture: the first recipe in it (its cover), or else its first food. */
export function leadItem(meal: SavedMeal): SavedMealItem | null {
  return meal.items.find((item) => item.recipeId !== null) ?? meal.items[0] ?? null;
}

/**
 * The saved meals, each with its foods and kcal and a Log it button. A recipe in a saved meal shows
 * that recipe's cover and its servings. A meal is logged now, under the meal type the person is
 * picking for when they came from a meal's Add menu, otherwise under the one it was saved with.
 */
@Component({
  selector: 'app-saved-meals',
  imports: [FoodIconComponent, RecipeCoverComponent, StatePanelComponent],
  template: `
    @let s = state();
    @if (s.status === 'loading') {
      <div class="skeleton rows" aria-busy="true"></div>
    } @else if (s.status === 'error') {
      <app-state-panel title="Saved meals unavailable" [message]="s.message" actionLabel="Retry" [error]="true" (action)="load()" />
    } @else if (s.data.length === 0) {
      <div class="empty">
        <strong>No saved meals yet</strong>
        <p>Save a meal from the Diary, or add a recipe to one from its page.</p>
      </div>
    } @else {
      <p class="hint">A saved meal is what you eat together again. It can hold recipes.</p>
      <ul>
        @for (meal of s.data; track meal.templateId) {
          <li>
            @let lead = leadOf(meal);
            @if (lead && lead.recipeId; as recipeId) {
              <app-recipe-cover [imageUrl]="recipe(recipeId)?.imageUrl ?? null" [groups]="groupsOf(recipeId)" [height]="44" [width]="44" [radius]="12" [glyph]="12" />
            } @else {
              <app-food-icon [group]="lead?.foodGroup ?? groupOf(lead?.categoryCode)" [categoryCode]="lead?.categoryCode ?? null" [size]="44" />
            }
            <div class="text">
              <strong>{{ meal.name }}</strong>
              <span>{{ line(meal) }}</span>
            </div>
            <strong class="kcal">{{ kcal(meal.totalCalories) }}</strong>
            <button class="log" type="button" [disabled]="busyId() !== null" (click)="logIt(meal)">Log it</button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './saved-meals.component.scss'
})
export class SavedMealsComponent {
  private readonly service = inject(RecipesService);
  private readonly diary = inject(NutritionDiaryService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** The meal type a person is picking for, or null to keep each saved meal's own. */
  readonly logTo = input<string | null>(null);

  protected readonly state = signal<Load<SavedMeal[]>>(LOADING);
  protected readonly busyId = signal<string | null>(null);
  private readonly recipes = signal<ReadonlyMap<string, RecipeDetail | null>>(new Map());
  protected readonly line = savedMealLine;
  protected readonly leadOf = leadItem;
  protected readonly groupOf = groupForCategory;
  protected readonly kcal = whole;

  constructor() {
    this.load();
  }

  protected recipe(id: string): RecipeDetail | null {
    return this.recipes().get(id) ?? null;
  }

  protected groupsOf(id: string) {
    const found = this.recipe(id);
    return found ? topGroupsOf(found) : [];
  }

  protected load(): void {
    this.state.set(LOADING);
    this.service
      .savedMeals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => {
          this.state.set({ status: 'ready', data: meals });
          this.loadRecipes(meals);
        },
        error: () => this.state.set({ status: 'error', message: 'Your saved meals could not load. Please retry.' })
      });
  }

  private loadRecipes(meals: SavedMeal[]): void {
    const ids = [...new Set(meals.map(leadItem).flatMap((item) => (item?.recipeId ? [item.recipeId] : [])))];
    if (ids.length === 0) {
      return;
    }
    forkJoin(ids.map((id) => this.service.lookup(id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((found) => this.recipes.set(new Map(ids.map((id, index) => [id, found[index]]))));
  }

  protected logIt(meal: SavedMeal): void {
    this.busyId.set(meal.templateId);
    this.service.logSavedMeal(meal.templateId, this.logTo()).subscribe({
      next: ({ mealId }) => {
        this.busyId.set(null);
        this.toast.success(`Logged ${meal.name}.`, UNDO_MS, mealId ? { label: 'Undo', run: () => this.undo(mealId) } : undefined);
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error('Unable to log that saved meal. Please retry.');
      }
    });
  }

  private undo(mealId: string): void {
    this.diary.deleteMeal(mealId).subscribe({
      next: () => this.toast.info('Removed.'),
      error: () => this.toast.error('Unable to undo that. Please retry.')
    });
  }
}
