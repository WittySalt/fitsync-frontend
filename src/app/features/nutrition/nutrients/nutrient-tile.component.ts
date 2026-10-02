import { Component, computed, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { NutrientTileData } from './nutrients.models';
import { groupColour, sharePercent, tileFill, tileLabel, tileName, tileState } from './nutrients-figures';

/**
 * One nutrient as a tile of the periodic table: the symbol large, the name below, an atomic number
 * for a mineral, and a fill from the bottom by how much of the daily amount was eaten. A reached
 * nutrient is tinted fully with a tick; a limit is grey, and past it the outline turns dark.
 */
@Component({
  selector: 'app-nutrient-tile',
  imports: [FoodGlyphComponent],
  template: `
    <button
      type="button"
      class="tile"
      [class.selected]="selected()"
      [class.reached]="state() === 'reached'"
      [class.over]="state() === 'over'"
      [class.limit]="nutrient().groupCode === 'LIMIT'"
      [style.--g]="colour()"
      [disabled]="!interactive()"
      [attr.aria-hidden]="interactive() ? null : true"
      [attr.aria-label]="label()"
      [attr.aria-pressed]="interactive() ? selected() : null"
      (click)="pick.emit(nutrient())"
    >
      <span class="fill" [style.height.%]="fill()"></span>
      <span class="top">
        <span class="atomic">{{ nutrient().atomicNumber }}</span>
        <span class="value">
          @switch (state()) {
            @case ('reached') {
              <app-food-glyph class="tick" name="CHECK" [size]="11" [strokeWidth]="3" />{{ percent() }}%
            }
            @case ('over') {
              over
            }
            @case ('unknown') {
              <span class="none">no data</span>
            }
            @default {
              {{ percent() }}%
            }
          }
        </span>
      </span>
      <strong class="symbol">{{ nutrient().symbol }}</strong>
      <span class="name" [class.long]="name().length > 10">{{ name() }}</span>
    </button>
  `,
  styleUrl: './nutrient-tile.component.scss'
})
export class NutrientTileComponent {
  readonly nutrient = input.required<NutrientTileData>();
  readonly selected = input(false);
  /** False for the large tile on a panel, which only shows the figures. */
  readonly interactive = input(true);
  readonly pick = output<NutrientTileData>();

  protected readonly state = computed(() => tileState(this.nutrient()));
  protected readonly fill = computed(() => tileFill(this.nutrient()));
  protected readonly percent = computed(() => sharePercent(this.nutrient()));
  protected readonly name = computed(() => tileName(this.nutrient()));
  protected readonly label = computed(() => tileLabel(this.nutrient()));
  protected readonly colour = computed(() => groupColour(this.nutrient().groupCode));
}
