import { Component, input } from '@angular/core';

import { FoodGroup } from '../../../shared/food/food-groups';
import { whole } from '../diary/diary-figures';
import { RecipeCoverComponent } from './recipe-cover.component';
import { EditorTotals } from './recipes-editor';

/**
 * The recipe as people will see it, drawn while it is written: a cover from the food groups of the
 * ingredients (a photo is not part of the editor), the name, tags, the facts strip and what a serving
 * gives. It holds no data of its own; the editor passes everything in.
 */
@Component({
  selector: 'app-recipe-preview',
  imports: [RecipeCoverComponent],
  template: `
    <span class="eyebrow">Preview, as people will see it</span>
    <app-recipe-cover [groups]="groups()" ratio="16 / 7" [radius]="16" [glyph]="26" />
    <strong class="title">{{ name().trim() || 'Your recipe' }}</strong>
    @if (tags().length > 0) {
      <div class="tags">
        @for (tag of tags(); track tag) {
          <span [class.grey]="tag === 'High sugar' || tag === 'High salt'">{{ tag }}</span>
        }
      </div>
    }
    <div class="facts" aria-label="Facts">
      <div><strong>{{ servings() ?? '-' }}</strong><span>servings</span></div>
      <div><strong>{{ ingredients() }}</strong><span>{{ ingredients() === 1 ? 'ingredient' : 'ingredients' }}</span></div>
      <div><strong>{{ steps() }}</strong><span>{{ steps() === 1 ? 'step' : 'steps' }}</span></div>
      <div><strong>{{ timers() }}</strong><span>{{ timers() === 1 ? 'timer' : 'timers' }}</span></div>
    </div>
    <div class="live" aria-live="polite">
      <h3>A serving, worked out as you type</h3>
      <div class="macros">
        <div><strong>{{ kcal(totals().kcal) }}</strong><span>kcal</span></div>
        <div><strong>{{ grams(totals().proteinGrams) }}</strong><span>protein</span></div>
        <div><strong>{{ grams(totals().carbsGrams) }}</strong><span>carbs</span></div>
        <div><strong>{{ grams(totals().fatGrams) }}</strong><span>fat</span></div>
      </div>
      @if (totals().left > 0) {
        <p class="hint">{{ totals().left }} {{ totals().left === 1 ? 'ingredient is' : 'ingredients are' }} not counted yet. Each needs an amount and its figures.</p>
      }
    </div>
  `,
  styleUrl: './recipe-preview.component.scss'
})
export class RecipePreviewComponent {
  readonly name = input('');
  readonly servings = input<number | null>(null);
  readonly groups = input<readonly FoodGroup[]>([]);
  readonly tags = input<readonly string[]>([]);
  readonly ingredients = input(0);
  readonly steps = input(0);
  readonly timers = input(0);
  readonly totals = input.required<EditorTotals>();

  protected readonly kcal = whole;

  protected grams(value: number): string {
    return `${Math.round(value)} g`;
  }
}
