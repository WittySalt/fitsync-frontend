import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ProteinByMeal } from '../../../core/fitsync.models';
import { MEAL_BASELINE_Y, MEAL_HEIGHT, MEAL_WIDTH, mealBars } from './meal-bars.geometry';

/**
 * The protein-by-meal chart inside a Nutrition reading.
 *
 * One bar for each meal on an average day. It sits on the reading's dark card, so its colours are
 * the slate and green primitives and do not change with the theme.
 */
@Component({
  selector: 'app-meal-bars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chart(); as drawn) {
      <svg class="bars" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="drawn.description">
        <line class="baseline" x1="12" [attr.y1]="baselineY" x2="528" [attr.y2]="baselineY"></line>
        @for (bar of drawn.bars; track $index) {
          <rect class="bar" [class.quiet]="!bar.bright" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="7"></rect>
          <text class="value" [attr.x]="bar.centerX" [attr.y]="bar.valueY" text-anchor="middle">{{ bar.valueText }}</text>
          <text class="meal" [attr.x]="bar.centerX" [attr.y]="bar.labelY" text-anchor="middle">{{ bar.label }}</text>
        }
      </svg>
      <ul class="meal-list">
        @for (bar of drawn.bars; track $index) {
          <li>
            <span class="meal-name">{{ bar.fullLabel }}</span>
            <span class="meal-track"><span class="meal-fill" [class.quiet]="!bar.bright" [style.width.%]="bar.share * 100"></span></span>
            <span class="meal-grams">{{ bar.valueText }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      /* The drawing is scaled by its container, and under this width its labels would be too
         small to read. The same meals are then written as a short list. */
      .meal-list {
        display: none;
        margin: 0;
        padding: 0;
        list-style: none;
        flex-direction: column;
        gap: 8px;
      }
      .meal-list li {
        display: grid;
        grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr) 3.5rem;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--slate-300);
        font-variant-numeric: tabular-nums;
      }
      .meal-name {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .meal-track {
        height: 8px;
        border-radius: 4px;
        background: var(--slate-700);
        overflow: hidden;
      }
      .meal-fill {
        display: block;
        height: 100%;
        border-radius: 4px;
        background: var(--green-500);
      }
      .meal-fill.quiet {
        background: var(--green-300);
      }
      .meal-grams {
        text-align: right;
        font-weight: 700;
        color: var(--white);
      }
      .bars {
        display: block;
        width: 100%;
        max-width: 540px;
        height: auto;
      }
      text {
        font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .baseline {
        stroke: var(--slate-700);
        stroke-width: 1;
      }
      .bar {
        fill: var(--green-500);
      }
      .bar.quiet {
        fill: var(--green-300);
      }
      .value {
        font-size: 12px;
        font-weight: 700;
        fill: var(--white);
      }
      .meal {
        font-weight: 600;
        fill: var(--slate-300);
      }
      @container (max-width: 470px) {
        .bars {
          display: none;
        }
        .meal-list {
          display: flex;
        }
      }
    `
  ]
})
export class MealBarsComponent {
  readonly meals = input.required<ProteinByMeal[]>();
  /** True when the reading is about the lunch-and-dinner share, so those two bars stand out. */
  readonly emphasiseLunchAndDinner = input(false);

  readonly viewBox = `0 0 ${MEAL_WIDTH} ${MEAL_HEIGHT}`;
  readonly baselineY = MEAL_BASELINE_Y;

  readonly chart = computed(() => mealBars(this.meals(), this.emphasiseLunchAndDinner()));
}
