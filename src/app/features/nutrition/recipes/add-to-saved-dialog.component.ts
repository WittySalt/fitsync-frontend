import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';

import { ToastService } from '../../../core/toast/toast.service';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { LOADING, Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { savedMealLine, servingsLabel } from './recipes-figures';
import { SavedMeal } from './recipes.models';
import { RecipesService } from './recipes.service';

const NAME_LIMIT = 120;

/**
 * Puts a recipe, at the servings chosen, into a saved meal: one the person already has, or a new one
 * with a name. The saved meals are read when the dialog opens, with their own loading and retry.
 */
@Component({
  selector: 'app-add-to-saved-dialog',
  imports: [StatePanelComponent],
  template: `
    <div class="backdrop" (click)="close()" aria-hidden="true"></div>
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="saved-title">
      <h2 id="saved-title">Add to a saved meal</h2>
      <p class="sub">{{ recipeName() }} · {{ servingsText() }}</p>
      @let s = meals();
      @if (s.status === 'loading') {
        <div class="skeleton" aria-busy="true"></div>
      } @else if (s.status === 'error') {
        <app-state-panel title="Saved meals unavailable" [message]="s.message" actionLabel="Retry" [error]="true" (action)="load()" />
      } @else {
        <ul role="radiogroup" aria-label="Saved meal">
          @for (meal of s.data; track meal.templateId) {
            <li>
              <button type="button" role="radio" [attr.aria-checked]="choice() === meal.templateId" [class.on]="choice() === meal.templateId" (click)="choice.set(meal.templateId)">
                <strong>{{ meal.name }}</strong>
                <span>{{ line(meal) }} · {{ kcal(meal.totalCalories) }} kcal</span>
              </button>
            </li>
          }
          <li>
            <button type="button" role="radio" [attr.aria-checked]="choice() === 'new'" [class.on]="choice() === 'new'" (click)="choice.set('new')">
              <strong>A new saved meal</strong>
              <span>Start one with this recipe</span>
            </button>
          </li>
        </ul>
        @if (choice() === 'new') {
          <label class="name">
            <span>Name</span>
            <input type="text" [value]="name()" [attr.maxlength]="limit" placeholder="For example, Salad lunch" (input)="name.set($any($event.target).value)" />
          </label>
        }
      }
      <div class="actions">
        <button class="cancel" type="button" [disabled]="busy()" (click)="close()">Cancel</button>
        <button class="confirm" type="button" [disabled]="!canSave()" (click)="save()">Add</button>
      </div>
    </div>
  `,
  styleUrl: './add-to-saved-dialog.component.scss'
})
export class AddToSavedDialogComponent {
  private readonly service = inject(RecipesService);
  private readonly toast = inject(ToastService);

  readonly recipeId = input.required<string>();
  readonly recipeName = input.required<string>();
  readonly servings = input(1);
  /** The meal type a new saved meal is filed under. */
  readonly mealType = input('LUNCH');
  readonly closed = output<void>();

  protected readonly limit = NAME_LIMIT;
  protected readonly meals = signal<Load<SavedMeal[]>>(LOADING);
  protected readonly choice = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly line = savedMealLine;
  protected readonly kcal = whole;
  protected readonly servingsText = computed(() => servingsLabel(this.servings()));
  protected readonly canSave = computed(() => {
    if (this.busy() || this.meals().status !== 'ready' || this.choice() === null) {
      return false;
    }
    return this.choice() !== 'new' || this.name().trim().length > 0;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.meals.set(LOADING);
    this.service.savedMeals().subscribe({
      next: (data) => {
        this.meals.set({ status: 'ready', data });
        this.choice.set(data.length === 0 ? 'new' : null);
      },
      error: () => this.meals.set({ status: 'error', message: 'Your saved meals could not load. Please retry.' })
    });
  }

  protected save(): void {
    const state = this.meals();
    const choice = this.choice();
    if (!this.canSave() || state.status !== 'ready' || choice === null) {
      return;
    }
    this.busy.set(true);
    const chosen = state.data.find((meal) => meal.templateId === choice);
    const request =
      choice === 'new' || !chosen
        ? this.service.createSavedMealWithRecipe(this.name().trim().slice(0, NAME_LIMIT), this.mealType(), this.recipeId(), this.servings())
        : this.service.addRecipeToSavedMeal(chosen.templateId, this.recipeId(), this.servings());
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(chosen ? `Added to ${chosen.name}.` : 'Saved as a new meal.');
        this.closed.emit();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to add that to a saved meal. Please retry.');
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }
}
