import { Component, computed, input, output, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { DrinkWhenComponent } from './drink-when.component';
import { loggedMoment, WATER_AMOUNTS } from './diary-water';

const MAX_ML = 5000;

export interface WaterAdd {
  ml: number;
  at: Date;
}

/** The Water tab of the add dialog: a few common amounts, or any amount typed. */
@Component({
  selector: 'app-drink-water-panel',
  imports: [FoodGlyphComponent, DrinkWhenComponent],
  template: `
    <div class="tiles" role="group" aria-label="Amount of water">
      @for (ml of amounts; track ml) {
        <button type="button" class="tile" [class.selected]="amount() === ml" [attr.aria-pressed]="amount() === ml" (click)="choose(ml)">
          <app-food-glyph [name]="ml >= 500 ? 'BOTTLE' : 'GLASS'" [size]="22" />
          <strong>{{ ml }} ml</strong>
        </button>
      }
    </div>
    <label class="field">
      <span>Another amount</span>
      <span class="input">
        <input type="number" inputmode="numeric" min="1" [max]="max" step="10" [value]="text()" (input)="onType($event)" />
        <span class="unit">ml</span>
      </span>
    </label>
    @if (!valid()) {
      <p class="hint" role="alert">Enter an amount between 1 and 5,000 ml.</p>
    }
    <app-drink-when [date]="date()" [today]="today()" [opened]="opened()" [(clock)]="clock" />
    <button class="add" type="button" [disabled]="!valid() || busy()" (click)="submit()">Add {{ amount() }} ml of water</button>
  `,
  styleUrls: ['./drink-panels.scss', './drink-water-panel.component.scss']
})
export class DrinkWaterPanelComponent {
  readonly date = input.required<string>();
  readonly today = input.required<string>();
  readonly opened = input.required<Date>();
  readonly busy = input(false);
  readonly add = output<WaterAdd>();

  protected readonly amounts = WATER_AMOUNTS;
  protected readonly max = MAX_ML;
  protected readonly amount = signal(250);
  protected readonly text = signal('250');
  protected readonly clock = signal('');
  protected readonly valid = computed(() => Number.isInteger(this.amount()) && this.amount() >= 1 && this.amount() <= MAX_ML);

  protected choose(ml: number): void {
    this.amount.set(ml);
    this.text.set(String(ml));
  }

  protected onType(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    this.amount.set(value.trim() === '' ? Number.NaN : Number(value));
  }

  protected submit(): void {
    if (this.valid() && !this.busy()) {
      this.add.emit({ ml: this.amount(), at: loggedMoment(this.date(), this.clock(), this.today(), new Date()) });
    }
  }
}
