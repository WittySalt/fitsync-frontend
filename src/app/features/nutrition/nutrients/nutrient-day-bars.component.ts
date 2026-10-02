import { Component, computed, input } from '@angular/core';

import { NutrientDayValue } from './nutrients.models';
import { BAR_TOP, dayBars, dayBarsSummary } from './nutrients-figures';

/**
 * A bar for each day of the period with a dashed line at the daily amount. A bar is the group
 * colour below the line and the accent colour from it; a day that was not logged is a small grey
 * stub, not an empty bar, so it is not read as a low day.
 */
@Component({
  selector: 'app-nutrient-day-bars',
  template: `
    <div class="bars" role="img" [attr.aria-label]="summary()" [style.--g]="colour()">
      @for (bar of bars(); track bar.date) {
        <span class="bar" [class.stub]="!bar.logged" [class.reached]="bar.reached" [style.height.%]="bar.logged ? bar.height : null"></span>
      }
      <span class="ref" [style.bottom.%]="line"></span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .bars {
        position: relative;
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: var(--bars-height, 70px);
      }

      .bar {
        flex: 1 1 0;
        min-width: 2px;
        border-radius: 2px;
        background: var(--g);
        transition: height var(--dur-base) var(--ease-standard);
      }

      .bar.reached {
        background: var(--accent);
      }

      .bar.stub {
        height: 3px;
        background: var(--border-strong);
      }

      .ref {
        position: absolute;
        left: 0;
        right: 0;
        border-top: 1px dashed var(--text-primary);
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .bar {
          transition: none;
        }
      }
    `
  ]
})
export class NutrientDayBarsComponent {
  readonly days = input.required<NutrientDayValue[]>();
  readonly name = input.required<string>();
  readonly colour = input('var(--accent)');

  protected readonly line = (100 / BAR_TOP);
  protected readonly bars = computed(() => dayBars(this.days()));
  protected readonly summary = computed(() => dayBarsSummary(this.name(), this.days()));
}
