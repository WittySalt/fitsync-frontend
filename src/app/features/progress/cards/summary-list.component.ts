import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { trendWord } from '../../../shared/progress/progress-format';
import { SummaryLine } from '../../../shared/progress/progress.models';
import { ReadingLine } from './card-readings';

/** The three summary lines of a card: 14 px text, the trend word in 13 px slate at the right. */
@Component({
  selector: 'app-summary-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lines().length) {
      <ul>
        @for (line of lines(); track $index) {
          <li>
            <span class="text">@if (line.figure) {<strong>{{ line.figure }}</strong>}{{ line.figure && line.text ? ' ' : '' }}{{ line.text }}</span>
            <span class="trend" [class.amber]="line.amber">{{ word(line.trend) }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline; }
    .text { font-size: var(--pg-text); line-height: 1.45; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    strong { font-weight: 600; color: var(--text-primary); }
    .trend { font-size: var(--pg-control); font-weight: 500; color: var(--text-secondary); }
    .trend.amber { color: var(--amber-700, #b45309); }
    .none { margin: 0; font-size: var(--pg-text); color: var(--text-secondary); }
  `
})
export class SummaryListComponent {
  readonly lines = input.required<readonly (SummaryLine & ReadingLine)[]>();

  protected word(trend: string): string {
    return trendWord(trend);
  }
}
