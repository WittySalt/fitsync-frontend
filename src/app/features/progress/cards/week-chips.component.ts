import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { WeekChip } from './page-head';

/**
 * "This week so far" (spec 1.2): one white row of four fact chips and the link that opens the
 * earlier weeks. On phones the row scrolls sideways with the third chip cut by the edge.
 */
@Component({
  selector: 'app-week-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="row" aria-label="This week so far">
      <div class="top">
        <span class="label">This week so far</span>
        <button type="button" class="earlier" (click)="earlier.emit()">Earlier weeks ›</button>
      </div>
      <div class="chips" [attr.aria-busy]="loading()">
        @for (chip of chips(); track chip.key) {
          <div class="chip">
            <span class="chip-label">{{ chip.label }}</span>
            <strong class="chip-figure">{{ loading() ? '' : chip.figure }}</strong>
            <span class="chip-delta">{{ loading() ? '' : chip.delta }}</span>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .row { box-sizing: border-box; padding: 18px 0; border: 1px solid var(--border); border-radius: var(--pg-card-radius); background: var(--surface); overflow: hidden; }
    .top { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; margin-bottom: 12px; }
    .label { font-size: var(--pg-chart); color: var(--text-secondary); }
    .earlier { padding: 0; border: 0; background: none; font: inherit; font-size: var(--pg-control); font-weight: 500; color: var(--text-primary); cursor: pointer; }
    .earlier:hover { text-decoration: underline; text-underline-offset: 3px; }
    .earlier:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
    .chips { display: flex; padding: 0 4px; }
    .chip { flex: 1 1 0; min-width: 0; box-sizing: border-box; padding: 0 20px; display: flex; flex-direction: column; gap: 2px; border-left: 1px solid var(--border); }
    .chip:first-child { border-left: 0; }
    .chip-label, .chip-delta { font-size: var(--pg-chart); color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .chip-delta { min-height: 1.3em; }
    .chip-figure { font: 600 var(--pg-chip-figure) / 1.3 var(--font-display); color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; min-height: 1.3em; }
    @media (max-width: 767px) {
      .top { padding: 0 16px; }
      .chips { overflow-x: auto; scrollbar-width: none; }
      .chips::-webkit-scrollbar { display: none; }
      .chip { flex: 0 0 150px; padding: 0 16px; }
    }
  `
})
export class WeekChipsComponent {
  readonly chips = input.required<readonly WeekChip[]>();
  readonly loading = input(false);
  readonly earlier = output<void>();
}
