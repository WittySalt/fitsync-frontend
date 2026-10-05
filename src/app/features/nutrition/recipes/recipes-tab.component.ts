import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';

import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { CookContinueComponent } from '../cook/cook-continue.component';
import { CookTonightComponent } from './cook-tonight.component';
import { CookedRecentlyComponent } from './cooked-recently.component';
import { MyRecipesComponent } from './my-recipes.component';
import { RecipeListComponent } from './recipe-list.component';
import { SavedMealsComponent } from './saved-meals.component';

/** What the page opens on: the one scroll, the whole list of the person's own recipes, or the saved meals. */
export type RecipeSection = 'library' | 'mine' | 'saved';

/**
 * The Recipes tab of the Nutrition page, as one scroll: Cook for tonight, Cooked recently, My
 * recipes and the Library. "See all" on My recipes opens the whole list of the person's own recipes
 * with a way back. Saved meals are no longer listed here; they open only from a meal's Add menu in
 * the Diary ("From saved meals"), which brings the meal type with it. When the person came from a
 * meal's Add menu, a line says which meal they are picking for and the choice is carried on to the
 * recipe page.
 */
@Component({
  selector: 'app-recipes-tab',
  imports: [CookContinueComponent, CookTonightComponent, CookedRecentlyComponent, MyRecipesComponent, RecipeListComponent, SavedMealsComponent],
  template: `
    <app-cook-continue />
    @if (slotLabel(); as label) {
      <div class="context" role="status">
        <span>Log to <strong>{{ label }}</strong>. Open a recipe, or log a saved meal.</span>
        <button type="button" (click)="cancelLog.emit()">Cancel</button>
      </div>
    }
    @switch (current()) {
      @case ('library') {
        <app-cook-tonight />
        <app-cooked-recently />
        <app-my-recipes (seeAll)="current.set('mine')" />
        <section class="library" aria-labelledby="library-title">
          <h2 id="library-title">Library</h2>
          <app-recipe-list scope="library" [logTo]="logTo()" />
        </section>
      }
      @case ('mine') {
        <div class="back-row">
          <button type="button" class="back" (click)="current.set('library')">Back to Recipes</button>
          <h2>My recipes</h2>
        </div>
        <app-recipe-list scope="mine" [logTo]="logTo()" />
      }
      @case ('saved') {
        <div class="back-row">
          <button type="button" class="back" (click)="current.set('library')">Back to Recipes</button>
          <h2>Saved meals</h2>
        </div>
        <app-saved-meals [logTo]="logTo()" />
      }
    }
  `,
  styleUrl: './recipes-tab.component.scss'
})
export class RecipesTabComponent {
  /** The view to open on. */
  readonly section = input<RecipeSection>('library');
  /** The meal type the person is picking for, from a meal's Add menu. */
  readonly logTo = input<string | null>(null);
  readonly cancelLog = output<void>();

  protected readonly current = signal<RecipeSection>('library');
  protected readonly slotLabel = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.logTo())?.label ?? null);

  constructor() {
    effect(() => {
      const section = this.section();
      untracked(() => this.current.set(section));
    });
  }
}
