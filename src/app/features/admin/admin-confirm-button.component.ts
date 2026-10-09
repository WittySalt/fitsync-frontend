import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

/**
 * A button that asks before it acts: the first press turns it into Confirm and Cancel side by side, and
 * only Confirm emits. The host page keeps the button disabled while the action runs.
 */
@Component({
  selector: 'app-admin-confirm-button',
  template: `
    @if (asking()) {
      <button #confirmButton class="confirm" type="button" [attr.aria-label]="'Confirm ' + label()" (click)="confirm()">Confirm</button>
      <button class="cancel" type="button" [attr.aria-label]="'Cancel ' + label()" (click)="cancel()">Cancel</button>
    } @else {
      <button
        #askButton
        class="ask"
        type="button"
        [disabled]="busy() || disabled()"
        [attr.aria-busy]="busy()"
        (click)="ask()"
      >{{ label() }}</button>
    }
  `,
  styles: `
    @use './admin-button' as button;

    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    button {
      @include button.outline-button;
    }

    .confirm {
      border-color: var(--accent);
      color: var(--text-on-accent);
      background: var(--accent);
    }

    .confirm:hover {
      background: var(--accent-hover);
    }
  `
})
export class AdminConfirmButtonComponent {
  private readonly injector = inject(Injector);

  readonly label = input.required<string>();
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly confirmed = output<void>();

  protected readonly asking = signal(false);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');
  private readonly askButton = viewChild<ElementRef<HTMLButtonElement>>('askButton');

  protected ask(): void {
    if (this.busy() || this.disabled()) {
      return;
    }
    this.asking.set(true);
    afterNextRender(() => this.confirmButton()?.nativeElement.focus(), { injector: this.injector });
  }

  // The state is left before the event is emitted, so a second click on the same button finds nothing to confirm.
  protected confirm(): void {
    if (!this.asking()) {
      return;
    }
    this.asking.set(false);
    this.confirmed.emit();
  }

  protected cancel(): void {
    this.asking.set(false);
    afterNextRender(() => this.askButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
