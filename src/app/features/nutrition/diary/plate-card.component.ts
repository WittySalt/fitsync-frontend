import { Component, computed, input } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodGroup, foodGroupInfo } from '../../../shared/food/food-groups';
import { DiaryItem } from './diary.models';
import { badgeNote, fruitVegSentence, groupBadges, plateLegend, plateTotals, plateWedges } from './diary-plate';
import { whole } from './diary-figures';
import { PlateChartComponent, toWedgeViews } from './plate-chart.component';

const PLATE_SIZE = 216;

/**
 * The day's food by weight as a drawn plate, with a legend, one sentence that sets fruit and veg
 * against half a plate, and a badge for each of the seven food groups eaten. Drinks count in water,
 * so they are not on the plate. Foods without a weight are left off and the card says how many.
 */
@Component({
  selector: 'app-plate-card',
  imports: [PlateChartComponent, FoodGlyphComponent],
  template: `
    <div class="head">
      <span class="eyebrow">{{ isToday() ? "Today's plate" : "The day's plate" }}</span>
      @if (totals().totalGrams > 0) {
        <span class="grams">{{ whole(totals().totalGrams) }} g of food, by weight</span>
      }
    </div>
    @if (!items().length) {
      <p class="empty">Nothing is logged yet, so there is no plate to draw.</p>
    } @else if (!wedges().length) {
      <p class="empty">None of this food has a weight and a food group yet, so there is no plate to draw.</p>
    } @else {
      <div class="plate-row">
        <app-plate-chart [wedges]="wedgeViews()" [size]="size" />
        <div class="side">
          <ul class="legend">
            @for (entry of legend(); track entry.group) {
              <li>
                <i [style.background]="colour(entry.group)"></i>
                <span class="name">{{ entry.label }}</span>
                <span class="percent">{{ entry.percent }}%</span>
              </li>
            }
          </ul>
          <p class="sentence">{{ sentence() }}</p>
          <p class="aside">The dashed lines show a balanced plate.</p>
        </div>
      </div>
    }
    @if (totals().leftOut > 0) {
      <p class="left-out">
        {{ totals().leftOut }} {{ totals().leftOut === 1 ? 'food is' : 'foods are' }} left off the plate because
        {{ totals().leftOut === 1 ? 'it has' : 'they have' }} no weight or food group.
      </p>
    }
    @if (items().length) {
      <div class="badges-block">
        <div class="badges-head">
          <strong>{{ eatenCount() }} of 7 food groups {{ isToday() ? 'today' : 'that day' }}</strong>
          @if (note()) {
            <span>{{ note() }}</span>
          }
        </div>
        <ul class="badges">
          @for (badge of badges(); track badge.group) {
            <li [class.eaten]="badge.eaten" [style.--tone]="colour(badge.group)">
              <span class="disc"><app-food-glyph [name]="icon(badge.group)" [size]="20" /></span>
              <span class="short">{{ badge.name }}</span>
              <span class="visually-hidden">{{ badge.eaten ? 'eaten' : 'not eaten' }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './plate-card.component.scss'
})
export class PlateCardComponent {
  readonly items = input.required<DiaryItem[]>();
  readonly isToday = input(true);

  protected readonly size = PLATE_SIZE;
  protected readonly whole = whole;

  protected readonly totals = computed(() => plateTotals(this.items()));
  protected readonly wedges = computed(() => plateWedges(this.totals(), PLATE_SIZE));
  protected readonly wedgeViews = computed(() => toWedgeViews(this.wedges()));
  protected readonly legend = computed(() => plateLegend(this.wedges()));
  protected readonly sentence = computed(() => fruitVegSentence(this.totals()));
  protected readonly badges = computed(() => groupBadges(this.items()));
  protected readonly eatenCount = computed(() => this.badges().filter((badge) => badge.eaten).length);
  protected readonly note = computed(() => badgeNote(this.badges()));

  protected colour(group: FoodGroup): string {
    return foodGroupInfo(group)?.colour ?? 'var(--text-secondary)';
  }

  protected icon(group: FoodGroup): string {
    return foodGroupInfo(group)?.icon ?? '';
  }
}
