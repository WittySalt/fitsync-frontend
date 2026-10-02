import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { DiarySummary, LOADING, Load, NutrientSummary } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { mealTypeByClock, toIsoDate } from '../diary/diary-time';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { AddToSavedDialogComponent } from './add-to-saved-dialog.component';
import { EatCardComponent } from './eat-card.component';
import { IngredientsCardComponent } from './ingredients-card.component';
import { RecipeHeroComponent } from './recipe-hero.component';
import { RecipeStepsComponent } from './recipe-steps.component';
import { ServingHighlightsComponent } from './serving-highlights.component';
import { SimilarRecipesComponent } from './similar-recipes.component';
import { TodayFit, fatTargetOf, scaled, servingsLabel, todayFit } from './recipes-figures';
import { RecipeCard, RecipeDetail } from './recipes.models';
import { RecipesService } from './recipes.service';

const UNDO_MS = 6000;
const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

interface TodayData {
  summary: DiarySummary;
  nutrients: NutrientSummary | null;
}

/**
 * One recipe: a photo with the title over it, the facts, what the servings do to today with the
 * actions to log or cook it, a serving's nutrition, the ingredients to tick off, the steps and more
 * like this. On a phone the Cook and Log actions stay in a bar at the bottom.
 */
@Component({
  selector: 'app-recipe-page',
  imports: [
    AddToSavedDialogComponent,
    EatCardComponent,
    IngredientsCardComponent,
    RecipeHeroComponent,
    RecipeStepsComponent,
    RouterLink,
    ServingHighlightsComponent,
    SimilarRecipesComponent,
    StatePanelComponent
  ],
  template: `
    <div class="page-grid recipe-page">
      <a class="back" routerLink="/nutrition" [queryParams]="backQuery()">Recipes</a>
      @let s = recipe();
      @if (s.status === 'loading') {
        <div class="skeleton hero-skeleton" aria-busy="true"></div>
        <div class="skeleton tall"></div>
      } @else if (s.status === 'error') {
        <app-state-panel
          [title]="missing() ? 'Recipe not found' : 'Recipe unavailable'"
          [message]="s.message"
          [actionLabel]="missing() ? '' : 'Retry'"
          [error]="true"
          (action)="load()"
        />
      } @else {
        @let r = s.data;
        <app-recipe-hero [recipe]="r" />
        <div class="layout-box">
        <div class="layout">
          <div class="facts" aria-label="Facts">
            <div><strong>{{ r.servings }}</strong><span>servings</span></div>
            <div><strong>{{ r.ingredients.length }}</strong><span>ingredients</span></div>
            <div><strong>{{ r.steps.length }}</strong><span>steps</span></div>
            <div><strong>{{ kcal(r.perServing.kcal) }}</strong><span>kcal a serving</span></div>
          </div>
          <aside>
            <app-eat-card
              [recipe]="r"
              [fit]="fit()"
              [(servings)]="servings"
              [(mealType)]="mealType"
              [busy]="busy()"
              (log)="log(r)"
              (favourite)="toggleFavorite(r)"
              (makeMine)="copy(r)"
              (addToSaved)="savedOpen.set(true)"
            />
          </aside>
          <div class="main">
            <app-serving-highlights [perServing]="r.perServing" [tags]="r.tags" [fatTarget]="fatTarget()" [servingGrams]="servingGrams()" />
            <app-ingredients-card [recipeId]="r.id" [ingredients]="r.ingredients" [recipeServings]="r.servings" [servings]="servings()" />
            <app-recipe-steps [recipeId]="r.id" [steps]="r.steps" />
          </div>
        </div>
        </div>
        <app-similar-recipes [cards]="similar()" [category]="r.category" />
        <div class="bar">
          <a class="cook" [routerLink]="['/nutrition/recipes', r.id, 'cook']">Cook</a>
          <button class="log" type="button" [disabled]="busy()" (click)="log(r)">Log {{ servingsText() }} · {{ kcal(scaled(r.perServing.kcal, servings())) }} kcal</button>
        </div>
        @if (savedOpen()) {
          <app-add-to-saved-dialog [recipeId]="r.id" [recipeName]="r.name" [servings]="servings()" [mealType]="mealType()" (closed)="savedOpen.set(false)" />
        }
      }
    </div>
  `,
  styleUrl: './recipe.page.scss'
})
export class RecipePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(RecipesService);
  private readonly diary = inject(NutritionDiaryService);
  private readonly toast = inject(ToastService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), { initialValue: '' });
  private readonly logTo = this.mealTypeFromLink();
  private readonly today = toIsoDate(new Date());
  // A reload that starts while an older one is on its way makes the older answer stale.
  private generation = 0;

  protected readonly recipe = signal<Load<RecipeDetail>>(LOADING);
  protected readonly todayData = signal<Load<TodayData>>(LOADING);
  protected readonly similar = signal<RecipeCard[]>([]);
  protected readonly servings = signal(1);
  protected readonly mealType = signal(this.logTo ?? mealTypeByClock(new Date()));
  protected readonly busy = signal(false);
  protected readonly savedOpen = signal(false);

  /** True when the server said there is no such recipe, which a retry cannot fix. */
  protected readonly missing = signal(false);
  protected readonly fit = computed<Load<TodayFit>>(() => {
    const recipe = this.recipe();
    const day = this.todayData();
    if (recipe.status !== 'ready' || day.status === 'loading') {
      return LOADING;
    }
    if (day.status === 'error') {
      return day;
    }
    return { status: 'ready', data: todayFit(day.data.summary, day.data.nutrients, recipe.data.perServing, this.servings()) };
  });
  protected readonly fatTarget = computed(() => {
    const day = this.todayData();
    return day.status === 'ready' ? fatTargetOf(day.data.summary) : null;
  });
  /** The weight of one serving, when every ingredient has a weight. */
  protected readonly servingGrams = computed(() => {
    const recipe = this.recipe();
    if (recipe.status !== 'ready' || recipe.data.ingredients.length === 0) {
      return null;
    }
    const grams = recipe.data.ingredients.map((ingredient) => ingredient.grams);
    return grams.every((value): value is number => value !== null) ? grams.reduce((sum, value) => sum + value, 0) / recipe.data.servings : null;
  });
  protected readonly backQuery = computed(() => {
    const recipe = this.recipe();
    return {
      tab: 'recipes',
      ...(recipe.status === 'ready' && recipe.data.editable ? { section: 'mine' } : {}),
      ...(this.logTo ? { logTo: this.logTo } : {})
    };
  });
  protected readonly servingsText = computed(() => servingsLabel(this.servings()));
  protected readonly kcal = whole;
  protected readonly scaled = scaled;

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.servings.set(1);
        this.load();
      });
    });
    this.loadToday();
  }

  protected load(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.generation += 1;
    const expected = this.generation;
    this.recipe.set(LOADING);
    this.missing.set(false);
    this.similar.set([]);
    this.service.get(id).subscribe({
      next: (data) => {
        if (expected !== this.generation) {
          return;
        }
        this.recipe.set({ status: 'ready', data });
        this.service.similar(data.category, data.id).subscribe({
          next: (cards) => expected === this.generation && this.similar.set(cards),
          error: () => undefined
        });
      },
      error: (error: unknown) => {
        if (expected === this.generation) {
          const notFound = error instanceof HttpErrorResponse && error.status === 404;
          this.missing.set(notFound);
          this.recipe.set({
            status: 'error',
            message: notFound ? 'That recipe is not available. It may have been removed.' : 'The recipe could not load. Please retry.'
          });
        }
      }
    });
  }

  /** Today's calories, protein and vitamins, which the servings are measured against. */
  private loadToday(quiet = false): void {
    if (!quiet) {
      this.todayData.set(LOADING);
    }
    this.diary.getSummary(this.today).subscribe({
      next: (summary) => {
        this.diary.getNutrients(this.today, this.today).subscribe({
          next: (nutrients) => this.todayData.set({ status: 'ready', data: { summary, nutrients } }),
          // The vitamin line is a bonus: without it calories and protein still show.
          error: () => this.todayData.set({ status: 'ready', data: { summary, nutrients: null } })
        });
      },
      error: () => {
        if (!quiet) {
          this.todayData.set({ status: 'error', message: 'Today could not load, so the day is left out. Logging still works.' });
        }
      }
    });
  }

  protected log(recipe: RecipeDetail): void {
    if (this.busy()) {
      return;
    }
    const servings = this.servings();
    this.busy.set(true);
    this.service.logRecipe(recipe.id, { servings, mealType: this.mealType(), consumedAt: new Date() }).subscribe({
      next: ({ mealId }) => {
        this.busy.set(false);
        this.toast.success(`Logged ${servingsLabel(servings)} of ${recipe.name}.`, UNDO_MS, mealId ? { label: 'Undo', run: () => this.undo(mealId) } : undefined);
        this.loadToday(true);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to log that recipe. Please retry.');
      }
    });
  }

  private undo(mealId: string): void {
    this.diary.deleteMeal(mealId).subscribe({
      next: () => {
        this.toast.info('Removed.');
        this.loadToday(true);
      },
      error: () => this.toast.error('Unable to undo that. Please retry.')
    });
  }

  /** Flips the heart at once and puts it back if the server says no. */
  protected toggleFavorite(recipe: RecipeDetail): void {
    const on = !recipe.favorite;
    this.setFavorite(on);
    this.service.setFavorite(recipe.id, on).subscribe({
      error: () => {
        this.setFavorite(!on);
        this.toast.error('Unable to update that recipe. Please retry.');
      }
    });
  }

  private setFavorite(favorite: boolean): void {
    this.recipe.update((state) => (state.status === 'ready' ? { status: 'ready', data: { ...state.data, favorite } } : state));
  }

  protected copy(recipe: RecipeDetail): void {
    this.busy.set(true);
    this.service.copy(recipe.id).subscribe({
      next: (copy) => {
        this.busy.set(false);
        this.toast.success('Copied. This one is yours to edit.');
        void this.router.navigate(['/nutrition/recipes', copy.id]);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Unable to copy that recipe. Please retry.');
      }
    });
  }

  private mealTypeFromLink(): string | null {
    const value = (this.route.snapshot.queryParamMap.get('logTo') ?? '').toUpperCase();
    return MEAL_TYPES.includes(value) ? value : null;
  }
}
