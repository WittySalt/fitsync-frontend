import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodSearchResult } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { groupForCategory } from '../../../shared/food/food-groups';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { DiaryMeal, LOADING, Load } from '../diary/diary.models';
import { EditorIngredientsComponent } from './editor-ingredients.component';
import { EditorStartComponent } from './editor-start.component';
import { EditorStepsComponent } from './editor-steps.component';
import {
  EditorErrors,
  EditorRow,
  NAME_MAX,
  RowSeed,
  categoryCodeOf,
  editorErrors,
  editorTotals,
  hasErrors,
  mealToRows,
  moveItem,
  parseAmount,
  previewTags,
  rowGroups,
  toDraft,
  totalsOf
} from './recipes-editor';
import { findTimer } from './recipes-timers';
import { RecipePreviewComponent } from './recipe-preview.component';
import { RecipeCard, RecipeDetail } from './recipes.models';
import { RecipesService } from './recipes.service';

const DEFAULT_SERVINGS = '2';
const DEFAULT_GRAMS = 100;

/**
 * Writing a recipe, or changing one of the person's own. A new recipe starts from scratch, from a
 * meal logged lately or from a copy of a library recipe. Ingredients are found with the food search
 * and weighed in grams, steps are written one at a time, and both can be reordered by dragging or
 * with buttons. On the right the recipe page draws itself as it is written: cover, tags, facts and
 * what a serving gives. A saved recipe can be deleted; the server only marks it, and meals already
 * logged from it keep their foods.
 */
@Component({
  selector: 'app-recipe-editor-page',
  imports: [
    ConfirmDialogComponent,
    EditorIngredientsComponent,
    EditorStartComponent,
    EditorStepsComponent,
    RecipePreviewComponent,
    RouterLink,
    StatePanelComponent
  ],
  template: `
    <div class="page-grid editor-page">
      <a class="back" routerLink="/nutrition" [queryParams]="{ tab: 'recipes', section: 'mine' }" aria-label="Back to your recipes">&larr; Back</a>
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

          <div class="cols">
            <div class="left">
              @if (!editing()) {
                <app-editor-start [busy]="copying()" (fromMeal)="startFromMeal($event)" (recipeChosen)="startFromCopy($event)" />
              }

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

              <app-editor-ingredients
                [rows]="rows()"
                [adding]="adding()"
                [error]="submitted() ? (errors().ingredients ?? null) : null"
                (picked)="addFood($event)"
                (removed)="removeRow($event)"
                (grams)="setGrams($event.key, $event.grams)"
                (moved)="moveRow($event.from, $event.to)"
              />

              <app-editor-steps
                [steps]="steps()"
                [error]="submitted() ? (errors().steps ?? null) : null"
                (changed)="setStep($event.index, $event.text)"
                (added)="addStep()"
                (removed)="removeStep($event)"
                (moved)="moveStep($event.from, $event.to)"
              />
            </div>
            <aside class="right" aria-label="Preview">
              <app-recipe-preview
                [name]="name()"
                [servings]="servingsValue()"
                [groups]="groups()"
                [tags]="tags()"
                [ingredients]="rows().length"
                [steps]="stepCount()"
                [timers]="timerCount()"
                [totals]="totals()"
              />
            </aside>
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

  protected readonly loaded = signal<Load<RecipeDetail | null>>(LOADING);
  protected readonly name = signal('');
  protected readonly servings = signal(DEFAULT_SERVINGS);
  protected readonly rows = signal<EditorRow[]>([]);
  protected readonly steps = signal<string[]>(['']);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly adding = signal(false);
  protected readonly copying = signal(false);
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
  protected readonly groups = computed(() => rowGroups(this.rows()));
  protected readonly tags = computed(() => previewTags(this.rows()));
  protected readonly stepCount = computed(() => this.steps().filter((step) => step.trim() !== '').length);
  protected readonly timerCount = computed(() => this.steps().filter((step) => findTimer(step) !== null).length);

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
    this.loadDetails(this.rows());
  }

  /** The figures per basis amount come in after the rows are on screen, for the live card once something changes. */
  private loadDetails(rows: readonly EditorRow[]): void {
    const wanted = rows.filter((row) => row.foodCatalogItemId !== '');
    if (wanted.length) {
      forkJoin(wanted.map((row) => this.data.getFoodDetail(row.foodCatalogItemId))).subscribe((details) => {
        const byId = new Map(wanted.map((row, index) => [row.key, details[index]]));
        this.rows.update((current) => current.map((row) => (byId.has(row.key) ? { ...row, detail: byId.get(row.key) ?? null } : row)));
      });
    }
  }

  protected edit(target: { set: (value: string) => void }, event: Event): void {
    target.set((event.target as HTMLInputElement).value);
    this.pristine.set(false);
  }

  protected setGrams(key: number, grams: number | null): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? { ...row, grams } : row)));
    this.pristine.set(false);
  }

  protected removeRow(key: number): void {
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
    this.pristine.set(false);
  }

  protected moveRow(from: number, to: number): void {
    this.rows.update((rows) => moveItem(rows, from, to));
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
      const categoryCode = categoryCodeOf(food.categoryName);
      this.rows.update((rows) => [
        ...rows,
        { key: this.nextKey++, foodCatalogItemId: foodId, name: food.displayName, grams: DEFAULT_GRAMS, detail, group: groupForCategory(categoryCode), categoryCode }
      ]);
      this.pristine.set(false);
    });
  }

  /** A meal chosen as the start: its foods and grams become the ingredients, added after any already there. */
  protected startFromMeal(meal: DiaryMeal): void {
    const { rows, left } = mealToRows(meal);
    const added: EditorRow[] = rows.map((seed: RowSeed) => ({ ...seed, key: this.nextKey++, detail: null }));
    this.rows.update((current) => [...current, ...added]);
    if (this.name().trim() === '' && meal.name.trim() !== '') {
      this.name.set(meal.name.trim().slice(0, NAME_MAX));
    }
    this.pristine.set(false);
    this.loadDetails(added);
    if (left > 0) {
      this.toast.info(`${left} ${left === 1 ? 'food' : 'foods'} you added by hand could not come over, because a recipe needs foods from the catalogue.`);
    }
    if (added.some((row) => row.grams === null)) {
      this.toast.info('Some foods were logged in servings, so they need an amount in grams.');
    }
  }

  /** A library recipe chosen as the start: it is copied to the person's own recipes and opened to change. */
  protected startFromCopy(card: RecipeCard): void {
    if (this.copying()) {
      return;
    }
    this.copying.set(true);
    this.service.copy(card.id).subscribe({
      next: (copy) => {
        this.copying.set(false);
        this.toast.success('Copied. This one is yours to edit.');
        void this.router.navigate(['/nutrition/recipes', copy.id, 'edit']);
      },
      error: () => {
        this.copying.set(false);
        this.toast.error('Unable to copy that recipe. Please retry.');
      }
    });
  }

  protected addStep(): void {
    this.steps.update((steps) => [...steps, '']);
    this.pristine.set(false);
  }

  protected setStep(index: number, text: string): void {
    this.steps.update((steps) => steps.map((step, position) => (position === index ? text : step)));
    this.pristine.set(false);
  }

  protected removeStep(index: number): void {
    this.steps.update((steps) => (steps.length > 1 ? steps.filter((_, position) => position !== index) : ['']));
    this.pristine.set(false);
  }

  protected moveStep(from: number, to: number): void {
    this.steps.update((steps) => moveItem(steps, from, to));
    this.pristine.set(false);
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
