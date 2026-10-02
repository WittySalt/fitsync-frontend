import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { NutrientSummary } from './diary.models';
import { coverageLine, noVitaminData } from './vitamins-today';
import { WeekCell, WeekRow, patternLine, weekNote, weekRange, weekRows } from './vitamins-week';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SCALE = [0.18, 0.4, 0.62, 0.84, 1];

/**
 * The This week view of the vitamins card: one row per nutrient with a square for each day of the
 * week, lowest average first, so a pattern across days can be seen.
 */
@Component({
  selector: 'app-vitamins-week',
  imports: [FoodGlyphComponent],
  template: `
    @if (summary().daysLogged === 0 || summary().nutrients.length === 0) {
      <p class="empty">Log some food to see your vitamins and minerals.</p>
    } @else if (noData()) {
      <p class="empty">None of the foods logged this week have vitamin data yet.</p>
    } @else {
      <div class="grid">
        <div class="line">
          <span></span>
          @for (date of range().dates; track date; let index = $index) {
            <span class="letter" [class.today]="date === today()">{{ letters[index] }}</span>
          }
          <span class="avg">Avg</span>
        </div>
        @for (item of rows(); track item.row.code) {
          <div class="line">
            <span class="name">{{ item.row.displayName }}</span>
            @for (cell of item.cells; track cell.date) {
              <span
                class="sq"
                role="img"
                [class.empty]="cell.state !== 'value'"
                [class.today]="cell.today"
                [style.background]="fill(item, cell)"
                [attr.aria-label]="label(item, cell)"
                [attr.title]="label(item, cell)"
              >
                @if (cell.reached) {
                  <app-food-glyph name="CHECK" [size]="14" [strokeWidth]="3" />
                }
              </span>
            }
            <span class="value" [class.met]="item.average !== null && item.average >= 1">
              @if (item.percent === null) {
                &ndash;
              } @else {
                @if (item.average !== null && item.average >= 1) {
                  <app-food-glyph name="CHECK" [size]="10" [strokeWidth]="3" />
                }
                {{ item.percent }}%
              }
            </span>
          </div>
        }
      </div>
      <div class="legend">
        <span class="key">
          none
          @for (step of scale; track step) {
            <i class="swatch" [style.background]="tone(step)"></i>
          }
          full day
        </span>
        <span class="key"><app-food-glyph name="CHECK" [size]="12" [strokeWidth]="3" />reached</span>
        <span class="key"><i class="swatch ring"></i>today</span>
      </div>
      @if (pattern()) {
        <p class="pattern">{{ pattern() }}</p>
      }
      @if (coverage()) {
        <p class="coverage">{{ coverage() }}</p>
      }
      <p class="note">{{ note() }}</p>
    }
  `,
  styleUrl: './vitamins-week.component.scss'
})
export class VitaminsWeekComponent {
  readonly summary = input.required<NutrientSummary>();
  /** The day selected on the page. The week shown is the one that holds it. */
  readonly date = input.required<string>();
  readonly today = input.required<string>();

  protected readonly letters = LETTERS;
  protected readonly scale = SCALE;

  protected readonly range = computed(() => weekRange(this.date()));
  protected readonly rows = computed(() => weekRows(this.summary().nutrients, this.range().dates, this.today()));
  protected readonly noData = computed(() => noVitaminData(this.summary()));
  protected readonly pattern = computed(() => patternLine(this.rows()[0]));
  protected readonly coverage = computed(() => coverageLine(this.summary()));
  protected readonly note = computed(() => weekNote(this.range().dates, this.today(), this.summary().referenceLabel));

  /** The vitamin colour (fruit) or the mineral colour (dairy) at the strength of the day's share. */
  protected tone(opacity: number, kind: 'VITAMIN' | 'MINERAL' | 'OTHER' = 'VITAMIN'): string {
    const colour = kind === 'MINERAL' ? 'var(--food-dairy)' : 'var(--food-fruit)';
    return `color-mix(in srgb, ${colour} ${Math.round(opacity * 100)}%, transparent)`;
  }

  protected fill(item: WeekRow, cell: WeekCell): string | null {
    return cell.state === 'value' ? this.tone(cell.opacity, item.row.kind) : null;
  }

  protected label(item: WeekRow, cell: WeekCell): string {
    const what = cell.state === 'value' ? `${Math.round((cell.share ?? 0) * 100)}% of the daily amount` : cell.state === 'future' ? 'not yet' : 'nothing logged';
    return `${item.row.displayName}, ${cell.weekday}: ${what}`;
  }
}
