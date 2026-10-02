import { Component, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { stepState } from './cook-recipe';
import { CookStep } from './cook.models';

/** "All steps": a title per step, done steps ticked, the current one lit and the next ones dimmed. */
@Component({
  selector: 'app-cook-steps',
  imports: [FoodGlyphComponent],
  template: `
    <h2 class="eyebrow">All steps</h2>
    <ol>
      @for (step of steps(); track step.number; let i = $index) {
        @let state = stateOf(i);
        <li [class]="state">
          <button type="button" [attr.aria-current]="state === 'now' ? 'step' : null" (click)="jumped.emit(i)">
            <span class="dot">
              @if (state === 'done') {
                <app-food-glyph name="CHECK" [size]="13" [strokeWidth]="3" />
              } @else {
                {{ step.number }}
              }
            </span>
            <span class="title">{{ step.title }}</span>
          </button>
        </li>
      }
    </ol>
  `,
  styleUrl: './cook-steps.component.scss'
})
export class CookStepsComponent {
  readonly steps = input.required<CookStep[]>();
  readonly current = input.required<number>();
  readonly jumped = output<number>();

  protected stateOf(index: number) {
    return stepState(index, this.current());
  }
}
