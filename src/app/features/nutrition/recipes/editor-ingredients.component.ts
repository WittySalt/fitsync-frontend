import { Component, ElementRef, Injector, afterNextRender, inject, input, output } from '@angular/core';

import { FoodSearchResult } from '../../../core/fitsync.models';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { DragList } from './drag-list';
import { IngredientPickerComponent } from './ingredient-picker.component';
import { EditorRow, parseAmount } from './recipes-editor';
import { ReorderComponent } from './reorder.component';
import { StepperComponent } from './stepper.component';

/** How much the plus and minus beside the grams change them. */
export const GRAMS_STEP = 10;

/**
 * The ingredients of the recipe being written: a row for each with a handle to reorder (drag, or
 * Move up and Move down), the food's icon, its name, a grams stepper that can also be typed into,
 * and a remove button; then the search that adds another. The editor owns the rows.
 */
@Component({
  selector: 'app-editor-ingredients',
  imports: [FoodGlyphComponent, FoodIconComponent, IngredientPickerComponent, ReorderComponent, StepperComponent],
  template: `
    <h3 id="ingredients-title">Ingredients</h3>
    <ul class="rows" aria-labelledby="ingredients-title">
      @for (row of rows(); track row.key; let i = $index; let first = $first; let last = $last) {
        <li [class.over]="drag.over() === i && drag.from() !== i" (dragover)="drag.hover(i, $event)" (drop)="drag.drop(i, $event, relay)">
          <app-reorder [label]="row.name" [canUp]="!first" [canDown]="!last" (up)="shift(i, -1)" (down)="shift(i, 1)" (dragStart)="drag.start(i, $event)" (dragEnd)="drag.end()" />
          <app-food-icon [group]="row.group" [categoryCode]="row.categoryCode" [size]="32" />
          <span class="name">{{ row.name }}</span>
          <app-stepper [downLabel]="'Less ' + row.name" [upLabel]="'More ' + row.name" [canDown]="(row.grams ?? 0) > step" (down)="nudge(row, -1)" (up)="nudge(row, 1)">
            <label class="grams">
              <span class="sr-only">Grams of {{ row.name }}</span>
              <input type="text" inputmode="decimal" [value]="row.grams ?? ''" (input)="typed(row.key, $event)" />
              <span aria-hidden="true">g</span>
            </label>
          </app-stepper>
          <button class="remove" type="button" [attr.aria-label]="'Remove ' + row.name" (click)="removed.emit(row.key)">
            <app-food-glyph name="CLOSE" [size]="16" [strokeWidth]="2.2" />
          </button>
        </li>
      }
    </ul>
    <app-ingredient-picker (pick)="picked.emit($event)" />
    @if (adding()) {
      <p class="hint" aria-busy="true">Adding</p>
    }
    @if (error(); as message) {
      <em role="alert">{{ message }}</em>
    }
  `,
  styleUrl: './editor-ingredients.component.scss'
})
export class EditorIngredientsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly rows = input.required<EditorRow[]>();
  readonly adding = input(false);
  /** What is wrong with the ingredients, shown after a Save that failed. */
  readonly error = input<string | null>(null);
  readonly picked = output<FoodSearchResult>();
  readonly removed = output<number>();
  readonly grams = output<{ key: number; grams: number | null }>();
  readonly moved = output<{ from: number; to: number }>();

  protected readonly step = GRAMS_STEP;
  protected readonly drag = new DragList();
  /** The drop calls this unbound, so it is an arrow. */
  protected readonly relay = (from: number, to: number): void => this.moved.emit({ from, to });

  protected typed(key: number, event: Event): void {
    this.grams.emit({ key, grams: parseAmount((event.target as HTMLInputElement).value) });
  }

  protected nudge(row: EditorRow, direction: 1 | -1): void {
    const current = row.grams ?? 0;
    this.grams.emit({ key: row.key, grams: Math.max(GRAMS_STEP, current + direction * GRAMS_STEP) });
  }

  /** Move up or down from the keyboard. The focus follows the row, because moving it in the page drops the focus. */
  protected shift(index: number, direction: 1 | -1): void {
    this.moved.emit({ from: index, to: index + direction });
    afterNextRender(
      () => {
        const target = this.host.nativeElement.querySelectorAll('li')[index + direction];
        const button = target?.querySelector<HTMLButtonElement>(direction < 0 ? '.up' : '.down');
        (button && !button.disabled ? button : target?.querySelector<HTMLButtonElement>(direction < 0 ? '.down' : '.up'))?.focus();
      },
      { injector: this.injector }
    );
  }
}
