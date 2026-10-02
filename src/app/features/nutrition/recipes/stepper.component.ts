import { Component, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';

/** A round minus button, the value in the middle (projected) and a round plus button. */
@Component({
  selector: 'app-stepper',
  imports: [FoodGlyphComponent],
  template: `
    <button type="button" [attr.aria-label]="downLabel()" [disabled]="!canDown()" (click)="down.emit()">
      <app-food-glyph name="MINUS" [size]="16" [strokeWidth]="2.6" />
    </button>
    <span class="mid"><ng-content /></span>
    <button type="button" [attr.aria-label]="upLabel()" [disabled]="!canUp()" (click)="up.emit()">
      <app-food-glyph name="PLUS" [size]="16" [strokeWidth]="2.6" />
    </button>
  `,
  styleUrl: './stepper.component.scss'
})
export class StepperComponent {
  readonly downLabel = input.required<string>();
  readonly upLabel = input.required<string>();
  readonly canDown = input(true);
  readonly canUp = input(true);
  readonly down = output<void>();
  readonly up = output<void>();
}
