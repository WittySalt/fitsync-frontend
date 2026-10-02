import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, of, reduce, shareReplay } from 'rxjs';

import { DiaryMeal } from '../diary/diary.models';
import { mapDiaryMeal } from '../diary/diary-mappers';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { mapRecipeDetail, mapRecipePage, mapSavedMeal } from './recipes-mappers';
import { RecipeCard, RecipeDetail, RecipeDraft, RecipePageOf, RecipeQuery, SavedMeal } from './recipes.models';

type Wire = Record<string, unknown>;

/** The most characters the server takes in a search, kept on both sides. */
export const MAX_SEARCH_LENGTH = 80;
const WALK_PAGE_SIZE = 50;
const WALK_PAGE_LIMIT = 12;

export interface LogRecipeRequest {
  servings: number;
  mealType: string;
  consumedAt: Date;
}

/**
 * The calls behind Recipes (API contract, section 7). Reads let a failure through so each view can
 * show its own retry; nothing here falls back to made-up data.
 */
@Injectable({ providedIn: 'root' })
export class RecipesService {
  private readonly http = inject(HttpClient);
  private readonly diary = inject(NutritionDiaryService);
  private readonly base = '/api/v1/nutrition';

  private categoriesOnce: Observable<string[]> | null = null;
  private readonly lookups = new Map<string, Observable<RecipeDetail | null>>();

