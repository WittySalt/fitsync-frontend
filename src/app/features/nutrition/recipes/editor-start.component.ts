import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';

import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { DiaryMeal, LOADING, Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { RecipeCard } from './recipes.models';
import { MAX_SEARCH_LENGTH, RecipesService } from './recipes.service';

export type StartMode = 'scratch' | 'meal' | 'copy';

const DAYS = 14;
const COPY_RESULTS = 6;
const DEBOUNCE_MS = 300;

/** "Dinner · Tue 30 Sept", the way a meal of the last two weeks is named in the list. */
export function mealTitle(meal: Pick<DiaryMeal, 'mealType' | 'consumedAt'>): string {
  const slot = MEAL_SLOTS.find((entry) => entry.key === meal.mealType)?.label ?? 'Meal';
  const moment = new Date(meal.consumedAt);
  return Number.isNaN(moment.getTime()) ? slot : `${slot} · ${moment.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

/**
 * Three ways to start a new recipe: from scratch, from a meal logged in the last 14 days (its foods
 * and grams come over) or from a recipe in the library (copied to the person's own, to change).
 * Each way that needs a choice opens a short list with its own loading, empty and error states.
 */
@Component({
  selector: 'app-editor-start',
  template: `
    <div class="starts" role="group" aria-label="How to start">
      @for (way of ways; track way.mode) {
        <button type="button" [class.on]="mode() === way.mode" [attr.aria-pressed]="mode() === way.mode" [disabled]="busy()" (click)="choose(way.mode)">
          <strong>{{ way.title }}</strong>
          <span>{{ way.sub }}</span>
        </button>
      }
    </div>
    @if (mode() === 'meal') {
      <div class="pick" aria-label="Meals of the last 14 days">
        @let m = meals();
        @if (m.status === 'loading') {
          <p class="note" aria-busy="true">Looking for your meals</p>
        } @else if (m.status === 'error') {
          <p class="note" role="alert">{{ m.message }} <button type="button" class="link" (click)="loadMeals()">Retry</button></p>
        } @else if (m.data.length === 0) {
          <p class="note">No meals logged in the last 14 days. Start from scratch, or from a library recipe.</p>
        } @else {
          <ul>
            @for (meal of m.data; track meal.mealId) {
              <li>
                <button type="button" (click)="fromMeal.emit(meal)">
                  <strong>{{ title(meal) }}</strong>
                  <span>{{ meal.items.length }} {{ meal.items.length === 1 ? 'food' : 'foods' }} · {{ kcal(meal.totalCalories) }} kcal</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
    @if (mode() === 'copy') {
      <div class="pick" aria-label="Library recipes">
        <input type="search" aria-label="Search the library" placeholder="Search the library" autocomplete="off" [attr.maxlength]="max" [value]="text()" (input)="onSearch($event)" />
        @let r = recipes();
        @if (r.status === 'loading') {
          <p class="note" aria-busy="true">Searching</p>
        } @else if (r.status === 'error') {
          <p class="note" role="alert">{{ r.message }} <button type="button" class="link" (click)="searchAgain()">Retry</button></p>
        } @else if (r.data.length === 0) {
          <p class="note">No library recipes match that.</p>
        } @else {
          <ul>
            @for (card of r.data; track card.id) {
              <li>
                <button type="button" (click)="recipeChosen.emit(card)">
                  <strong>{{ card.name }}</strong>
                  <span>{{ card.category ?? 'Recipe' }} · {{ kcal(card.kcalPerServing) }} kcal a serving</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styleUrl: './editor-start.component.scss'
})
export class EditorStartComponent {
  private readonly service = inject(RecipesService);
  private readonly typing = new Subject<string>();

  /** True while the page is copying a recipe, so the starts wait. */
  readonly busy = input(false);
  readonly fromMeal = output<DiaryMeal>();
  readonly recipeChosen = output<RecipeCard>();

  protected readonly ways: readonly { mode: StartMode; title: string; sub: string }[] = [
    { mode: 'scratch', title: 'From scratch', sub: 'an empty recipe' },
    { mode: 'meal', title: 'From a meal', sub: 'one you logged' },
    { mode: 'copy', title: 'Copy a recipe', sub: 'from the library' }
  ];
  protected readonly max = MAX_SEARCH_LENGTH;
  protected readonly kcal = whole;
  protected readonly title = mealTitle;
  protected readonly mode = signal<StartMode>('scratch');
  protected readonly meals = signal<Load<DiaryMeal[]>>(LOADING);
  protected readonly recipes = signal<Load<RecipeCard[]>>(LOADING);
  protected readonly text = signal('');

  constructor() {
    this.typing
      .pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        tap(() => this.recipes.set(LOADING)),
        switchMap((query) =>
          this.service.list({ scope: 'library', q: query, size: COPY_RESULTS }).pipe(
            catchError(() => of(null))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((page) => this.recipes.set(page ? { status: 'ready', data: page.items } : { status: 'error', message: 'The library could not load.' }));
  }

  protected choose(mode: StartMode): void {
    this.mode.set(mode);
    if (mode === 'meal') {
      this.loadMeals();
    } else if (mode === 'copy') {
      this.searchAgain();
    }
  }

  protected loadMeals(): void {
    this.meals.set(LOADING);
    this.service.recentMeals(DAYS).subscribe({
      next: (data) => this.meals.set({ status: 'ready', data }),
      error: () => this.meals.set({ status: 'error', message: 'Your meals could not load.' })
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_SEARCH_LENGTH);
    this.text.set(value);
    this.typing.next(value.trim());
  }

  protected searchAgain(): void {
    this.recipes.set(LOADING);
    this.service.list({ scope: 'library', q: this.text().trim(), size: COPY_RESULTS }).subscribe({
      next: (page) => this.recipes.set({ status: 'ready', data: page.items }),
      error: () => this.recipes.set({ status: 'error', message: 'The library could not load.' })
    });
  }
}
