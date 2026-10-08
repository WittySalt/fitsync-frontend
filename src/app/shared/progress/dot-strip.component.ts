import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { pointLabel } from './progress-format';
import { DotDay } from './progress.models';

/**
 * The Diary's dots, one a day: filled green when met, a slate ring when missed, grey when nothing
 * was logged and dashed for a day still to come. The dots shrink to fit the width.
 */
@Component({
  selector: 'app-dot-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (days().length) {
      <div class="strip" role="img" [attr.aria-label]="summary()" [style.grid-template-columns]="'repeat(' + days().length + ', minmax(0, 1fr))'">
        @for (day of days(); track day.date) {
          <span class="cell"><i class="dot" [attr.data-state]="day.state" [attr.title]="title(day)"></i></span>
        }
      </div>
      <div class="dates"><span>{{ first() }}</span><span>{{ last() }}</span></div>
      @if (showKey()) {
        <div class="key">
          <span><i class="dot" data-state="MET"></i>{{ metWord() }}</span>
          <span><i class="dot" data-state="MISSED"></i>missed</span>
          <span><i class="dot" data-state="NOT_LOGGED"></i>not logged</span>
        </div>
      }
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .strip { display: grid; gap: 3px; }
    .cell { display: flex; justify-content: center; }
    .dot { display: block; width: 100%; max-width: 9px; aspect-ratio: 1; box-sizing: border-box; border-radius: 50%; }
    .dot[data-state='MET'] { background: var(--accent); }
    .dot[data-state='MISSED'] { background: var(--surface); border: 1.5px solid var(--text-secondary); }
    .dot[data-state='NOT_LOGGED'] { background: var(--surface-sunken); border: 1px solid var(--text-muted); }
    .dot[data-state='FUTURE'] { border: 1px dashed var(--border-strong); }
    .dates { display: flex; justify-content: space-between; font-size: var(--pg-chart); color: var(--text-secondary); }
    .key { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--pg-chart); color: var(--text-secondary); }
    .key span { display: inline-flex; align-items: center; gap: 5px; }
    .key .dot { width: 8px; }
    .none { margin: 0; font-size: var(--pg-chart); color: var(--text-secondary); }
  `
})
export class DotStripComponent {
  readonly days = input.required<readonly DotDay[]>();
  readonly showKey = input(false);
  readonly metWord = input('met');

  protected readonly first = computed(() => pointLabel(this.days()[0]?.date ?? ''));
  protected readonly last = computed(() => pointLabel(this.days().at(-1)?.date ?? ''));
  protected readonly summary = computed(() => {
    const days = this.days();
    const met = days.filter((day) => day.state === 'MET').length;
    const logged = days.filter((day) => day.state === 'MET' || day.state === 'MISSED').length;
    return `${this.metWord()} on ${met} of ${logged} logged days, ${this.first()} to ${this.last()}`;
  });

  protected title(day: DotDay): string {
    const state = { MET: this.metWord(), MISSED: 'missed', NOT_LOGGED: 'not logged', FUTURE: 'to come' }[day.state];
    return `${pointLabel(day.date)}: ${state}`;
  }
}
