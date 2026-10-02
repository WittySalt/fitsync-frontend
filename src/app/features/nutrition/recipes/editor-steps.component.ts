import { Component, ElementRef, Injector, afterNextRender, inject, input, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { DragList } from './drag-list';
import { STEPS_MAX, STEP_MAX } from './recipes-editor';
import { findTimer, timerFoundText } from './recipes-timers';
import { ReorderComponent } from './reorder.component';

/**
 * The steps of the recipe being written, one box each, with the same handle as the ingredients to
 * reorder them. When the text of a step names a time next to a cooking word, a line says a timer was
 * found, so the person knows cook mode will offer it; the server works out the same on save.
 */
@Component({
  selector: 'app-editor-steps',
  imports: [FoodGlyphComponent, ReorderComponent],
  template: `
    <h3 id="steps-title">Steps</h3>
    <ol class="steps" aria-labelledby="steps-title">
      @for (step of steps(); track $index; let i = $index; let first = $first; let last = $last) {
        <li [class.over]="drag.over() === i && drag.from() !== i" (dragover)="drag.hover(i, $event)" (drop)="drag.drop(i, $event, relay)">
          <app-reorder [label]="'step ' + (i + 1)" [canUp]="!first" [canDown]="!last" (up)="shift(i, -1)" (down)="shift(i, 1)" (dragStart)="drag.start(i, $event)" (dragEnd)="drag.end()" />
          <span class="number" aria-hidden="true">{{ i + 1 }}</span>
          <div class="body">
            <textarea rows="2" [attr.aria-label]="'Step ' + (i + 1)" [attr.maxlength]="stepMax" [value]="step" (input)="typed(i, $event)"></textarea>
            @if (timerNote(step); as note) {
              <span class="found"><app-food-glyph name="CLOCK" [size]="13" [strokeWidth]="2.2" />{{ note }}</span>
            }
          </div>
          <button class="remove" type="button" [attr.aria-label]="'Remove step ' + (i + 1)" (click)="removed.emit(i)">
            <app-food-glyph name="CLOSE" [size]="16" [strokeWidth]="2.2" />
          </button>
        </li>
      }
    </ol>
    <button class="link" type="button" [disabled]="steps().length >= stepsMax" (click)="added.emit()">+ Add a step</button>
    @if (error(); as message) {
      <em role="alert">{{ message }}</em>
    }
  `,
  styleUrl: './editor-steps.component.scss'
})
export class EditorStepsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly steps = input.required<string[]>();
  readonly error = input<string | null>(null);
  readonly changed = output<{ index: number; text: string }>();
  readonly added = output<void>();
  readonly removed = output<number>();
  readonly moved = output<{ from: number; to: number }>();

  protected readonly stepMax = STEP_MAX;
  protected readonly stepsMax = STEPS_MAX;
  protected readonly drag = new DragList();
  protected readonly relay = (from: number, to: number): void => this.moved.emit({ from, to });

  protected typed(index: number, event: Event): void {
    this.changed.emit({ index, text: (event.target as HTMLTextAreaElement).value });
  }

  protected timerNote(text: string): string | null {
    const timer = findTimer(text);
    return timer ? timerFoundText(timer) : null;
  }

  /** Move up or down from the keyboard; the focus follows the step to its new place. */
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
