import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A small row of toggle buttons, one pressed: the series switch and the 1M / 3M / 1Y switch. */
@Component({
  selector: 'app-segmented',
  template: `
    <div class="seg" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button type="button" [class.on]="option.value === value()" [attr.aria-pressed]="option.value === value()" (click)="picked.emit(option.value)">{{ option.label }}</button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 12px; background: var(--surface-sunken); }
      button { height: 28px; padding: 0 10px; border: 0; border-radius: 9px; background: none; font: inherit; font-size: 13px; font-weight: var(--fw-bold); color: var(--text-secondary); cursor: pointer; }
      button.on { background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow-xs); }
      button:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SegmentedComponent {
  readonly options = input<readonly { value: string; label: string }[]>([]);
  readonly value = input('');
  readonly label = input('');
  readonly picked = output<string>();
}
