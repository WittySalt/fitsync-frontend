import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { EffortLevel } from './plan-draft';

/** Easy, Moderate or Hard: the effort expected, stored as 3, 6 or 8 on the day. */
@Component({
  selector: 'app-plan-effort-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { padding: 7px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-primary); font: inherit; font-size: var(--pg-control); cursor: pointer; }
    .chip.on { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent-text); font-weight: var(--fw-semibold); }
    .chip:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
  `,
  template: `
    <div class="chips" role="group" aria-label="Effort you expect">
      @for (option of options; track option.value) {
        <button type="button" class="chip" [class.on]="option.value === value()" [attr.aria-pressed]="option.value === value()" (click)="choose.emit(option.value)">{{ option.label }}</button>
      }
    </div>
  `
})
export class EffortChipsComponent {
  readonly value = input<EffortLevel | null>(null);
  readonly choose = output<EffortLevel>();

  protected readonly options: ReadonlyArray<{ value: EffortLevel; label: string }> = [
    { value: 'EASY', label: 'Easy' },
    { value: 'MODERATE', label: 'Moderate' },
    { value: 'HARD', label: 'Hard' }
  ];
}
