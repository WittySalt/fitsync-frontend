import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { PERIODS, PeriodCode } from '../training-period';

/** 4 weeks, 3 months or 1 year: the period of a Training page, kept in the URL by the page. */
@Component({
  selector: 'app-period-switch',
  template: `
    <div class="switch" role="group" aria-label="Period">
      @for (option of options; track option.code) {
        <button type="button" [class.on]="option.code === code()" [attr.aria-pressed]="option.code === code()" (click)="changed.emit(option.code)">{{ option.label }}</button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: flex; justify-content: flex-end; }
      .switch { display: inline-flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--surface-sunken); }
      button { height: 28px; padding: 0 10px; border: 0; border-radius: 9px; background: none; font: inherit; font-size: 13px; font-weight: var(--fw-bold); color: var(--text-secondary); cursor: pointer; }
      button.on { background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow-xs); }
      button:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
      @media (max-width: 600px) { :host, .switch { display: flex; } .switch { flex: 1; } button { flex: 1 1 0; height: 30px; } }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodSwitchComponent {
  readonly code = input<PeriodCode>('4w');
  readonly changed = output<PeriodCode>();

  protected readonly options = PERIODS;
}
