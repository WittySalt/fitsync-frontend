import { Component, ElementRef, OnDestroy, afterNextRender, input, output, viewChild } from '@angular/core';

let nextModalId = 0;

/**
 * A small modal on the native dialog element, which traps focus, answers Escape and keeps the page
 * behind it still. It remembers what had focus when it opened and gives it back when it goes.
 */
@Component({
  selector: 'app-workout-modal',
  template: `
    <dialog
      #dialog
      class="modal"
      [attr.aria-labelledby]="titleId"
      (cancel)="onCancel($event)"
    >
      <div class="card">
        <h2 [id]="titleId">{{ heading() }}</h2>
        <ng-content />
      </div>
    </dialog>
  `,
  styleUrl: './workout-modal.component.scss'
})
export class WorkoutModalComponent implements OnDestroy {
  readonly heading = input.required<string>();
  /** Escape. The dialog's owner decides what that means. */
  readonly dismissed = output<void>();

  protected readonly titleId = `workout-modal-title-${nextModalId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly returnFocusTo = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  constructor() {
    afterNextRender(() => {
      const element = this.dialog().nativeElement;
      if (!element.open) {
        element.showModal();
      }
    });
  }

  ngOnDestroy(): void {
    const element = this.dialog().nativeElement;
    if (element.open) {
      element.close();
    }
    if (this.returnFocusTo?.isConnected) {
      this.returnFocusTo.focus();
    }
  }

  protected onCancel(event: Event): void {
    // The owner removes the dialog; closing it here would leave a stale element behind.
    event.preventDefault();
    this.dismissed.emit();
  }
}
