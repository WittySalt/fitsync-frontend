import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { Load } from '../diary/diary.models';
import { NutrientDetail, NutrientTileData, PeriodKey } from './nutrients.models';
import { amountOfReference, groupColour, lowerFirst, periodQuery, topSources } from './nutrients-figures';
import { NutrientDayBarsComponent } from './nutrient-day-bars.component';
import { NutrientSourcesComponent } from './nutrient-sources.component';
import { NutrientTileComponent } from './nutrient-tile.component';

/** The panel beside the table on a wide screen: the picked tile, its days, its top foods and the way to its page. */
@Component({
  selector: 'app-nutrient-side-panel',
  imports: [FoodGlyphComponent, NutrientDayBarsComponent, NutrientSourcesComponent, NutrientTileComponent, RouterLink],
  template: `
    <div class="top">
      <app-nutrient-tile class="big" [nutrient]="nutrient()" [interactive]="false" />
      <div class="who">
        <strong class="name">{{ nutrient().displayName }}</strong>
        <span class="amount">{{ amount() }}</span>
      </div>
    </div>
    <section class="part">
      <strong>Each day</strong>
      @if (nutrient().dayValues.length > 0) {
        <app-nutrient-day-bars [days]="nutrient().dayValues" [name]="nutrient().displayName" [colour]="colour()" />
      } @else {
        <span class="note">No days to show.</span>
      }
    </section>
    <section class="part">
      <strong>Where it came from</strong>
      @switch (detail().status) {
        @case ('ready') {
          @if (sources().length > 0) {
            <app-nutrient-sources [sources]="sources()" [unit]="nutrient().unit" [compact]="true" />
          } @else {
            <span class="note">No foods with this nutrient were logged in this period.</span>
          }
        }
        @case ('error') {
          <span class="note">The foods could not load.</span>
        }
        @default {
          <span class="skeleton" aria-busy="true"></span>
        }
      }
    </section>
    <a class="read" [routerLink]="['/nutrition/nutrients', nutrient().code]" [queryParams]="query()">
      Read about {{ lower() }}
      <app-food-glyph name="ARROW_LEFT" [size]="15" [strokeWidth]="2.4" class="flip" />
    </a>
  `,
  styleUrl: './nutrient-side-panel.component.scss'
})
export class NutrientSidePanelComponent {
  readonly nutrient = input.required<NutrientTileData>();
  readonly detail = input.required<Load<NutrientDetail>>();
  readonly period = input.required<PeriodKey>();
  protected readonly query = computed(() => periodQuery(this.period()));

  protected readonly colour = computed(() => groupColour(this.nutrient().groupCode));
  protected readonly lower = computed(() => lowerFirst(this.nutrient().displayName));
  protected readonly amount = computed(() => {
    const text = amountOfReference(this.nutrient());
    return text ? `${text} a day` : 'No data yet';
  });
  protected readonly sources = computed(() => {
    const state = this.detail();
    return state.status === 'ready' ? topSources(state.data.sources) : [];
  });
}