  list(query: RecipeQuery): Observable<RecipePageOf<RecipeCard>> {
    let params = new HttpParams().set('scope', query.scope).set('page', String(query.page ?? 0)).set('size', String(query.size ?? 20));
    const text = (query.q ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    if (text) {
      params = params.set('q', text);
    }
    if (query.category) {
      params = params.set('category', query.category);
    }
    if (query.diet) {
      params = params.set('diet', query.diet);
    }
    if (query.tag) {
      params = params.set('tag', query.tag);
    }
    if (query.sort) {
      params = params.set('sort', query.sort);
    }
    return this.http.get<Wire>(`${this.base}/recipes`, { params }).pipe(map((page) => mapRecipePage(page ?? {})));
  }

  /** Every card of a query, from walking its pages (50 at a time, at most 12 pages). */
  listAll(query: Omit<RecipeQuery, 'page' | 'size'>): Observable<RecipeCard[]> {
    return this.list({ ...query, size: WALK_PAGE_SIZE }).pipe(
      expand((page, index) =>
        page.page + 1 < page.totalPages && index + 1 < WALK_PAGE_LIMIT ? this.list({ ...query, size: WALK_PAGE_SIZE, page: page.page + 1 }) : EMPTY
      ),
      reduce((cards, page) => cards.concat(page.items), [] as RecipeCard[])
    );
  }

  /** The categories the library holds, from walking its pages once. A failure gives none, so the chips just stay at All. */
  categories(): Observable<string[]> {
    this.categoriesOnce ??= this.listAll({ scope: 'library' }).pipe(
      map((cards) => [...new Set(cards.map((card) => card.category).filter((name): name is string => !!name))].sort((a, b) => a.localeCompare(b))),
      catchError(() => of([] as string[])),
      shareReplay(1)
    );
    return this.categoriesOnce;
  }

  get(id: string): Observable<RecipeDetail> {
    return this.http.get<Wire>(`${this.base}/recipes/${encodeURIComponent(id)}`).pipe(map(mapRecipeDetail));
  }

  /** A recipe for a Diary row or a saved meal: remembered, and null when it cannot be read, so a row never fails for it. */
  lookup(id: string): Observable<RecipeDetail | null> {
    let found = this.lookups.get(id);
    if (!found) {
      found = this.get(id).pipe(
        catchError(() => of(null)),
        shareReplay(1)
      );
      this.lookups.set(id, found);
    }
    return found;
  }

  /** Forgets what lookup remembered, after a recipe was changed or deleted. */
  forget(id: string): void {
    this.lookups.delete(id);
  }

  /** Three recipes of the same category from the library, without this one. */
  similar(category: string | null, excludeId: string, count = 3): Observable<RecipeCard[]> {
    if (!category) {
      return of([]);
    }
    return this.list({ scope: 'library', category, size: count + 1 }).pipe(
      map((page) => page.items.filter((card) => card.id !== excludeId).slice(0, count))
    );
  }

  create(draft: RecipeDraft): Observable<string> {
    return this.http.post<Wire>(`${this.base}/recipes`, this.body(draft)).pipe(map((view) => String(view?.['recipeId'] ?? '')));
  }

  update(id: string, draft: RecipeDraft): Observable<string> {
    return this.http.put<Wire>(`${this.base}/recipes/${encodeURIComponent(id)}`, this.body(draft)).pipe(
      map((view) => {
        this.forget(id);
        return String(view?.['recipeId'] ?? id);
      })
    );
  }

  /** A soft delete on the server: the recipe leaves every read and meals logged from it keep their foods. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recipes/${encodeURIComponent(id)}`).pipe(
      map(() => {
        this.forget(id);
      })
    );
  }

  setFavorite(id: string, on: boolean): Observable<void> {
    const url = `${this.base}/recipes/${encodeURIComponent(id)}/favorite`;
    return (on ? this.http.post<void>(url, {}) : this.http.delete<void>(url)).pipe(map(() => undefined));
  }

  copy(id: string): Observable<RecipeDetail> {
    return this.http.post<Wire>(`${this.base}/recipes/${encodeURIComponent(id)}/copy`, {}).pipe(map(mapRecipeDetail));
  }

  logRecipe(id: string, request: LogRecipeRequest): Observable<{ mealId: string }> {
    return this.http
      .post<Wire>(`${this.base}/meals/from-recipe/${encodeURIComponent(id)}`, {
        servings: request.servings,
        mealType: request.mealType,
        consumedAt: request.consumedAt.toISOString(),
        timezone: this.diary.timezone
      })
      .pipe(map((meal) => ({ mealId: typeof meal?.['mealId'] === 'string' ? meal['mealId'] : '' })));
  }

  /** The meals logged in the last days (today included), newest first, with their foods, to start a recipe from one. */
  recentMeals(days = 14): Observable<DiaryMeal[]> {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);
    const params = new HttpParams().set('from', from.toISOString()).set('to', new Date().toISOString()).set('timezone', this.diary.timezone);
    return this.http.get<Wire[]>(`${this.base}/meals`, { params }).pipe(
      map((meals) =>
        (meals ?? [])
          .map(mapDiaryMeal)
          .filter((meal) => meal.items.length > 0)
          .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt))
      )
    );
  }

  // ---- saved meals

  savedMeals(): Observable<SavedMeal[]> {
    return this.http.get<Wire[]>(`${this.base}/meal-templates`).pipe(map((templates) => (templates ?? []).map(mapSavedMeal)));
  }

  /** Logs a saved meal now, under the meal type given or the one it was saved with. */
  logSavedMeal(templateId: string, mealType: string | null): Observable<{ mealId: string }> {
    return this.http
      .post<Wire>(`${this.base}/meals/from-template/${encodeURIComponent(templateId)}`, {
        consumedAt: new Date().toISOString(),
        ...(mealType ? { mealType } : {}),
        timezone: this.diary.timezone
      })
      .pipe(map((meal) => ({ mealId: typeof meal?.['mealId'] === 'string' ? meal['mealId'] : '' })));
  }

  /** A new saved meal made of one recipe. */
  createSavedMealWithRecipe(name: string, mealType: string, recipeId: string, servings: number): Observable<void> {
    return this.http
      .post(`${this.base}/meal-templates`, { name, mealType, recipeItems: [{ recipeId, servings }] })
      .pipe(map(() => undefined));
  }

  /** Appends a recipe to a saved meal that exists; the server adds it and returns the meal. */
  addRecipeToSavedMeal(templateId: string, recipeId: string, servings: number): Observable<void> {
    return this.http
      .post(`${this.base}/meal-templates/${encodeURIComponent(templateId)}/recipe-items`, { recipeId, servings })
      .pipe(map(() => undefined));
  }

  private body(draft: RecipeDraft): Wire {
    return {
      name: draft.name.trim(),
      servings: draft.servings,
      ingredients: draft.ingredients.map((row) => ({
        foodCatalogItemId: row.foodCatalogItemId,
        quantity: 1,
        grams: row.grams,
        displayText: row.displayText.slice(0, 200)
      })),
      steps: draft.steps.map((text) => text.trim()).filter(Boolean).map((text) => ({ text: text.slice(0, 1000) }))
    };
  }
}
