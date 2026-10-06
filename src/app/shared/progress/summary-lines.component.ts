import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { trendWord } from './progress-format';
import { SummaryLine } from './progress.models';

/** Three short lines, each with its trend word in slate on the right, and one line of context under them. */
@Component({
  selector: 'app-summary-lines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lines().length) {
      <ul class="lines">
        @for (line of lines(); track $index) {
          <li class="line">
            <span class="text">@if (line.figure) {<strong>{{ line.figure }}</strong>}{{ (line.figure ? ' ' : '') + line.text }}</span>
            <span class="trend">{{ word(line.trend) }}</span>
          </li>
        }
      </ul>
      @if (context()) {
        <p class="context">{{ context() }}</p>
      }
    } @else {
      <p class="context none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    /* A fact is never cut: when the label and its value do not fit on one line the value drops to its own line, right-aligned. */
    .line { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0 8px; }
    .text { flex: 1 1 auto; min-width: 0; font-size: var(--pg-text); line-height: 18px; color: var(--text-secondary); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    strong { color: var(--text-primary); }
    .trend { margin-left: auto; font-size: var(--pg-control); font-weight: 500; color: var(--text-secondary); white-space: nowrap; }
    .context { margin: 0; padding-top: 4px; border-top: 1px solid var(--border); font-size: var(--pg-chart); color: var(--text-secondary); }
    .none { border: 0; padding: 0; }
  `
})
export class SummaryLinesComponent {
  readonly lines = input.required<readonly SummaryLine[]>();
  readonly context = input('');

  protected word(trend: string): string {
    return trendWord(trend);
  }
}
