import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TrainingKind } from '../training.models';
import { weekBars } from '../activity/activity-geometry';

/**
 * Minutes each week as bars with every value written and "so far" under the current week.
 * Private copy of the shared `app-week-bars` (contract 5).
 */
@Component({
  selector: 'app-week-bars',
  template: `
    @if (chart(); as c) {
      <svg [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height" role="img" [attr.aria-label]="label()">
        <text x="0" y="10" class="unit">min</text>
        @for (line of c.grid; track $index) {
          <line class="grid" [attr.x1]="c.x0 - 4" [attr.x2]="c.width" [attr.y1]="line.y" [attr.y2]="line.y"></line>
          <text [attr.x]="c.x0 - 8" [attr.y]="line.y" text-anchor="end" dominant-baseline="central">{{ line.label }}</text>
        }
        @for (bar of c.bars; track $index) {
          <rect [class]="bar.empty ? 'none' : kind().toLowerCase()" [class.current]="bar.current" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="5"></rect>
          <text [class.ink]="!bar.empty" [attr.x]="bar.value.x" [attr.y]="bar.value.y" text-anchor="middle">{{ bar.value.text }}</text>
          @if (bar.label; as text) {
            <text [attr.x]="text.x" [attr.y]="text.y" [attr.text-anchor]="text.anchor">{{ text.text }}</text>
          }
        }
        @if (c.soFar; as soFar) {
          <text class="ink" [attr.x]="soFar.x" [attr.y]="soFar.y" [attr.text-anchor]="soFar.anchor">{{ soFar.text }}</text>
        }
      </svg>
    }
  `,
  styleUrl: './week-bars.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeekBarsComponent {
  readonly weeks = input<readonly { weekStart: string; minutes: number; current: boolean }[]>([]);
  readonly kind = input<TrainingKind>('SPORT');
  readonly compact = input(false);

  protected readonly chart = computed(() => weekBars(this.weeks(), this.compact() ? 340 : 640, 170));
  protected readonly label = computed(() => `Minutes each week, ${this.weeks().length} weeks, ${this.weeks().map((week) => Math.round(week.minutes)).join(', ')}`);
}
