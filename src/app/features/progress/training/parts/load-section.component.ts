import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { TrainingLoad } from '../training.models';
import { formPosition } from './chart-geometry';
import { LoadChartComponent } from './load-chart.component';
import { SectionCardComponent } from './section-card.component';

const FORM_WORDS: Record<string, string> = { TIRED: 'Tired', BALANCED: 'Balanced', FRESH: 'Fresh' };

/**
 * Training load: the weekly chart, its key and the form of this week in words only, never as a
 * number or a medical claim (contract, decisions).
 */
@Component({
  selector: 'app-load-section',
  imports: [LoadChartComponent, SectionCardComponent],
  template: `
    <app-section-card title="Training load" sub="effort × minutes of every session, each week" [card]="card()">
      @if (load().weeks.length >= 2) {
        <app-load-chart [load]="load()" [today]="today()" [compact]="compact()" />
        <div class="key">
          <span><i class="sw strength"></i>Strength</span>
          <span><i class="sw cardio"></i>Cardio</span>
          <span><i class="sw sport"></i>Sport</span>
          <span><i class="sw mobility"></i>Mobility</span>
          <span><i class="ln fitness"></i>Fitness, 6-week average</span>
          <span><i class="ln fatigue"></i>Fatigue, last week</span>
        </div>
        @if (estimatedNote()) {
          <p class="note">{{ estimatedNote() }}</p>
        }
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
    </app-section-card>
  `,
  styleUrl: './load-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadSectionComponent {
  readonly load = input.required<TrainingLoad>();
  readonly today = input.required<string>();
  readonly card = input<CoachCardContext | null>(null);
  readonly compact = input(false);
  /** The share of load worked out from a kind's default effort, 0 to 1. */
  readonly estimatedShare = input<number | null>(null);

  protected readonly formWord = computed(() => (this.load().form ? FORM_WORDS[this.load().form!] : null));
  protected readonly marker = computed(() => {
    const load = this.load();
    const fitness = load.fitness[load.fitness.length - 1]?.value ?? null;
    const fatigue = load.fatigue[load.fatigue.length - 1]?.value ?? null;
    return formPosition(load.form, fitness, fatigue);
  });
  protected readonly estimatedNote = computed(() => {
    const share = this.estimatedShare();
    return share && share > 0 ? `${Math.round(share * 100)}% of the load uses a usual effort for sessions logged without one.` : '';
  });
}
