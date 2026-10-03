import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SummaryLine, Trend } from '../training.models';

const WORDS: Record<Trend, string> = { UP: 'up', STEADY: 'steady', DOWN: 'down' };

/**
 * Three lines with a trend word each, in slate, and one line of context under them. Private copy
 * of the shared `app-summary-lines` (contract 5).
 */
@Component({
  selector: 'app-summary-lines',
  template: `
    <ul class="lines">
      @for (line of lines().slice(0, 3); track $index) {
        <li>
          <span class="text">{{ line.text }}</span>
          <span class="trend">{{ word(line.trend) }}</span>
        </li>
      }
    </ul>
    @if (context()) {
      <p class="context">{{ context() }}</p>
    }
  `,
  styleUrl: './summary-lines.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryLinesComponent {
  readonly lines = input<readonly SummaryLine[]>([]);
  readonly context = input('');

  protected word(trend: Trend): string {
    return WORDS[trend] ?? 'steady';
  }
}
