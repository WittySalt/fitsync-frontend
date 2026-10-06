import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { WeekCell } from './badge-model';

/** The seven days of a week with the trained ones filled green; `large` adds the weekday names. */
@Component({
  selector: 'app-week-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol [class.large]="large()" [attr.aria-label]="'Days trained in this week'">
      @for (cell of cells(); track cell.date) {
        <li [class.trained]="cell.trained">
          @if (large()) {
            <span class="weekday">{{ cell.weekday }}</span>
          }
          <span class="cell">
            @if (cell.trained) {
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
              <span class="visually-hidden">Trained</span>
            }
          </span>
          <span class="day">{{ cell.day }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    ol { display: grid; grid-template-columns: repeat(7, 22px); gap: 4px; margin: 0; padding: 0; list-style: none; }
    ol.large { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
    li { display: grid; justify-items: center; gap: 4px; }
    .cell { display: grid; place-items: center; width: 100%; height: 22px; border-radius: 6px; background: var(--surface-sunken); color: var(--text-on-accent); }
    .large .cell { height: 40px; border-radius: 10px; }
    .trained .cell { background: var(--accent); }
    .weekday, .day { font-size: var(--pg-eyebrow); color: var(--text-secondary); }
    .large .weekday, .large .day { font-size: var(--pg-chart); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `
})
export class WeekStripComponent {
  readonly cells = input.required<readonly WeekCell[]>();
  readonly large = input(false);
}
