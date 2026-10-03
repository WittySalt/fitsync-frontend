import { Component, ElementRef, Injector, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

export const DEFAULT_REJECT_REASON = 'Not for me today';

/**
 * The reason form shown when a draft is set aside: one optional line, prefilled so a single press
 * of the confirm is enough. Red is used for the confirm alone, the one button that sets something aside.
 */
@Component({
  selector: 'app-plan-reject',
  template: `
    <form (submit)="$event.preventDefault(); confirm.emit(text())">
      <label for="reject-reason">Reason, if you want to say (optional)</label>
      <input #field id="reject-reason" type="text" maxlength="500" autocomplete="off" [value]="text()" (input)="text.set(field.value)" />
      <div class="actions">
        <button class="button danger" type="submit">Set it aside</button>
        <button class="button secondary" type="button" (click)="cancel.emit()">Keep it</button>
      </div>
    </form>
  `,
  styles: [
    `
      form {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      label {
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--text-primary);
      }
      input {
        min-width: 0;
        min-height: 44px;
        box-sizing: border-box;
        padding: 9px 10px;
        font-size: var(--text-sm);
        color: var(--text-primary);
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
      }
      .actions {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
      }
      .danger {
        background: var(--danger);
        border-color: var(--danger);
        color: var(--white);
      }
      .danger:hover {
        background: var(--danger-hover);
      }
      :host-context([data-theme='dark']) .danger {
        color: var(--slate-900);
      }
      @media (prefers-color-scheme: dark) {
        :host-context(:root:not([data-theme='light'])) .danger {
          color: var(--slate-900);
        }
      }
    `
  ]
})
export class PlanRejectComponent {
  readonly confirm = output<string>();
  readonly cancel = output<void>();
  protected readonly text = signal(DEFAULT_REJECT_REASON);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly injector = inject(Injector);

  constructor() {
    afterNextRender(() => this.field()?.nativeElement.select(), { injector: this.injector });
  }
}
