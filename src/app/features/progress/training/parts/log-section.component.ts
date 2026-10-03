import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { DetailSectionComponent } from '../../../../shared/progress';
import { CalendarDay } from '../training.models';
import { rangeLabel } from '../training-format';
import { logStats } from './calendar-grid';
import { TrainingCalendarComponent } from './training-calendar.component';

/** The training log: the month calendar over the period, with four figures worked out from it. */
@Component({
  selector: 'app-log-section',
  imports: [DetailSectionComponent, TrainingCalendarComponent],
  template: `
    <app-detail-section name="Training log" anchor="log" [sentence]="sentence()" [context]="card()" ask="Which days do I train and where are my breaks? Each day in the calendar opens its session, the same page as Workout History.">
      @if (days().length) {
        <div class="layout">
          <app-training-calendar [from]="from()" [to]="to()" [days]="days()" />
          <div class="side">
            @if (stats(); as figures) {
              <dl class="tiles">
                <div><dt>Days trained</dt><dd>{{ figures.daysTrained }}</dd></div>
                <div><dt>Longest break</dt><dd>{{ figures.longestBreak }}</dd></div>
                <div><dt>Most regular</dt><dd>{{ figures.mostRegular }}</dd></div>
                <div><dt>Never trained</dt><dd>{{ figures.neverTrained }}</dd></div>
              </dl>
            }
          </div>
        </div>
      } @else {
        <p class="hint">Not enough data yet. Days you train in this period fill the calendar.</p>
      }
    </app-detail-section>
  `,
  styleUrl: './log-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogSectionComponent {
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly days = input<readonly CalendarDay[]>([]);
  readonly card = input<CoachCardContext | null>(null);

  protected readonly sentence = computed(() => {
    const figures = this.stats();
    return figures ? `You trained on ${figures.daysTrained} days and the longest break was ${figures.longestBreak}.` : `Every day you trained, ${rangeLabel(this.from(), this.to())}.`;
  });
  protected readonly stats = computed(() => logStats(this.from(), this.to(), this.days()));
}
