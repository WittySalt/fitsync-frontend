import { Component, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';

/**
 * The handle of a row that can be moved: a grip to drag with the mouse or a finger, and Move up and
 * Move down buttons so the order can be changed from the keyboard and with a screen reader too.
 * The list owns the drop and the move; this only reports.
 */
@Component({
  selector: 'app-reorder',
  imports: [FoodGlyphComponent],
  template: `
    <span class="grip" aria-hidden="true" draggable="true" (dragstart)="dragStart.emit($event)" (dragend)="dragEnd.emit()">
      <app-food-glyph name="DRAG" [size]="16" [strokeWidth]="2.4" />
    </span>
    @if (arrows()) {
      <button type="button" class="up" [attr.aria-label]="'Move ' + label() + ' up'" [disabled]="!canUp()" (click)="up.emit()">
        <app-food-glyph name="CHEVRON_UP" [size]="14" [strokeWidth]="2.6" />
      </button>
      <button type="button" class="down" [attr.aria-label]="'Move ' + label() + ' down'" [disabled]="!canDown()" (click)="down.emit()">
        <app-food-glyph name="CHEVRON_DOWN" [size]="14" [strokeWidth]="2.6" />
      </button>
    }
  `,
  styleUrl: './reorder.component.scss'
})
export class ReorderComponent {
  /** What is being moved, for the buttons' names: "Rolled oats" or "step 2". */
  readonly label = input.required<string>();
  /** Show the Move up and Move down buttons. A list that keeps them elsewhere turns them off and keeps the grip. */
  readonly arrows = input(true);
  readonly canUp = input(true);
  readonly canDown = input(true);
  readonly up = output<void>();
  readonly down = output<void>();
  readonly dragStart = output<DragEvent>();
  readonly dragEnd = output<void>();
}
