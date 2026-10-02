import { Component, ElementRef, HostListener, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { DrinkAdd, DrinkDrinkPanelComponent } from './drink-drink-panel.component';
import { DrinkWaterPanelComponent, WaterAdd } from './drink-water-panel.component';

/**
 * Add a drink: a dialog on a computer and a sheet rising from the bottom on a phone. The Water tab
 * logs plain water, the Drink tab a drink from the catalogue. The page does the saving.
 */
@Component({
  selector: 'app-add-drink-dialog',
  imports: [FoodGlyphComponent, DrinkWaterPanelComponent, DrinkDrinkPanelComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <div #panel class="panel" role="dialog" aria-modal="true" aria-labelledby="add-drink-title" tabindex="-1">
      <span class="grabber" aria-hidden="true"></span>
      <div class="head">
        <h2 id="add-drink-title">Add a drink</h2>
        <button class="close" type="button" aria-label="Close" (click)="closed.emit()">
          <app-food-glyph name="CLOSE" [size]="18" [strokeWidth]="2.2" />
        </button>
      </div>
      <div class="tabs" role="tablist" aria-label="What to add">
        <button type="button" role="tab" [class.active]="tab() === 'water'" [attr.aria-selected]="tab() === 'water'" (click)="tab.set('water')">Water</button>
        <button type="button" role="tab" [class.active]="tab() === 'drink'" [attr.aria-selected]="tab() === 'drink'" (click)="tab.set('drink')">Drink</button>
      </div>
      @if (tab() === 'water') {
        <app-drink-water-panel [date]="date()" [today]="today()" [opened]="opened" [busy]="busy()" (add)="addWater.emit($event)" />
      } @else {
        <app-drink-drink-panel [date]="date()" [today]="today()" [opened]="opened" [busy]="busy()" (add)="addDrink.emit($event)" />
      }
    </div>
  `,
  styleUrl: './add-drink-dialog.component.scss'
})
export class AddDrinkDialogComponent {
  /** The day the drink is for, "YYYY-MM-DD". */
  readonly date = input.required<string>();
  readonly today = input.required<string>();
  readonly busy = input(false);
  readonly closed = output<void>();
  readonly addWater = output<WaterAdd>();
  readonly addDrink = output<DrinkAdd>();

  protected readonly tab = signal<'water' | 'drink'>('water');
  protected readonly opened = new Date();
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: inject(Injector) });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
