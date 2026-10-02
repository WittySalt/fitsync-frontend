import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodSearchResult } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { LOADING, Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { IngredientPickerComponent } from './ingredient-picker.component';
import {
  EditorErrors,
  EditorRow,
  NAME_MAX,
  STEPS_MAX,
  STEP_MAX,
  editorErrors,
  editorTotals,
  hasErrors,
  parseAmount,
  toDraft,
  totalsOf
} from './recipes-editor';
import { RecipeDetail } from './recipes.models';
import { RecipesService } from './recipes.service';

const DEFAULT_SERVINGS = '2';
const DEFAULT_GRAMS = 100;

/**
 * Writing a recipe, or changing one of the person's own: a name, how many it serves, ingredients
 * found with the food search and weighed in grams, and steps added one at a time. A serving's
 * calories and macros are worked out as the rows change. A saved recipe can be deleted; the server
 * only marks it, and meals already logged from it keep their foods.
 */
@Component({
  selector: 'app-recipe-editor-page',
  imports: [ConfirmDialogComponent, FoodGlyphComponent, FoodIconComponent, IngredientPickerComponent, RouterLink, StatePanelComponent],
  template: `
    <div class="page-grid editor-page">
      <a class="back" routerLink="/nutrition" [queryParams]="{ tab: 'recipes', section: 'mine' }">Recipes</a>
      @let s = loaded();
      @if (s.status === 'loading') {
        <div class="skeleton tall" aria-busy="true"></div>
      } @else if (s.status === 'error') {
        <app-state-panel title="Recipe unavailable" [message]="s.message" actionLabel="Retry" [error]="true" (action)="load()" />
      } @else {
        <form class="card" novalidate (submit)="save($event)">
          <div class="head">
            <h2>{{ editing() ? 'Edit recipe' : 'New recipe' }}</h2>
            <div class="head-actions">
              @if (editing()) {
                <button class="delete" type="button" [disabled]="saving()" (click)="confirmDelete.set(true)">Delete</button>
              }
              <button class="save" type="submit" [disabled]="saving()">{{ saving() ? 'Saving' : 'Save recipe' }}</button>
            </div>
          </div>

          <div class="top">
            <label class="field">
              <span>Name</span>
              <input type="text" name="name" [value]="name()" [attr.maxlength]="nameMax" [attr.aria-invalid]="!!errors().name && submitted()" (input)="edit(name, $event)" />
              @if (submitted() && errors().name; as message) {
                <em role="alert">{{ message }}</em>
              }
            </label>
            <label class="field serves">
              <span>Serves</span>
              <input type="text" name="servings" inputmode="decimal" [value]="servings()" [attr.aria-invalid]="!!errors().servings && submitted()" (input)="edit(servings, $event)" />
              @if (submitted() && errors().servings; as message) {
                <em role="alert">{{ message }}</em>
              }
            </label>
          </div>

          <section aria-labelledby="ingredients-title">
            <h3 id="ingredients-title">Ingredients</h3>
            <ul class="rows">
              @for (row of rows(); track row.key) {
                <li>
                  <app-food-icon [group]="row.group" [categoryCode]="row.categoryCode" [size]="32" />
                  <span class="name">{{ row.name }}</span>
                  <label class="grams">
                    <span class="sr-only">Grams of {{ row.name }}</span>
                    <input type="text" inputmode="decimal" [value]="row.grams ?? ''" (input)="setGrams(row.key, $event)" />
                    <span aria-hidden="true">g</span>
                  </label>
                  <button class="remove" type="button" [attr.aria-label]="'Remove ' + row.name" (click)="removeRow(row.key)">
                    <app-food-glyph name="CLOSE" [size]="16" [strokeWidth]="2.2" />
                  </button>
                </li>
              }
            </ul>
            <app-ingredient-picker (pick)="addFood($event)" />
            @if (adding()) {
              <p class="hint" aria-busy="true">Adding</p>
            }
            @if (submitted() && errors().ingredients; as message) {
              <em role="alert">{{ message }}</em>
            }
          </section>

          <section aria-labelledby="steps-title">
            <h3 id="steps-title">Steps</h3>
            <ol class="steps">
              @for (step of steps(); track $index) {
                <li>
                  <span class="number" aria-hidden="true">{{ $index + 1 }}</span>
                  <textarea rows="2" [attr.aria-label]="'Step ' + ($index + 1)" [attr.maxlength]="stepMax" [value]="step" (input)="setStep($index, $event)"></textarea>
                  <button class="remove" type="button" [attr.aria-label]="'Remove step ' + ($index + 1)" (click)="removeStep($index)">
                    <app-food-glyph name="CLOSE" [size]="16" [strokeWidth]="2.2" />
                  </button>
                </li>
              }
            </ol>
            <button class="link" type="button" [disabled]="steps().length >= stepsMax" (click)="addStep()">+ Add a step</button>
            @if (submitted() && errors().steps; as message) {
              <em role="alert">{{ message }}</em>
            }
          </section>

          <div class="live" aria-live="polite">
            <h3>A serving, worked out as you type</h3>
            <div class="macros">
              <div><strong>{{ kcal(totals().kcal) }}</strong><span>kcal</span></div>
              <div><strong>{{ grams(totals().proteinGrams) }}</strong><span>protein</span></div>
              <div><strong>{{ grams(totals().carbsGrams) }}</strong><span>carbs</span></div>
              <div><strong>{{ grams(totals().fatGrams) }}</strong><span>fat</span></div>
            </div>
            @if (totals().left > 0) {
              <p class="hint">{{ totals().left }} {{ totals().left === 1 ? 'ingredient is' : 'ingredients are' }} not counted yet. Each needs an amount and its figures.</p>
            }
          </div>
        </form>
        @if (confirmDelete()) {
          <app-confirm-dialog
            title="Delete this recipe?"
            message="It leaves your recipes. Meals you already logged from it keep their foods."
            confirmLabel="Delete"
            [danger]="true"
            [busy]="saving()"
            (confirmed)="remove()"
            (cancelled)="confirmDelete.set(false)"
          />
        }
      }
    </div>
  `,
  styleUrl: './recipe-editor.page.scss'
})
export class RecipeEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(RecipesService);
  private readonly data = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { initialValue: null });
  private nextKey = 1;

  protected readonly nameMax = NAME_MAX;
  protected readonly stepMax = STEP_MAX;
  protected readonly stepsMax = STEPS_MAX;

  protected readonly loaded = signal<Load<RecipeDetail | null>>(LOADING);
  protected readonly name = signal('');
  protected readonly servings = signal(DEFAULT_SERVINGS);
  protected readonly rows = signal<EditorRow[]>([]);
  protected readonly steps = signal<string[]>(['']);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly adding = signal(false);
  protected readonly confirmDelete = signal(false);
  /** True until something is changed, so a recipe that was just opened shows the server's own figures. */
  private readonly pristine = signal(true);

  protected readonly editing = computed(() => this.id() !== null);
  protected readonly servingsValue = computed(() => parseAmount(this.servings()));
  protected readonly errors = computed<EditorErrors>(() =>
    editorErrors({ name: this.name(), servings: this.servingsValue(), rows: this.rows(), steps: this.steps() })
  );
  protected readonly totals = computed(() => {
    const state = this.loaded();
    if (this.pristine() && state.status === 'ready' && state.data) {
      return totalsOf(state.data.perServing, this.rows().length);
    }
    return editorTotals(this.rows(), this.servingsValue() ?? 0);
  });
  protected readonly kcal = whole;

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const id = this.id();
    if (id === null) {
      this.loaded.set({ status: 'ready', data: null });
      return;
    }
    this.loaded.set(LOADING);
    this.service.get(id).subscribe({
      next: (recipe) => {
        if (!recipe.editable) {
          void this.router.navigate(['/nutrition/recipes', recipe.id], { replaceUrl: true });
          return;
        }
        this.fill(recipe);
        this.loaded.set({ status: 'ready', data: recipe });
      },
      error: (error: unknown) =>
        this.loaded.set({
          status: 'error',
          message: error instanceof HttpErrorResponse && error.status === 404 ? 'That recipe is not available.' : 'The recipe could not load. Please retry.'
        })
    });
  }

  private fill(recipe: RecipeDetail): void {
    this.name.set(recipe.name);
    this.servings.set(String(recipe.servings));
    this.steps.set(recipe.steps.length ? recipe.steps.map((step) => step.text) : ['']);
    this.rows.set(
      recipe.ingredients.map((ingredient) => ({
        key: this.nextKey++,
        foodCatalogItemId: ingredient.foodCatalogItemId ?? '',
        name: ingredient.foodName,
        grams: ingredient.grams,
        detail: null,
        group: ingredient.foodGroup,
        categoryCode: ingredient.categoryCode
      }))
    );
    this.pristine.set(true);
    // The figures per 100 g come in after the rows are on screen, for the live card once something changes.
    const wanted = this.rows().filter((row) => row.foodCatalogItemId !== '');
    if (wanted.length) {
      forkJoin(wanted.map((row) => this.data.getFoodDetail(row.foodCatalogItemId))).subscribe((details) => {
        const byId = new Map(wanted.map((row, index) => [row.key, details[index]]));
        this.rows.update((rows) => rows.map((row) => (byId.has(row.key) ? { ...row, detail: byId.get(row.key) ?? null } : row)));
      });
    }
  }

  protected edit(target: { set: (value: string) => void }, event: Event): void {
    target.set((event.target as HTMLInputElement).value);
    this.pristine.set(false);
  }

  protected setGrams(key: number, event: Event): void {
    const grams = parseAmount((event.target as HTMLInputElement).value);
    this.rows.update((rows) => rows.map((row) => (row.key === key ? { ...row, grams } : row)));
    this.pristine.set(false);
  }

  protected removeRow(key: number): void {
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
    this.pristine.set(false);
  }

  protected addFood(food: FoodSearchResult): void {
    if (!food.foodId) {
      this.toast.error('That food cannot be added to a recipe.');
      return;
    }
    const foodId = food.foodId;
    this.adding.set(true);
    this.data.getFoodDetail(foodId).subscribe((detail) => {
      this.adding.set(false);
      if (!detail) {
        this.toast.info('The figures for that food could not load, so it is not counted in the serving yet.');
      }
      this.rows.update((rows) => [
        ...rows,
        { key: this.nextKey++, foodCatalogItemId: foodId, name: food.displayName, grams: DEFAULT_GRAMS, detail, group: null, categoryCode: null }
      ]);
      this.pristine.set(false);
    });
  }

  protected addStep(): void {
    this.steps.update((steps) => [...steps, '']);
    this.pristine.set(false);
  }

  protected setStep(index: number, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.steps.update((steps) => steps.map((step, position) => (position === index ? text : step)));
    this.pristine.set(false);
  }

  protected removeStep(index: number): void {
    this.steps.update((steps) => (steps.length > 1 ? steps.filter((_, position) => position !== index) : ['']));
    this.pristine.set(false);
  }

  protected grams(value: number): string {
    return `${Math.round(value)} g`;
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (hasErrors(this.errors()) || this.saving()) {
      return;
    }
    const draft = toDraft({ name: this.name(), servings: this.servingsValue(), rows: this.rows(), steps: this.steps() });
    const id = this.id();
    this.saving.set(true);
    (id === null ? this.service.create(draft) : this.service.update(id, draft)).subscribe({
      next: (savedId) => {
        this.saving.set(false);
        this.toast.success(id === null ? `Saved ${draft.name}.` : `Updated ${draft.name}.`);
        void this.router.navigate(['/nutrition/recipes', savedId || id]);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Unable to save that recipe. Please retry.');
      }
    });
  }

  protected remove(): void {
    const id = this.id();
    if (id === null) {
      return;
    }
    this.saving.set(true);
    this.service.remove(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmDelete.set(false);
        this.toast.success(`Deleted ${this.name().trim() || 'the recipe'}.`);
        void this.router.navigate(['/nutrition'], { queryParams: { tab: 'recipes', section: 'mine' } });
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Unable to delete that recipe. Please retry.');
      }
    });
  }
}
