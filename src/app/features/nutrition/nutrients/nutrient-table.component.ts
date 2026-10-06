import { Component, computed, input, output } from '@angular/core';

import { NutrientTileData } from './nutrients.models';
import { GROUP_LABEL, groupColour, groupNutrients } from './nutrients-figures';
import { NutrientTileComponent } from './nutrient-tile.component';
import { SpotlightDirective } from '../../../core/guide/spotlight.directive';

/**
 * The periodic table of nutrients: a block of tiles for each group, with the limits last. Six tiles
 * to a row when the card is wide and four when it is narrow, measured on the card itself.
 */
@Component({
  selector: 'app-nutrient-table',
  imports: [SpotlightDirective, NutrientTileComponent],
  template: `
    @for (block of blocks(); track block.group; let firstBlock = $first) {
      <section class="block" [attr.aria-label]="label(block.group)">
        <span class="title"><i [style.background]="colour(block.group)"></i>{{ label(block.group) }}</span>
        <div class="grid">
          @for (item of block.items; track item.code; let firstTile = $first) {
            <app-nutrient-tile
              [appSpotlight]="firstBlock && firstTile ? 'nutrition-nutrients' : null"
              spotlightStep="tile"
              [nutrient]="item"
              [selected]="item.code === selected()" (pick)="pick.emit($event)" />
          }
        </div>
      </section>
    }
  `,
  styleUrl: './nutrient-table.component.scss'
})
export class NutrientTableComponent {
  readonly nutrients = input.required<NutrientTileData[]>();
  readonly selected = input<string | null>(null);
  readonly pick = output<NutrientTileData>();

  protected readonly blocks = computed(() => groupNutrients(this.nutrients()));

  protected label(group: keyof typeof GROUP_LABEL): string {
    return GROUP_LABEL[group];
  }

  protected colour(group: keyof typeof GROUP_LABEL): string {
    return groupColour(group);
  }
}
