import { Component, computed, input } from '@angular/core';

import { RecipeCoverComponent } from './recipe-cover.component';
import { cardTags, heading, topGroupsOf } from './recipes-figures';
import { RecipeDetail } from './recipes.models';

/** The top of a recipe page: the photo across the width with a dark gradient, and the category, name and tags over it. */
@Component({
  selector: 'app-recipe-hero',
  imports: [RecipeCoverComponent],
  template: `
    <app-recipe-cover class="photo" [imageUrl]="recipe().imageUrl" [groups]="groups()" [credit]="true" [creditTop]="true" ratio="21 / 9" [glyph]="40" />
    <div class="shade"></div>
    <div class="text">
      <span class="eyebrow">{{ eyebrow() }}</span>
      <h2>{{ recipe().name }}</h2>
      @if (tags().length) {
        <div class="tags">
          @for (tag of tags(); track tag) {
            <span>{{ tag }}</span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './recipe-hero.component.scss'
})
export class RecipeHeroComponent {
  readonly recipe = input.required<RecipeDetail>();

  protected readonly groups = computed(() => topGroupsOf(this.recipe()));
  protected readonly eyebrow = computed(() => heading(this.recipe()));
  protected readonly tags = computed(() => cardTags(this.recipe()));
}
