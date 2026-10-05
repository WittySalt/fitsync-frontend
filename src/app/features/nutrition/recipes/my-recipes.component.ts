import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { LOADING, Load } from '../diary/diary.models';
import { RecipeCardComponent } from './recipe-card.component';
import { RecipeReadyComponent } from './recipe-ready.component';
import { RecipePageOf, RecipeCard } from './recipes.models';
import { RecipesService } from './recipes.service';

/** How many of the person's own recipes the Recipes page shows before "See all". */
export const MY_RECIPES_SHOWN = 4;
export const MY_RECIPES_EMPTY = 'No recipes of your own yet. Write one down, or open a library recipe and tap Make it mine.';

/**
 * "My recipes" on the Recipes page: the heading with "See all (n)" and the New recipe button, then
 * up to four cook cards in two columns. A failure leaves one quiet line; the rest of the page stays.
 */
@Component({
  selector: 'app-my-recipes',
  imports: [FoodGlyphComponent, RecipeCardComponent, RecipeReadyComponent, RouterLink],
  template: `
    <section aria-labelledby="my-recipes-title">
      <div class="head">
        <h2 id="my-recipes-title">My recipes</h2>
        @let s = state();
        @if (s.status === 'ready' && s.data.totalElements > shown) {
          <button type="button" class="see-all" (click)="seeAll.emit()">See all ({{ s.data.totalElements }})</button>
        }
        <a class="button secondary new" routerLink="/nutrition/recipes/new">
          <app-food-glyph name="PLUS" [size]="14" [strokeWidth]="2.6" />New recipe
        </a>
      </div>
      @let t = state();
      @if (t.status === 'loading') {
        <div class="grid" aria-busy="true">
          @for (n of skeletons; track n) {
            <div class="skeleton card-skeleton"></div>
          }
        </div>
      } @else if (t.status === 'error') {
        <p class="quiet" role="status">Your recipes could not load right now.</p>
      } @else if (t.data.items.length === 0) {
        <p class="quiet">{{ empty }}</p>
      } @else {
        <div class="grid">
          @for (card of t.data.items; track card.id) {
            <app-recipe-card [card]="card" [heart]="false" (cook)="readyFor.set($event)" />
          }
        </div>
      }
    </section>
    @if (readyFor(); as chosen) {
      <app-recipe-ready [recipeId]="chosen.id" (closed)="readyFor.set(null)" />
    }
  `,
  styleUrl: './my-recipes.component.scss'
})
export class MyRecipesComponent {
  private readonly service = inject(RecipesService);

  /** The person asked for the whole list of their own recipes. */
  readonly seeAll = output<void>();

  protected readonly shown = MY_RECIPES_SHOWN;
  protected readonly empty = MY_RECIPES_EMPTY;
  protected readonly skeletons = [0, 1];
  protected readonly state = signal<Load<RecipePageOf<RecipeCard>>>(LOADING);
  protected readonly readyFor = signal<RecipeCard | null>(null);

  constructor() {
    this.service
      .list({ scope: 'mine', size: MY_RECIPES_SHOWN })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (data) => this.state.set({ status: 'ready', data }),
        error: () => this.state.set({ status: 'error', message: 'Your recipes could not load right now.' })
      });
  }
}
