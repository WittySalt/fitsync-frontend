import { Component, computed, input } from '@angular/core';

import { FoodTileComponent } from '../../../shared/food/food-tile.component';
import { DiaryItem } from './diary.models';
import { foodTags, macroLine } from './diary-food';

/** One food of a meal: its icon, name, protein carbs and fat, quality tags, kcal and amount. */
@Component({
  selector: 'app-food-row',
  imports: [FoodTileComponent],
  template: `
    <app-food-tile [group]="item().foodGroup" [categoryCode]="item().categoryCode" [logoUrl]="item().brandLogoUrl" [brandName]="item().draft.brandName" [size]="38" />
    <div class="text">
      <span class="name">{{ item().foodName }}</span>
      <div class="detail">
        <span class="macros">{{ macros() }}</span>
        @for (tag of tags(); track tag.label) {
          <span class="tag" [class.good]="tag.good">{{ tag.label }}</span>
        }
      </div>
    </div>
    <div class="figures">
      <span class="kcal">{{ item().calories }}</span>
      <span class="amount">{{ item().amount }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        font-variant-numeric: tabular-nums;
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

      .detail {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
      }

      .macros {
        font-size: 12px;
        color: var(--text-secondary);
        white-space: nowrap;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding: 0 7px;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--surface-sunken);
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: var(--fw-semibold);
        white-space: nowrap;
      }

      .tag.good {
        border-color: var(--border-accent);
        background: var(--surface-tint);
        color: var(--accent-text);
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

      .amount {
        max-width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: var(--text-secondary);
      }
    `
  ]
})
export class FoodRowComponent {
  readonly item = input.required<DiaryItem>();

  protected readonly tags = computed(() => foodTags(this.item()));
  protected readonly macros = computed(() => {
    const item = this.item();
    return macroLine(item.proteinGrams, item.carbsGrams, item.fatGrams);
  });
}
