import { Component, computed, input, output } from '@angular/core';

import { NutrientTileData, PeriodKey } from './nutrients.models';
import { GROUP_LABEL, groupColour, heroLine, periodEyebrow, petalSummary, reachSummary, sharePercent } from './nutrients-figures';
import { NutrientPetalsComponent } from './nutrient-petals.component';

const KEY_GROUPS = ['FAT_SOLUBLE', 'WATER_SOLUBLE', 'MAJOR_MINERAL', 'TRACE_MINERAL'] as const;
type KeyGroup = (typeof KEY_GROUPS)[number];

/** The top of All nutrients: the petal chart, one sentence about the period and the three lowest as chips. */
@Component({
  selector: 'app-nutrient-hero',
  imports: [NutrientPetalsComponent],
  template: `
    <app-nutrient-petals [nutrients]="nutrients()" [reached]="summary().reached" [total]="summary().total" [summary]="spoken()" />
    <div class="text">
      <span class="eyebrow">{{ eyebrow() }}</span>
      @if (line(); as sentence) {
        <strong class="line">{{ sentence }}</strong>
      } @else {
        <strong class="line">Log some food to see how your vitamins and minerals add up.</strong>
      }
      @if (summary().lowest.length > 0) {
        <span class="hint">Petals past the dashed ring are reached. Lowest three:</span>
        <div class="chips">
          @for (item of summary().lowest; track item.code) {
            <button type="button" class="chip" [style.--g]="colour(item)" (click)="open.emit(item)">
              <span class="sym">{{ item.symbol }}</span>
              <strong>{{ item.displayName }}</strong>
              <span class="pct">{{ percent(item) }}%</span>
            </button>
          }
        </div>
      }
      <div class="key">
        @for (group of groups; track group) {
          <span><i [style.background]="colourOf(group)"></i>{{ labelOf(group) }}</span>
        }
      </div>
    </div>
  `,
  styleUrl: './nutrient-hero.component.scss'
})
export class NutrientHeroComponent {
  readonly nutrients = input.required<NutrientTileData[]>();
  readonly period = input.required<PeriodKey>();
  readonly open = output<NutrientTileData>();

  protected readonly groups = KEY_GROUPS;
  protected readonly summary = computed(() => reachSummary(this.nutrients()));
  protected readonly line = computed(() => heroLine(this.summary(), this.period()));
  protected readonly eyebrow = computed(() => periodEyebrow(this.period()));
  protected readonly spoken = computed(() => petalSummary(this.summary(), this.period()));

  protected colour(item: NutrientTileData): string {
    return groupColour(item.groupCode);
  }

  protected percent(item: NutrientTileData): number | null {
    return sharePercent(item);
  }

  protected colourOf(group: KeyGroup): string {
    return groupColour(group);
  }

  protected labelOf(group: KeyGroup): string {
    return GROUP_LABEL[group];
  }
}
