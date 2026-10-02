import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FrequentDrink, WaterDay } from './diary.models';
import { BOTTLE_ML, GLASS_ML, progressShares, timelineMarks, waterTotals } from './diary-water';
import { whole } from './diary-figures';
import { WaterTimelineComponent } from './water-timeline.component';

/**
 * Water for the day: how much of the goal is reached by plain water and by drinks, when each drink
 * was had, and one-tap buttons for a glass, a bottle and the person's two most frequent drinks.
 */
@Component({
  selector: 'app-water-card',
  imports: [FoodGlyphComponent, WaterTimelineComponent, RouterLink],
  template: `
    <div class="head">
      <span class="eyebrow">Water</span>
      <span class="total">
        <strong>{{ whole(totals().totalMl) }}</strong>
        @if (goal() !== null) {
          of {{ whole(goal() ?? 0) }} ml
        } @else {
          ml
        }
      </span>
    </div>
    @if (!shares()) {
      <a class="set" routerLink="/settings">Set a daily goal</a>
    }
    @if (shares(); as share) {
      <div
        class="progress"
        role="progressbar"
        aria-label="Water towards the daily goal"
        aria-valuemin="0"
        [attr.aria-valuemax]="goal()"
        [attr.aria-valuenow]="totals().totalMl"
      >
        <span class="plain" [style.width.%]="share.plain"></span>
        <span class="drinks" [style.width.%]="share.drinks"></span>
      </div>
    }
    <div class="key">
      <span><i class="dot plain"></i>{{ whole(totals().plainMl) }} ml water</span>
      @if (totals().drinksMl !== null) {
        <span><i class="dot drinks"></i>{{ whole(totals().drinksMl ?? 0) }} ml from drinks</span>
      }
    </div>
    <app-water-timeline [marks]="marks()" [nowPercent]="nowPercent()" />
    <div class="quick">
      <button type="button" [disabled]="busy()" (click)="glass.emit()">
        <span class="tile water"><app-food-glyph name="GLASS" [size]="17" /></span>
        <span class="words"><strong>Glass</strong><span>{{ glassMl }} ml</span></span>
      </button>
      <button type="button" [disabled]="busy()" (click)="bottle.emit()">
        <span class="tile water"><app-food-glyph name="BOTTLE" [size]="17" /></span>
        <span class="words"><strong>Bottle</strong><span>{{ bottleMl }} ml</span></span>
      </button>
      @for (drink of frequent(); track $index) {
        <button type="button" [disabled]="busy()" (click)="quickDrink.emit(drink)">
          <span class="tile drinks"><app-food-glyph name="DRINKS" [size]="17" /></span>
          <span class="words"><strong>{{ drink.name }}</strong><span>{{ drink.calories }} kcal</span></span>
        </button>
      }
    </div>
    <button class="another" type="button" [disabled]="busy()" (click)="another.emit()">Another amount or drink</button>
  `,
  styleUrl: './water-card.component.scss'
})
export class WaterCardComponent {
  readonly day = input.required<WaterDay>();
  /** The daily water goal in ml, or null when the person has not set one. */
  readonly goal = input<number | null>(null);
  readonly frequent = input<FrequentDrink[]>([]);
  /** How far the day has gone as a percentage of 6:00 to 22:00, for today only. */
  readonly nowPercent = input<number | null>(null);
  readonly busy = input(false);
  readonly glass = output<void>();
  readonly bottle = output<void>();
  readonly quickDrink = output<FrequentDrink>();
  readonly another = output<void>();

  protected readonly whole = whole;
  protected readonly glassMl = GLASS_ML;
  protected readonly bottleMl = BOTTLE_ML;

  protected readonly totals = computed(() => waterTotals(this.day()));
  protected readonly shares = computed(() => progressShares(this.totals().plainMl, this.totals().drinksMl, this.goal()));
  protected readonly marks = computed(() => timelineMarks(this.day()));
}
