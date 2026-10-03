import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { DetailSectionComponent } from '../../../../shared/progress';
import { TrainingLoad } from '../training.models';
import { addDays } from '../training-format';
import { grouped } from '../training-format';
import { formPosition } from './chart-geometry';
import { LoadChartComponent } from './load-chart.component';

const FORM_WORDS: Record<string, string> = { TIRED: 'Tired', BALANCED: 'Balanced', FRESH: 'Fresh' };

/**
 * Training load: the weekly chart, its key and the form of this week in words only, never as a
 * number or a medical claim (contract, decisions).
 */
@Component({
  selector: 'app-load-section',
  imports: [DetailSectionComponent, LoadChartComponent],
  template: `
    <app-detail-section name="Training load" anchor="load" [sentence]="sentence()" [context]="card()" [ask]="ask()">
      @if (load().weeks.length >= 2) {
        <app-load-chart [load]="load()" [today]="today()" />
        <div class="key">
          <span><i class="sw strength"></i>Strength</span>
          <span><i class="sw cardio"></i>Cardio</span>
          <span><i class="sw sport"></i>Sport</span>
          <span><i class="sw mobility"></i>Mobility</span>
          <span><i class="ln fitness"></i>Fitness, 6-week average</span>
          <span><i class="ln fatigue"></i>Fatigue, last week</span>
          @if (hasCurrent()) {
            <span><i class="sw lighter"></i>The lighter bar is this week so far</span>
          }
        </div>
        @if (formWord(); as word) {
          <div class="form">
            <div class="form-head"><span>Form this week</span><strong>{{ word }}</strong></div>
            <div class="scale" aria-hidden="true"><span class="marker" [style.left.%]="marker()"></span></div>
            <div class="words" aria-hidden="true"><span>tired</span><span>balanced</span><span>fresh</span></div>
          </div>
        }
      } @else {
        <p class="note">Not enough data yet. Load needs two weeks of sessions to draw.</p>
      }
    </app-detail-section>
  `,
  styleUrl: './load-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadSectionComponent {
  readonly load = input.required<TrainingLoad>();
  readonly today = input.required<string>();
  readonly card = input<CoachCardContext | null>(null);
  /** The share of load worked out from a kind's default effort, 0 to 1. */
  readonly estimatedShare = input<number | null>(null);

  protected readonly hasCurrent = computed(() => {
    const last = this.load().weeks.at(-1);
    return !!last && addDays(last.weekStart, 6) >= this.today() && last.weekStart <= this.today();
  });
  protected readonly formWord = computed(() => (this.load().form ? FORM_WORDS[this.load().form!] : null));
  protected readonly marker = computed(() => {
    const load = this.load();
    const fitness = load.fitness[load.fitness.length - 1]?.value ?? null;
    const fatigue = load.fatigue[load.fatigue.length - 1]?.value ?? null;
    return formPosition(load.form, fitness, fatigue);
  });
  /** The one sentence under the name: the last week's load against the six-week average. */
  protected readonly sentence = computed(() => {
    const load = this.load();
    const week = load.weeks[load.weeks.length - 1];
    const fitness = load.fitness[load.fitness.length - 1]?.value ?? null;
    if (load.weeks.length < 2 || !week || fitness === null) {
      return 'Effort × minutes of every session, each week.';
    }
    return `Load is ${grouped(week.total)} this week so far against a six-week average of ${grouped(fitness)}.`;
  });
  protected readonly ask = computed(() => `How is my training load worked out? It is effort × minutes of every session, each week. ${this.estimatedNote()}`.trim());
  protected readonly estimatedNote = computed(() => {
    const share = this.estimatedShare();
    return share && share > 0 ? `${Math.round(share * 100)}% of the load uses a usual effort for sessions logged without one.` : '';
  });
}
