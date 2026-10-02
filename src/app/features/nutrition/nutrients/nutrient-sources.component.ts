import { Component, computed, input } from '@angular/core';

import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { groupColour as foodColour } from '../../../shared/food/food-groups';
import { NutrientSource } from './nutrients.models';
import { figureText } from './nutrients-figures';

/** The foods a nutrient came from: icon, name, amount and share, with a bar in the colour of the food group. */
@Component({
  selector: 'app-nutrient-sources',
  imports: [FoodIconComponent],
  template: `
    @for (row of rows(); track row.source.name) {
      <div class="row">
        <app-food-icon [group]="row.source.foodGroup" [categoryCode]="row.source.categoryCode" [size]="compact() ? 28 : 30" />
        <div class="text">
          <div class="line">
            <strong>{{ row.source.name }}</strong>
            @if (!compact()) {
              <span>{{ row.detail }}</span>
            }
          </div>
          @if (!compact()) {
            <span class="track" aria-hidden="true"><i [style.width.%]="row.width" [style.background]="row.colour"></i></span>
          }
        </div>
        @if (compact() && row.percent !== null) {
          <span class="pct">{{ row.percent }}%</span>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-variant-numeric: tabular-nums;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .text {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .line {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;

        strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
        }

        span {
          flex: none;
          color: var(--text-secondary);
        }
      }

      .track {
        height: 5px;
        border-radius: 3px;
        background: var(--surface-sunken);
        overflow: hidden;

        i {
          display: block;
          height: 100%;
          border-radius: 3px;
        }
      }

      .pct {
        font-size: 13px;
        color: var(--text-secondary);
      }

      :host(.compact) .line strong {
        font-weight: var(--fw-semibold);
      }
    `
  ],
  host: { '[class.compact]': 'compact()' }
})
export class NutrientSourcesComponent {
  readonly sources = input.required<NutrientSource[]>();
  readonly unit = input('');
  /** The side panel version: name and share only. */
  readonly compact = input(false);

  protected readonly rows = computed(() =>
    this.sources().map((source) => {
      const percent = source.share === null ? null : Math.round(source.share * 100);
      const amount = source.amount === null ? '' : `${figureText(source.amount)} ${this.unit()}`.trim();
      return {
        source,
        percent,
        width: Math.min(Math.max(source.share ?? 0, 0), 1) * 100,
        colour: foodColour(source.foodGroup, source.categoryCode),
        detail: [amount, percent === null ? '' : `${percent}%`].filter(Boolean).join(' · ')
      };
    })
  );
}
