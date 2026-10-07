import { Component, computed, input } from '@angular/core';

import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { parseIsoDate } from '../diary/diary-time';
import { NutrientDetail, PeriodKey } from './nutrients.models';
import { amountWithUnit, groupColour, sharePercent } from './nutrients-figures';
import { NutrientDayBarsComponent } from './nutrient-day-bars.component';
import { NutrientSourcesComponent } from './nutrient-sources.component';
import { NutrientTileComponent } from './nutrient-tile.component';

const SPAN: Record<PeriodKey, string> = { today: 'today', '7d': 'last 7 days', '30d': 'last 30 days' };

function shortDate(iso: string): string {
  return iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parseIsoDate(iso)) : '';
}

/** The person's own figures for one nutrient: the tile, the average, each day and where it came from. */
@Component({
  selector: 'app-nutrient-yours',
  imports: [NutrientDayBarsComponent, NutrientSourcesComponent, NutrientTileComponent, SpotlightDirective],
  template: `
    <div class="top">
      <app-nutrient-tile class="big" [nutrient]="detail().tile" [interactive]="false" />
      <div class="who">
        <strong class="average">{{ average() }}</strong>
        <span class="sub">{{ sub() }}</span>
      </div>
    </div>
    <section class="part">
      <strong>Each day</strong>
      @if (detail().tile.dayValues.length > 0) {
        <app-nutrient-day-bars [days]="detail().tile.dayValues" [name]="detail().tile.displayName" [colour]="colour()" />
        @if (detail().tile.dayValues.length > 1) {
          <div class="dates"><span>{{ first() }}</span><span>{{ last() }}</span></div>
        }
      } @else {
        <span class="note">No days to show.</span>
      }
    </section>
    <section class="part" appSpotlight="nutrition-nutrient" spotlightStep="sources">
      <strong>Where yours came from</strong>
      @if (detail().sources.length > 0) {
        <app-nutrient-sources [sources]="detail().sources" [unit]="detail().tile.unit" />
      } @else {
        <span class="note">No foods with this nutrient were logged in this period.</span>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 18px;
        font-variant-numeric: tabular-nums;
      }

      .top {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .big {
        flex: none;
        width: 92px;
      }

      .who {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .average {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: var(--fw-semibold);
        color: var(--text-primary);
      }

      .sub,
      .note,
      .dates {
        font-size: 13px;
        color: var(--text-secondary);
      }

      .part {
        display: flex;
        flex-direction: column;
        gap: 10px;

        > strong {
          font-size: 13px;
          color: var(--text-primary);
        }
      }

      .dates {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
      }
    `
  ]
})
export class NutrientYoursComponent {
  readonly detail = input.required<NutrientDetail>();
  readonly period = input.required<PeriodKey>();

  protected readonly colour = computed(() => groupColour(this.detail().tile.groupCode));
  protected readonly average = computed(() => {
    const tile = this.detail().tile;
    return tile.averageAmount === null ? 'No data yet' : `${amountWithUnit(tile.averageAmount, tile.unit)} a day`;
  });
  protected readonly sub = computed(() => {
    const tile = this.detail().tile;
    const percent = sharePercent(tile);
    const of = amountWithUnit(tile.reference, tile.unit);
    return percent === null ? `Daily amount ${of} · ${SPAN[this.period()]}` : `${percent}% of ${of} · ${SPAN[this.period()]}`;
  });
  protected readonly first = computed(() => shortDate(this.detail().tile.dayValues[0]?.date ?? ''));
  protected readonly last = computed(() => shortDate(this.detail().tile.dayValues.at(-1)?.date ?? ''));
}
