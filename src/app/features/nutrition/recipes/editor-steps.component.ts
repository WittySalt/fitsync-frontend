import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { DragList } from './drag-list';
import { STEPS_MAX, STEP_MAX } from './recipes-editor';
import { findTimer, timerFoundText, timerLabel } from './recipes-timers';
import { ReorderComponent } from './reorder.component';

/**
 * The steps of the recipe being written, one box each, with the same handle as the ingredients to
 * reorder them. The Move up and Move down buttons sit inside the row being edited and nowhere else,
 * so a closed row stays handle, number, text, remove. When the text of a step names a time next to a
 * cooking word, a line says a timer was
 * found, so the person knows cook mode will offer it; the server works out the same on save.
 */
@Component({
  selector: 'app-editor-steps',
  imports: [FoodGlyphComponent, ReorderComponent],
  template: `
    <h3 id="steps-title">Steps</h3>
    <ol class="steps" aria-labelledby="steps-title">
      @for (step of steps(); track $index; let i = $index; let first = $first; let last = $last) {
        <li [class.over]="drag.over() === i && drag.from() !== i" [class.open]="open() === i" (focusin)="open.set(i)" (focusout)="leave($event, i)" (dragover)="drag.hover(i, $event)" (drop)="drag.drop(i, $event, relay)">
          <app-reorder [label]="'step ' + (i + 1)" [arrows]="false" (dragStart)="drag.start(i, $event)" (dragEnd)="drag.end()" />
          <span class="number" aria-hidden="true">{{ i + 1 }}</span>
          <div class="body">
            <textarea rows="2" [attr.aria-label]="'Step ' + (i + 1)" [attr.maxlength]="stepMax" [value]="step" (input)="typed(i, $event)"></textarea>
            @if (open() === i) {
              <div class="move" role="group" [attr.aria-label]="'Move step ' + (i + 1)">
                <button type="button" class="up" [attr.aria-label]="'Move step ' + (i + 1) + ' up'" [disabled]="first" (click)="shift(i, -1)">
                  <app-food-glyph name="CHEVRON_UP" [size]="14" [strokeWidth]="2.6" />
                </button>
                <button type="button" class="down" [attr.aria-label]="'Move step ' + (i + 1) + ' down'" [disabled]="last" (click)="shift(i, 1)">
                  <app-food-glyph name="CHEVRON_DOWN" [size]="14" [strokeWidth]="2.6" />
                </button>
              </div>
            }
            @if (timerNote(step, i); as note) {
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
  /** The row being edited, the only one that shows its Move buttons. */
  protected readonly open = signal<number | null>(null);
  protected readonly drag = new DragList();
  protected readonly relay = (from: number, to: number): void => this.moved.emit({ from, to });

  /** Closes a row when the focus leaves it for somewhere outside it. */
  protected leave(event: FocusEvent, index: number): void {
    const row = event.currentTarget as HTMLElement;
    if (!row.contains(event.relatedTarget as Node | null) && this.open() === index) {
      this.open.set(null);
    }
  }

  protected typed(index: number, event: Event): void {
    this.changed.emit({ index, text: (event.target as HTMLTextAreaElement).value });
  }

  /** "A 5 min timer was found · Simmer the sauce": the same name cook mode shows for the timer. */
  protected timerNote(text: string, index: number): string | null {
    const timer = findTimer(text);
    return timer ? `${timerFoundText(timer)} · ${timerLabel(text, { stepNumber: index + 1 })}` : null;
  }

  /** Move up or down from the keyboard; the focus follows the step to its new place. */
  protected shift(index: number, direction: 1 | -1): void {
    this.open.set(index + direction);
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
