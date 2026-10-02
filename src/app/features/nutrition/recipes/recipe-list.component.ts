import { Component, Injector, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { PagerComponent } from '../../../shared/pager.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { LOADING, Load } from '../diary/diary.models';
import { RecipeCardComponent } from './recipe-card.component';
import { RecipeCard, RecipePageOf, RecipeScope } from './recipes.models';
import { LibrarySnapshot, RecipesLibraryState } from './recipes-library-state.service';
import { MAX_SEARCH_LENGTH, RecipesService } from './recipes.service';

export const LIST_PAGE_SIZE = 18;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETONS = [0, 1, 2, 3, 4, 5];

type Diet = 'VEGETARIAN' | 'VEGAN';

const DIET_CATEGORIES: ReadonlySet<string> = new Set(['vegan', 'vegetarian']);

interface ListRequest {
  q: string;
  category: string | null;
  diet: Diet | null;
  saved: boolean;
  highProtein: boolean;
  page: number;
  nonce: number;
}

/**
 * The library and My recipes as a grid of cards: a search that waits for a pause in typing, category
 * and filter chips for the library, paging, and a skeleton, an empty state and an error of its own.
 * The server filters and pages by name, category, diet, saved and the High protein tag.
 */
@Component({
  selector: 'app-recipe-list',
  imports: [FoodGlyphComponent, PagerComponent, RecipeCardComponent, RouterLink, StatePanelComponent],
  template: `
    <label class="search">
      <app-food-glyph name="SEARCH" [size]="18" [strokeWidth]="2" />
      <input
        type="search"
        [attr.aria-label]="isLibrary() ? 'Search recipes' : 'Search your recipes'"
        [placeholder]="isLibrary() ? 'Search recipes' : 'Search your recipes'"
        [attr.maxlength]="maxLength"
        [value]="draft()"
        (input)="onSearch($event)"
      />
    </label>
    @if (isLibrary()) {
      <div class="chips" role="group" aria-label="Category">
        <button type="button" [class.on]="category() === null" [attr.aria-pressed]="category() === null" (click)="chooseCategory(null)">All</button>
        @for (name of shownCategories(); track name) {
          <button type="button" [class.on]="category() === name" [attr.aria-pressed]="category() === name" (click)="chooseCategory(name)">{{ name }}</button>
        }
      </div>
      <div class="chips" role="group" aria-label="Show">
        <span class="label">Show</span>
        <button type="button" [class.on]="highProtein()" [attr.aria-pressed]="highProtein()" (click)="toggleHighProtein()">High protein</button>
        <button type="button" [class.on]="diet() === 'VEGETARIAN'" [attr.aria-pressed]="diet() === 'VEGETARIAN'" (click)="toggleDiet('VEGETARIAN')">Vegetarian</button>
        <button type="button" [class.on]="diet() === 'VEGAN'" [attr.aria-pressed]="diet() === 'VEGAN'" (click)="toggleDiet('VEGAN')">Vegan</button>
        <button type="button" [class.on]="saved()" [attr.aria-pressed]="saved()" (click)="toggleSaved()">Saved</button>
      </div>
    }
    @let s = state();
    @if (s.status === 'loading') {
      <div class="grid" aria-busy="true">
        @for (n of skeletons; track n) {
          <div class="skeleton card-skeleton"></div>
        }
      </div>
    } @else if (s.status === 'error') {
      <app-state-panel title="Recipes unavailable" [message]="s.message" actionLabel="Retry" [error]="true" (action)="retry()" />
    } @else if (s.data.items.length === 0) {
      <div class="empty">
        <strong>{{ emptyTitle() }}</strong>
        <p>{{ emptyMessage() }}</p>
        @if (isLibrary() && filtered()) {
          <button class="button secondary" type="button" (click)="clearFilters()">Clear filters</button>
        } @else if (!isLibrary() && !q()) {
          <a class="button primary" routerLink="/nutrition/recipes/new">New recipe</a>
        }
      </div>
    } @else {
      <span class="count">{{ countLine() }}</span>
      <div class="grid">
        @for (card of s.data.items; track card.id) {
          <app-recipe-card [card]="card" [logTo]="logTo()" [heart]="isLibrary()" (favourite)="toggleFavorite($event)" />
        }
      </div>
      <app-pager
        [page]="s.data.page"
        [totalPages]="s.data.totalPages"
        [total]="s.data.totalElements"
        unit="recipes"
        label="Recipe pages"
        [pageSize]="pageSize"
        (pageChange)="goTo($event)"
      />
    }
  `,
  styleUrl: './recipe-list.component.scss',
  host: { '[class.mine]': '!isLibrary()' }
})
export class RecipeListComponent {
  private readonly service = inject(RecipesService);
  private readonly toast = inject(ToastService);
  private readonly place = inject(RecipesLibraryState);
  private readonly injector = inject(Injector);
  private first = true;
  // Where to scroll to once the list a person came back to has its cards.
  private pendingScroll = 0;

  readonly scope = input<Extract<RecipeScope, 'library' | 'mine'>>('library');
  /** The meal recipes are being picked for, carried to each recipe page. */
  readonly logTo = input<string | null>(null);

  protected readonly maxLength = MAX_SEARCH_LENGTH;
  protected readonly pageSize = LIST_PAGE_SIZE;
  protected readonly skeletons = SKELETONS;

  protected readonly draft = signal('');
  protected readonly q = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly diet = signal<Diet | null>(null);
  protected readonly saved = signal(false);
  protected readonly highProtein = signal(false);
  protected readonly page = signal(0);
  protected readonly categories = signal<string[]>([]);
  /** The diet chips already cover Vegan and Vegetarian, so those two are left out of the categories. */
  protected readonly shownCategories = computed(() => this.categories().filter((name) => !DIET_CATEGORIES.has(name.toLowerCase())));
  protected readonly state = signal<Load<RecipePageOf<RecipeCard>>>(LOADING);

  protected readonly isLibrary = computed(() => this.scope() === 'library');
  protected readonly filtered = computed(() => !!this.q() || this.category() !== null || this.diet() !== null || this.saved() || this.highProtein());

  private readonly nonce = signal(0);
  private readonly typing = new Subject<string>();
  private readonly request = computed<ListRequest>(() => ({
    q: this.q(),
    category: this.isLibrary() ? this.category() : null,
    diet: this.isLibrary() ? this.diet() : null,
    saved: this.isLibrary() && this.saved(),
    highProtein: this.isLibrary() && this.highProtein(),
    page: this.page(),
    nonce: this.nonce()
  }));

  constructor() {
    this.typing
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((text) => {
        this.q.set(text);
        this.page.set(0);
      });
    toObservable(this.request)
      .pipe(
        tap(() => this.state.set(LOADING)),
        switchMap((request) =>
          this.fetch(request).pipe(
            map((data): Load<RecipePageOf<RecipeCard>> => ({ status: 'ready', data })),
            catchError(() => of<Load<RecipePageOf<RecipeCard>>>({ status: 'error', message: 'The recipes could not load. Please retry.' }))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => {
        this.state.set(state);
        if (state.status === 'ready' && this.pendingScroll > 0) {
          const top = this.pendingScroll;
          this.pendingScroll = 0;
          afterNextRender(() => window.scrollTo(0, top), { injector: this.injector });
        }
      });
    // The first list of a visit takes up where the person left it, when they come back from a recipe.
    // Switching between the library and My recipes starts that list from its first page.
    effect(() => {
      const scope = this.scope();
      untracked(() => {
        const back = this.first ? this.place.take(scope) : null;
        this.first = false;
        if (back) {
          this.restore(back);
        } else {
          this.resetAll();
        }
      });
    });
    effect(() => {
      const request = this.request();
      const scope = this.scope();
      untracked(() =>
        this.place.keep({ scope, q: request.q, category: request.category, diet: request.diet, saved: request.saved, highProtein: request.highProtein, page: request.page })
      );
    });
    this.service
      .categories()
      .pipe(takeUntilDestroyed())
      .subscribe((names) => this.categories.set(names));
  }

  private fetch(request: ListRequest): Observable<RecipePageOf<RecipeCard>> {
    const scope: RecipeScope = !this.isLibrary() ? 'mine' : request.saved ? 'favorites' : 'library';
    const base = { scope, q: request.q, category: request.category ?? undefined, diet: request.diet ?? undefined };
    return this.service.list({ ...base, tag: request.highProtein ? 'HIGH_PROTEIN' : undefined, page: request.page, size: LIST_PAGE_SIZE });
  }

  protected onSearch(event: Event): void {
    const text = (event.target as HTMLInputElement).value.slice(0, MAX_SEARCH_LENGTH);
    this.draft.set(text);
    this.typing.next(text.trim());
  }

  protected chooseCategory(name: string | null): void {
    this.category.set(name);
    this.page.set(0);
  }

  protected toggleDiet(diet: Diet): void {
    this.diet.update((current) => (current === diet ? null : diet));
    this.page.set(0);
  }

  protected toggleSaved(): void {
    this.saved.update((on) => !on);
    this.page.set(0);
  }

  protected toggleHighProtein(): void {
    this.highProtein.update((on) => !on);
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.resetAll();
  }

  protected goTo(page: number): void {
    this.page.set(page);
  }

  protected retry(): void {
    this.nonce.update((value) => value + 1);
  }

  protected countLine(): string {
    const state = this.state();
    const total = state.status === 'ready' ? state.data.totalElements : 0;
    const noun = total === 1 ? 'recipe' : 'recipes';
    return this.isLibrary() ? `${total} ${noun} · from TheMealDB, with nutrition from USDA` : `${total} of your ${noun}`;
  }

  protected emptyTitle(): string {
    if (!this.isLibrary()) {
      return this.q() ? 'No recipes match' : 'No recipes of your own yet';
    }
    return this.saved() && !this.q() && this.category() === null && this.diet() === null && !this.highProtein() ? 'No saved recipes yet' : 'No recipes match';
  }

  protected emptyMessage(): string {
    if (!this.isLibrary()) {
      return this.q() ? 'Try another name.' : 'Write one down, or open a library recipe and tap Make it mine.';
    }
    return this.emptyTitle() === 'No saved recipes yet' ? 'Tap the heart on a recipe to keep it here.' : 'Try another word, or take a filter off.';
  }

  /** Flips the heart at once and puts it back if the server says no. */
  protected toggleFavorite(card: RecipeCard): void {
    const on = !card.favorite;
    this.patch(card.id, on);
    this.service.setFavorite(card.id, on).subscribe({
      error: () => {
        this.patch(card.id, !on);
        this.toast.error('Unable to update that recipe. Please retry.');
      }
    });
  }

  private patch(id: string, favorite: boolean): void {
    this.state.update((state) =>
      state.status === 'ready' ? { status: 'ready', data: { ...state.data, items: state.data.items.map((card) => (card.id === id ? { ...card, favorite } : card)) } } : state
    );
  }

  private restore(back: LibrarySnapshot): void {
    this.draft.set(back.q);
    this.q.set(back.q);
    this.category.set(back.category);
    this.diet.set(back.diet);
    this.saved.set(back.saved);
    this.highProtein.set(back.highProtein);
    this.page.set(back.page);
    this.pendingScroll = back.scrollY;
  }

  private resetAll(): void {
    this.draft.set('');
    this.q.set('');
    this.category.set(null);
    this.diet.set(null);
    this.saved.set(false);
    this.highProtein.set(false);
    this.page.set(0);
  }
}
