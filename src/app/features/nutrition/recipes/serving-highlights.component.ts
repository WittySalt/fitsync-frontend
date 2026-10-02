import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { whole } from '../diary/diary-figures';
import { goodSources, gramsText, higherIn } from './recipes-figures';
import { PerServing } from './recipes.models';

/**
 * A serving of a recipe: its energy and macros, the nutrients it is a good source of (green) and
 * what it is higher in (grey). The figures are for one serving, whatever number is chosen to eat.
 */
@Component({
  selector: 'app-serving-highlights',
  imports: [FoodGlyphComponent],
  template: `
    <div class="head">
      <h3>A serving</h3>
      @if (weight()) {
        <span>{{ weight() }}</span>
      }
    </div>
    <div class="macros">
      <div><strong>{{ kcal() }}</strong><span>kcal</span></div>
      <div><strong>{{ grams(perServing().proteinGrams) }}</strong><span>protein</span></div>
      <div><strong>{{ grams(perServing().carbsGrams) }}</strong><span>carbs</span></div>
      <div><strong>{{ grams(perServing().fatGrams) }}</strong><span>fat</span></div>
    </div>
    @if (good().length) {
      <div class="group">
        <span class="label">A good source of</span>
        <div class="chips">
          @for (entry of good(); track entry.name) {
            <span class="chip good"><app-food-glyph name="CHECK" [size]="12" [strokeWidth]="3" /><strong>{{ entry.name }}</strong> {{ entry.percent }}%</span>
          }
        </div>
      </div>
    }
    @if (higher().length) {
      <div class="group">
        <span class="label">Higher in</span>
        <div class="chips">
          @for (entry of higher(); track entry.name) {
            <span class="chip"><strong>{{ entry.name }}</strong> {{ entry.detail }}</span>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './serving-highlights.component.scss'
})
export class ServingHighlightsComponent {
  readonly perServing = input.required<PerServing>();
  readonly tags = input<readonly string[]>([]);
  /** The day's fat target, which "higher in" measures fat against. */
  readonly fatTarget = input<number | null>(null);
  /** The weight of one serving, when every ingredient has one. */
  readonly servingGrams = input<number | null>(null);

  protected readonly kcal = computed(() => whole(this.perServing().kcal));
  protected readonly weight = computed(() => (this.servingGrams() !== null ? gramsText(this.servingGrams()) : ''));
  protected readonly good = computed(() => goodSources(this.perServing().nutrients));
  protected readonly higher = computed(() => higherIn(this.perServing(), this.tags(), this.fatTarget()));
  protected grams(value: number): string {
    return `${Math.round(value)} g`;
  }
}
