import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface InkOption {
  value: string;
  label: string;
}

/**
 * A choice among a few words, written as ink text: the current one in ink and underlined 2 px, the
 * others in slate. It is the period switch of every Progress page and the range of the weight chart.
 */
@Component({
  selector: 'app-ink-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="switch" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button type="button" [class.on]="option.value === value()" [attr.aria-pressed]="option.value === value()" (click)="picked.emit(option.value)">{{ option.label }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; }
    .switch { display: inline-flex; flex-wrap: wrap; gap: 0 20px; align-items: center; }
    button { padding: 4px 0; border: 0; background: none; font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); white-space: nowrap; cursor: pointer; }
    button:hover { color: var(--text-primary); }
    button.on { color: var(--text-primary); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 6px; }
    button:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; border-radius: 4px; }
  `
})
export class InkSwitchComponent {
  readonly options = input.required<readonly InkOption[]>();
  readonly value = input.required<string>();
  readonly label = input('Period');
  readonly picked = output<string>();
}
