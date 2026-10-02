import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { RecipeCoverComponent } from '../recipes/recipe-cover.component';
import { servingsLabel, topGroupsOf } from '../recipes/recipes-figures';
import { RecipeDetail } from '../recipes/recipes.models';
import { RecipesService } from '../recipes/recipes.service';
import { DiaryRow, macroLine } from './diary-food';
import { FoodRowComponent } from './food-row.component';

/**
 * The foods of one recipe in a meal as one row: a small cover, the recipe's name, how many of its
 * servings were eaten and the macros, with the ingredients folded under Show ingredients. The name
 * and cover come from the recipe itself, so until they are read, or when the recipe can no longer
 * be read, the row says "Recipe" and shows a plain cover; it never fails for that.
 */
@Component({
  selector: 'app-recipe-row',
  imports: [FoodRowComponent, RecipeCoverComponent],
  template: `
    <div class="line">
      <app-recipe-cover [imageUrl]="recipe()?.imageUrl ?? null" [groups]="groups()" [height]="44" [width]="44" [radius]="12" [glyph]="12" />
      <div class="text">
        <span class="name">{{ name() }}</span>
        <span class="macros">{{ sub() }}</span>
      </div>
      <div class="figures">
        <span class="kcal">{{ kcal() }}</span>
        <button class="toggle" type="button" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          {{ open() ? 'Hide ingredients' : 'Show ingredients' }}
        </button>
      </div>
    </div>
    @if (open()) {
      <div class="ingredients">
        @for (item of row().items; track $index) {
          <app-food-row [item]="item" />
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 10px 0;
        font-variant-numeric: tabular-nums;
      }

      .line {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .text {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: var(--fw-semibold);
        color: var(--text-primary);
      }

      .macros {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .figures {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
      }

      .kcal {
        font-size: 14px;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
      }

      .toggle {
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--accent-text);
        font: inherit;
        font-size: 12px;
        font-weight: var(--fw-semibold);
        cursor: pointer;

        &:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      }

      .ingredients {
        margin: 8px 0 0 56px;
        padding: 2px 12px;
        border-radius: 14px;
        background: var(--surface-sunken);
      }
    `
  ]
})
export class RecipeRowComponent {
  private readonly service = inject(RecipesService);

  readonly row = input.required<Extract<DiaryRow, { kind: 'recipe' }>>();

  protected readonly open = signal(false);
  protected readonly recipe = signal<RecipeDetail | null>(null);
  protected readonly groups = computed(() => {
    const found = this.recipe();
    return found ? topGroupsOf(found) : [];
  });
  protected readonly name = computed(() => this.recipe()?.name ?? 'Recipe');
  protected readonly kcal = computed(() => Math.round(this.row().calories));
  protected readonly sub = computed(() => {
    const row = this.row();
    const size = this.recipe()?.servings;
    const eaten = row.servings !== null ? servingsLabel(row.servings) : null;
    const lead = eaten !== null ? (size ? `${eaten} of ${size}` : eaten) : null;
    const parts = [lead, `${row.items.length} ingredient${row.items.length === 1 ? '' : 's'}`, macroLine(row.proteinGrams, row.carbsGrams, row.fatGrams)];
    return parts.filter((part): part is string => part !== null).join(' · ');
  });

  constructor() {
    effect(() => {
      const id = this.row().recipeId;
      untracked(() => this.service.lookup(id).subscribe((found) => this.recipe.set(found)));
    });
  }
}
