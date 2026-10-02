import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RecipeCoverComponent } from './recipe-cover.component';
import { RecipeCard } from './recipes.models';

/** "More like this": up to three recipes of the same category, each with its cover, name and what a serving gives. */
@Component({
  selector: 'app-similar-recipes',
  imports: [RecipeCoverComponent, RouterLink],
  template: `
    @if (cards().length) {
      <div class="head">
        <h3>More like this</h3>
        @if (category()) {
          <span>also {{ category() }}</span>
        }
      </div>
      <div class="list">
        @for (card of cards(); track card.id) {
          <a [routerLink]="['/nutrition/recipes', card.id]">
            <app-recipe-cover [imageUrl]="card.imageUrl" [groups]="card.topFoodGroups" ratio="16 / 9" [radius]="14" [glyph]="18" />
            <strong>{{ card.name }}</strong>
            <span>{{ kcal(card) }} kcal · {{ protein(card) }} g protein</span>
          </a>
        }
      </div>
    }
  `,
  styleUrl: './similar-recipes.component.scss'
})
export class SimilarRecipesComponent {
  readonly cards = input.required<readonly RecipeCard[]>();
  readonly category = input<string | null>(null);

  protected kcal(card: RecipeCard): number {
    return Math.round(card.kcalPerServing);
  }

  protected protein(card: RecipeCard): number {
    return Math.round(card.proteinGramsPerServing);
  }
}
