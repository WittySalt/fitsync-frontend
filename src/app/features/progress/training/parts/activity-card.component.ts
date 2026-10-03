import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActivityCard } from '../training.models';
import { hm, plural } from '../training-format';
import { KindTileComponent } from './kind-tile.component';
import { StepChartComponent } from './step-chart.component';
import { SummaryLinesComponent } from './summary-lines.component';

/** One activity on the Training page: its three-line summary and total time rising with each session; the card opens the activity page. */
@Component({
  selector: 'app-activity-card',
  imports: [KindTileComponent, RouterLink, StepChartComponent, SummaryLinesComponent],
  template: `
    <a class="card" [routerLink]="['/progress/training/activities', activity().key]" [queryParams]="query()" [attr.aria-label]="activity().name + ', ' + line() + '. Open the activity.'">
      <div class="top">
        <app-kind-tile [kind]="activity().kind" />
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
      </div>
      <div class="titles">
        <strong>{{ activity().name }}</strong>
        <span>{{ line() }}</span>
      </div>
      <app-summary-lines [lines]="activity().summary" [context]="activity().context" />
      <div class="chart">
        <app-step-chart [points]="activity().cumulative" [from]="from()" [to]="to()" [top]="top()" [kind]="activity().kind" />
      </div>
      <span class="caption">Total time, rising with each session</span>
    </a>
  `,
  styleUrl: './activity-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityCardComponent {
  readonly activity = input.required<ActivityCard>();
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly top = input(300);
  readonly period = input('4w');

  protected readonly line = computed(() => `${plural(this.activity().sessions, 'session')} · ${hm(this.activity().minutes)}`);
  protected readonly query = computed(() => (this.period() === '4w' ? null : { period: this.period() }));
}
