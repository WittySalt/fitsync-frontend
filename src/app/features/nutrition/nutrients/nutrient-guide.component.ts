import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { NutrientDetail } from './nutrients.models';
import { amountWithUnit, lowerFirst } from './nutrients-figures';

/**
 * What the guide says about a nutrient, then the daily amounts by age with the person's row marked,
 * the richest foods and a few tips. Plain text from the server; a part it did not send is left out.
 */
@Component({
  selector: 'app-nutrient-guide',
  imports: [FoodGlyphComponent, FoodIconComponent],
  template: `
    <span class="eyebrow">About {{ lower() }}</span>
    @if (detail().guide; as guide) {
      @if (guide.whatItDoes) {
        <section><h3>What it does</h3><p>{{ guide.whatItDoes }}</p></section>
      }
      @if (guide.tooLittleTooMuch) {
        <section><h3>Too little, too much</h3><p>{{ guide.tooLittleTooMuch }}</p></section>
      }
    }
    @if (detail().amounts.length > 0) {
      <section>
        <h3>How much a day</h3>
        <table>
          <thead>
            <tr>
              <th scope="col">Age</th>
              @if (split()) {
                <th scope="col">Women</th>
                <th scope="col">Men</th>
              } @else {
                <th scope="col">A day</th>
              }
              <th scope="col">Upper limit</th>
            </tr>
          </thead>
          <tbody>
            @for (row of detail().amounts; track row.ageBand) {
              <tr [class.mine]="row.mine" [attr.aria-current]="row.mine ? 'true' : null">
                <td>{{ row.label }}@if (row.mine) { <em>you</em> }</td>
                @if (split()) {
                  <td>{{ amount(row.female) }}</td>
                  <td>{{ amount(row.male) }}</td>
                } @else {
                  <td>{{ amount(row.female ?? row.male) }}</td>
                }
                <td>{{ amount(row.upperLimit) }}</td>
              </tr>
            }
          </tbody>
        </table>
        <span class="note">{{ amountsNote() }}</span>
      </section>
    }
    @if (detail().richest.length > 0) {
      <section>
        <h3>Richest foods</h3>
        <div class="foods">
          @for (food of detail().richest; track food.foodId) {
            <div class="food">
              <app-food-icon [group]="food.foodGroup" [categoryCode]="food.categoryCode" [size]="30" />
              <span class="fname">{{ food.name }}</span>
              <span class="famount">{{ amount(food.amountPer100g) }}</span>
            </div>
          }
        </div>
        <span class="note">Per 100 g, from the food library.</span>
      </section>
    }
    @if (detail().guide; as guide) {
      @if (guide.tips.length > 0) {
        <section>
          <h3>Good to know</h3>
          @for (tip of guide.tips; track tip) {
            <div class="tip"><app-food-glyph name="SPARK" [size]="16" [strokeWidth]="2" /><span>{{ tip }}</span></div>
          }
        </section>
      }
      @if (guide.whoNeedsMore) {
        <section><h3>Who may need more</h3><p>{{ guide.whoNeedsMore }}</p></section>
      }
      <span class="source">
        @if (guide.sourceLabel) {
          Written from the {{ guide.sourceLabel }} fact sheet.
        }
        General information, not medical advice.
      </span>
    }
  `,
  styleUrl: './nutrient-guide.component.scss'
})
export class NutrientGuideComponent {
  readonly detail = input.required<NutrientDetail>();

  protected readonly lower = computed(() => lowerFirst(this.detail().tile.displayName));
  /** Separate columns for women and men only when some age band differs between them. */
  protected readonly split = computed(() => this.detail().amounts.some((row) => row.female !== row.male));
  protected readonly amountsNote = computed(() => {
    const mine = this.detail().amounts.find((row) => row.mine);
    const same = this.split() ? '' : 'The same for women and men. ';
    return `${same}${mine ? `You are in the ${mine.label} row.` : ''}`.trim();
  });

  protected amount(value: number | null): string {
    return value === null ? 'none set' : amountWithUnit(value, this.detail().tile.unit);
  }
}
