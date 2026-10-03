import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { asFoodGroup } from '../../../shared/food/food-groups';
import { formatNumber, signed } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { FoodNutrition, FoodProgress } from '../progress-api.models';

const MEAL_NAMES: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack' };
const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const LABEL_W = 76;
const WIDTH = 600;

export function clockTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function mealName(type: string): string {
  return MEAL_NAMES[type] ?? type.charAt(0) + type.slice(1).toLowerCase();
}

function byMealOrder<T extends { mealType: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (MEAL_ORDER.indexOf(a.mealType) + 9) % 9 - ((MEAL_ORDER.indexOf(b.mealType) + 9) % 9));
}

/**
 * Meals (board 19b): when each meal usually lands, as a band holding half of the times with the
 * middle time marked; each meal's share of the day's calories with its change; and the foods logged
 * most often.
 */
@Component({
  selector: 'app-food-meals-section',
  imports: [FoodIconComponent, SectionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Meals" sub="by the meal each food was logged under" [context]="context()">
      <div class="block">
        <strong>When you usually eat</strong>
        @if (clock().length) {
          <svg [attr.viewBox]="'0 0 600 ' + clockHeight()" role="img" [attr.aria-label]="clockSummary()">
            @for (hour of hours; track hour.text) {
              <line class="grid" [attr.x1]="hour.x" [attr.x2]="hour.x" y1="12" [attr.y2]="clockHeight() - 18"></line>
              <text [attr.x]="hour.x" [attr.y]="clockHeight() - 3" [attr.text-anchor]="hour.anchor">{{ hour.text }}</text>
            }
            @for (row of clock(); track row.name) {
              <text class="meal" x="0" [attr.y]="row.y" dominant-baseline="central">{{ row.name }}</text>
              <rect class="track" x="76" [attr.y]="row.y - 5" width="524" height="10" rx="5"></rect>
              @if (row.band) {
                <rect class="band" [attr.x]="row.band.x" [attr.y]="row.y - 5" [attr.width]="row.band.width" height="10" rx="5"></rect>
              }
              <circle class="mid" [attr.cx]="row.x" [attr.cy]="row.y" r="5"></circle>
              <text class="time" [attr.x]="row.textX" [attr.y]="row.y - 9" [attr.text-anchor]="row.anchor">{{ row.time }}</text>
            }
          </svg>
          <span class="quiet">The dot is the middle time; half of your meals fall in the band.</span>
        } @else {
          <span class="quiet">Not enough data yet</span>
        }
      </div>
      <div class="lower">
        <div class="block">
          <strong>Share of the day's calories</strong>
          @for (row of shares(); track row.mealType) {
            <div class="share">
              <span>{{ row.name }}</span>
              <strong>{{ row.pct }}%</strong>
              <span class="delta">{{ row.delta }}</span>
              <span class="word">{{ row.word }}</span>
            </div>
          } @empty {
            <span class="quiet">Not enough data yet</span>
          }
        </div>
        <div class="block">
          <strong>Most logged foods</strong>
          @for (food of foods(); track food.name) {
            <div class="food">
              <app-food-icon [group]="group(food.foodGroup)" [categoryCode]="food.categoryCode" [size]="30" />
              <span class="food-name">{{ food.name }}</span>
              <span class="times"><strong>{{ food.times }}</strong> times</span>
            </div>
          } @empty {
            <span class="quiet">Not enough data yet</span>
          }
        </div>
      </div>
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .block { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .block > strong { font-size: var(--text-sm); color: var(--text-primary); }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); }
    .track { fill: var(--surface-sunken); }
    .band { fill: var(--accent); opacity: .45; }
    .mid { fill: var(--accent-text); stroke: var(--surface); stroke-width: 1.5; }
    text { font: 400 10px var(--font-sans); fill: var(--text-secondary); }
    .meal { font-size: 12px; font-weight: 600; fill: var(--text-primary); }
    .time { font-size: 11px; font-weight: 700; fill: var(--text-primary); paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
    .quiet { font-size: var(--text-xs); color: var(--text-secondary); }
    .lower { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; border-top: 1px solid var(--border); padding-top: 16px; }
    .share, .food { display: grid; align-items: center; gap: 8px; padding: 6px 0; font-size: var(--text-sm); color: var(--text-primary); }
    .share { grid-template-columns: minmax(0, 1fr) 44px 80px 44px; }
    .food { grid-template-columns: 30px minmax(0, 1fr) auto; }
    .share + .share, .food + .food { border-top: 1px solid var(--border); }
    .delta, .times { font-size: var(--text-xs); color: var(--text-secondary); text-align: right; white-space: nowrap; }
    .word { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-align: right; }
    .food-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .times strong { color: var(--text-primary); }
    @media (max-width: 640px) { .lower { grid-template-columns: minmax(0, 1fr); gap: 16px; } }
  `
})
export class FoodMealsSectionComponent {
  readonly meals = input.required<FoodProgress['meals']>();
  readonly nutrition = input<FoodNutrition | null>(null);
  readonly context = input<ProgressCardContext | null>(null);

  protected readonly hours = [0, 6, 12, 18, 24].map((hour) => ({
    x: LABEL_W + ((WIDTH - LABEL_W) * hour) / 24,
    text: `${String(hour).padStart(2, '0')}:00`,
    anchor: hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'
  }));

  protected readonly clock = computed(() => {
    const x = (minutes: number) => LABEL_W + ((WIDTH - LABEL_W) * Math.min(Math.max(minutes, 0), 1440)) / 1440;
    return byMealOrder(this.nutrition()?.mealTimes ?? []).map((row, k) => {
      const mid = x(row.medianMinuteOfDay);
      const late = row.medianMinuteOfDay >= 1200;
      return {
        name: mealName(row.mealType),
        y: 16 + k * 30 + 15,
        x: mid,
        time: clockTime(row.medianMinuteOfDay),
        textX: late ? mid - 10 : mid + 10,
        anchor: late ? 'end' : 'start',
        band: row.p25 !== null && row.p75 !== null ? { x: x(row.p25), width: Math.max(x(row.p75) - x(row.p25), 6) } : null
      };
    });
  });
  protected readonly clockHeight = computed(() => 16 + this.clock().length * 30 + 18);
  protected readonly clockSummary = computed(() => this.clock().map((row) => `${row.name} usually at ${row.time}`).join(', '));

  protected readonly shares = computed(() =>
    byMealOrder(this.meals().share).map((row) => ({
      mealType: row.mealType,
      name: mealName(row.mealType),
      pct: formatNumber(row.sharePct),
      delta: row.deltaPoints === null ? '' : `${signed(row.deltaPoints)} points`,
      word: row.deltaPoints === null ? '' : Math.abs(row.deltaPoints) < 1 ? 'steady' : row.deltaPoints > 0 ? 'up' : 'down'
    }))
  );

  protected readonly foods = computed(() => this.nutrition()?.topFoods ?? []);

  protected group(value: string | null) {
    return asFoodGroup(value);
  }
}
