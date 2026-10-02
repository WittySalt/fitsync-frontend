import { Component, ElementRef, HostListener, Injector, afterNextRender, inject, input, output, viewChild } from '@angular/core';

/**
 * A question that needs a yes before something is done. The safe answer has the focus when it opens,
 * Escape and the backdrop cancel it, and a destructive confirm is drawn in the danger colour.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="backdrop" (click)="cancelled.emit()" aria-hidden="true"></div>
    <div class="panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <h2 id="confirm-title">{{ title() }}</h2>
      <p id="confirm-message">{{ message() }}</p>
      <div class="actions">
        <button #cancel class="cancel" type="button" [disabled]="busy()" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
        <button class="confirm" [class.danger]="danger()" type="button" [disabled]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  /** Draws the confirm button in the danger colour, for a delete. */
  readonly danger = input(false);
  /** Disables both buttons while the answer is being carried out. */
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancel');

  constructor() {
    afterNextRender(() => this.cancelButton()?.nativeElement.focus(), { injector: inject(Injector) });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
