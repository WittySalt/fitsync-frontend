import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { RecipeListComponent } from './recipe-list.component';
import { SavedMealsComponent } from './saved-meals.component';

export type RecipeSection = 'library' | 'mine' | 'saved';

const SECTIONS: readonly { key: RecipeSection; label: string }[] = [
  { key: 'library', label: 'Library' },
  { key: 'mine', label: 'My recipes' },
  { key: 'saved', label: 'Saved meals' }
];

/**
 * The Recipes tab of the Nutrition page: the library, the person's own recipes and their saved
 * meals, with a button to write a new recipe. When the person came from a meal's Add menu, a line
 * says which meal they are picking for and the choice is carried on to the recipe page.
 */
@Component({
  selector: 'app-recipes-tab',
  imports: [FoodGlyphComponent, RecipeListComponent, RouterLink, SavedMealsComponent],
  template: `
    <div class="head">
      <div class="segmented" role="tablist" aria-label="Recipes">
        @for (entry of sections; track entry.key) {
          <button
            type="button"
            role="tab"
            [class.active]="current() === entry.key"
            [attr.aria-selected]="current() === entry.key"
            (click)="current.set(entry.key)"
          >
            {{ entry.label }}
          </button>
        }
      </div>
      <a class="button secondary new" routerLink="/nutrition/recipes/new">
        <app-food-glyph name="PLUS" [size]="14" [strokeWidth]="2.6" />New recipe
      </a>
    </div>
    @if (slotLabel(); as label) {
      <div class="context" role="status">
        <span>Picking for <strong>{{ label }}</strong>. Open a recipe, or log a saved meal.</span>
        <button type="button" (click)="cancelLog.emit()">Cancel</button>
      </div>
    }
    @switch (current()) {
      @case ('library') {
        <app-recipe-list scope="library" [logTo]="logTo()" />
      }
      @case ('mine') {
        <app-recipe-list scope="mine" [logTo]="logTo()" />
      }
      @case ('saved') {
        <app-saved-meals [logTo]="logTo()" />
      }
    }
  `,
  styleUrl: './recipes-tab.component.scss'
})
export class RecipesTabComponent {
  /** The section to open on. */
  readonly section = input<RecipeSection>('library');
  /** The meal type the person is picking for, from a meal's Add menu. */
  readonly logTo = input<string | null>(null);
  readonly cancelLog = output<void>();

  protected readonly sections = SECTIONS;
  protected readonly current = signal<RecipeSection>('library');
  protected readonly slotLabel = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.logTo())?.label ?? null);

  constructor() {
    effect(() => {
      const section = this.section();
      untracked(() => this.current.set(section));
    });
  }
}
