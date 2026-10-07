import { Component, input, output } from '@angular/core';

import { HowThisWorksComponent } from '../../../core/guide/how-this-works.component';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';

/**
 * A slim bar above the photo card: Exit on the left, through the same leave guard as the browser's
 * Back button, and where the cook is on the right. On a phone it stays at the top of the screen.
 */
@Component({
  selector: 'app-cook-topbar',
  imports: [FoodGlyphComponent, HowThisWorksComponent],
  template: `
    <button type="button" class="exit" aria-label="Exit cooking" (click)="exited.emit()">
      <app-food-glyph name="CLOSE" [size]="16" [strokeWidth]="2.4" />Exit
    </button>
    <span class="tools">
      <span class="count">Step {{ step() }} of {{ steps() }}</span>
      <app-how-this-works surface="nutrition-cook" />
    </span>
  `,
  styleUrl: './cook-topbar.component.scss'
})
export class CookTopbarComponent {
  /** The step on screen, counting from 1. */
  readonly step = input.required<number>();
  readonly steps = input.required<number>();
  readonly exited = output<void>();
}
