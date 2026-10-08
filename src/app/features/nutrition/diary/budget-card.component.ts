import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DiarySummary } from './diary.models';
import { barPercent, budgetFigures, whole } from './diary-figures';

interface MacroRow {
  name: string;
  colour: string;
  eaten: number;
  goal: number | null;
}

const RING_SIZE = 104;
// Inset by 8 so the 11-wide stroke, centred on the radius, stays inside the square.
const RING_RADIUS = RING_SIZE / 2 - 8;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The day's budget: calories eaten as the big number, what is left or over, the ring (the part over
 * the target in dark grey, never red) and a bar for protein, carbs and fat in their own colours.
 */
@Component({
  selector: 'app-budget-card',
  imports: [RouterLink],
  template: `
    <div class="top">
      <div class="numbers">
        <span class="eyebrow">{{ label() }}</span>
        <div class="eaten">
          <strong>{{ eaten() }}</strong>
          <span>kcal eaten</span>
        </div>
        @if (figures(); as budget) {
          <span class="line" [class.over]="budget.isOver">{{ budget.line }}</span>
        } @else {
          <a class="set" routerLink="/me">Set a daily calorie target</a>
        }
      </div>
      @if (figures(); as budget) {
        <svg class="ring" [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="budget.percent + '% of the daily target'">
          <circle class="track" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" fill="none" stroke-width="11"></circle>
          @if (budget.within > 0) {
            <circle
              class="within"
              [attr.cx]="size / 2"
              [attr.cy]="size / 2"
              [attr.r]="radius"
              fill="none"
              stroke-width="11"
              [attr.stroke-linecap]="budget.isOver ? 'butt' : 'round'"
              [attr.stroke-dasharray]="length * budget.within + ' ' + length"
              [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
            ></circle>
          }
          @if (budget.isOver) {
            <circle
              class="beyond"
              [attr.cx]="size / 2"
              [attr.cy]="size / 2"
              [attr.r]="radius"
              fill="none"
              stroke-width="11"
              [attr.stroke-dasharray]="length * budget.over + ' ' + length"
              [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
            ></circle>
          }
          <text class="percent" [attr.x]="size / 2" [attr.y]="size / 2 - 6" text-anchor="middle">{{ budget.percent }}%</text>
          <text class="of" [attr.x]="size / 2" [attr.y]="size / 2 + 13" text-anchor="middle">of {{ target() }}</text>
        </svg>
      }
    </div>
    <div class="macros">
      @for (macro of macros(); track macro.name) {
        <div class="macro">
          <div class="macro-head">
            <span class="name"><i [style.background]="macro.colour"></i><strong>{{ macro.name }}</strong></span>
            <span class="amount">{{ amount(macro) }}</span>
          </div>
          @if (macro.goal !== null && macro.goal > 0) {
            <span class="bar"><span [style.width.%]="percent(macro)" [style.background]="macro.colour"></span></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './budget-card.component.scss'
})
export class BudgetCardComponent {
  readonly summary = input.required<DiarySummary>();
  /** The word over the big number: Today, or the day shown. */
  readonly label = input('Today');

  protected readonly size = RING_SIZE;
  protected readonly radius = RING_RADIUS;
  protected readonly length = RING_LENGTH;

  protected readonly eaten = computed(() => whole(this.summary().totalCalories));
  protected readonly target = computed(() => whole(this.summary().targetCalories ?? 0));
  protected readonly figures = computed(() => budgetFigures(this.summary().totalCalories, this.summary().targetCalories));
  protected readonly macros = computed<MacroRow[]>(() => {
    const summary = this.summary();
    return [
      { name: 'Protein', colour: 'var(--food-protein)', eaten: summary.totalProteinGrams, goal: summary.targetProteinGrams },
      { name: 'Carbs', colour: 'var(--food-grains)', eaten: summary.totalCarbsGrams, goal: summary.targetCarbsGrams },
      { name: 'Fat', colour: 'var(--food-nuts)', eaten: summary.totalFatGrams, goal: summary.targetFatGrams }
    ];
  });

  protected amount(macro: MacroRow): string {
    return macro.goal !== null && macro.goal > 0 ? `${whole(macro.eaten)} of ${whole(macro.goal)} g` : `${whole(macro.eaten)} g`;
  }

  protected percent(macro: MacroRow): number {
    return macro.goal ? barPercent(macro.eaten / macro.goal) : 0;
  }
}
