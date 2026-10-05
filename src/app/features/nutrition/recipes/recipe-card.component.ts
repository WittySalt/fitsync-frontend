import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { RecipeCoverComponent } from './recipe-cover.component';
import { cardTags, heading, isCaution } from './recipes-figures';
import { RecipeCard } from './recipes.models';

/** One recipe of the library or of My recipes: its cover, name, what a serving gives, tags and a heart to save it. */
@Component({
  selector: 'app-recipe-card',
  imports: [FoodGlyphComponent, RouterLink, RecipeCoverComponent],
  template: `
    <div class="media">
      <a class="cover" [routerLink]="['/nutrition/recipes', card().id]" [queryParams]="query()" tabindex="-1" aria-hidden="true">
        <app-recipe-cover [imageUrl]="card().imageUrl" [groups]="card().topFoodGroups" ratio="16 / 9" />
      </a>
      @if (cookable()) {
        <button class="cook" type="button" [attr.aria-label]="'Cook ' + card().name" (click)="cook.emit(card())">
          <app-food-glyph name="PLAY" [size]="13" [strokeWidth]="2.4" />Cook
        </button>
      }
    </div>
    <div class="body">
      <div class="top">
        <a class="name" [routerLink]="['/nutrition/recipes', card().id]" [queryParams]="query()">
          <strong>{{ card().name }}</strong>
          <span>{{ sub() }}</span>
        </a>
        @if (heart()) {
          <button
            class="heart"
            type="button"
            [class.on]="card().favorite"
            [attr.aria-pressed]="card().favorite"
            [attr.aria-label]="(card().favorite ? 'Remove ' : 'Save ') + card().name + (card().favorite ? ' from saved' : '')"
            (click)="favourite.emit(card())"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
            </svg>
          </button>
        }
      </div>
      <span class="figures">
        <strong>{{ kcal() }}</strong> kcal · <strong>{{ protein() }} g</strong> protein <span class="a-serving">a serving</span>
      </span>
      @if (tags().length) {
        <div class="tags">
          @for (tag of tags(); track tag) {
            <span [class.grey]="grey(tag)">{{ tag }}</span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './recipe-card.component.scss'
})
export class RecipeCardComponent {
  readonly card = input.required<RecipeCard>();
  /** The meal a recipe is being picked for, carried to the recipe page. */
  readonly logTo = input<string | null>(null);
  /** The heart saves library recipes only. */
  readonly heart = input(true);
  /** A Cook button on the cover opens the Ready screen; left out where a card should only open the recipe. */
  readonly cookable = input(true);
  readonly favourite = output<RecipeCard>();
  readonly cook = output<RecipeCard>();

  protected readonly grey = isCaution;
  protected readonly query = computed(() => (this.logTo() ? { logTo: this.logTo() } : null));
  protected readonly sub = computed(() => heading(this.card()));
  protected readonly tags = computed(() => cardTags(this.card()));
  protected readonly kcal = computed(() => Math.round(this.card().kcalPerServing));
  protected readonly protein = computed(() => Math.round(this.card().proteinGramsPerServing));
}
