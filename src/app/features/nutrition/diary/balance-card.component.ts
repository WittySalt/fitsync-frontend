import { Component, computed, input } from '@angular/core';

import { BalanceEntry, ProteinByMealView, RangeDay } from './diary.models';
import { BalanceRowView, ProteinChart, balanceRow, proteinChart } from './diary-figures';
import { weekDots } from './diary-week';
import { BalanceRowComponent } from './balance-row.component';
import { ProteinChartComponent } from './protein-chart.component';

interface RowWithDots {
  view: BalanceRowView;
  dots: (boolean | null)[];
}

const KIDNEY_NOTE =
  'Potassium from food is safe for healthy kidneys. With kidney disease or medicine that raises potassium, follow your doctor.';

/**
 * Balance in three parts: what to aim for (reach the daily amount), what to keep under (less is
 * better, on target when under), and protein at each meal against the person's own band.
 * A part the backend sends nothing for is left out.
 */
@Component({
  selector: 'app-balance-card',
  imports: [BalanceRowComponent, ProteinChartComponent],
  template: `
    <div class="head">
      <div class="title">
        <span class="eyebrow">Balance</span>
        <span class="aside">dots are this week</span>
      </div>
      <span class="key" aria-label="Dot key">
        <span><i class="on"></i>on target</span>
        <span><i class="missed"></i>missed</span>
        <span><i></i>not yet</span>
      </span>
    </div>
    @if (aim().length) {
      <section>
        <div class="section-head">
          <strong>Aim for</strong>
          <span>reach the daily amount</span>
        </div>
        @for (entry of aim(); track entry.view.entry.code) {
          <app-balance-row [row]="entry.view" [dots]="entry.dots" />
        }
        @if (hasPotassium()) {
          <p class="note">{{ kidneyNote }}</p>
        }
      </section>
    }
    @if (under().length) {
      <section>
        <div class="section-head">
          <strong>Keep under</strong>
          <span>less is better, on target when under</span>
        </div>
        @for (entry of under(); track entry.view.entry.code) {
          <app-balance-row [row]="entry.view" [dots]="entry.dots" />
        }
      </section>
    }
    @if (chart(); as protein) {
      <section>
        <span class="eyebrow muted">Through the day</span>
        <app-protein-chart [chart]="protein" />
      </section>
    }
  `,
  styleUrl: './balance-card.component.scss'
})
export class BalanceCardComponent {
  readonly entries = input<BalanceEntry[]>([]);
  readonly proteinByMeal = input<ProteinByMealView | null>(null);
  readonly days = input<RangeDay[]>([]);
  /** The seven dates of the week the dots are drawn for. */
  readonly dates = input<string[]>([]);
  readonly today = input.required<string>();

  protected readonly kidneyNote = KIDNEY_NOTE;
  protected readonly aim = computed(() => this.rows('TARGET'));
  protected readonly under = computed(() => this.rows('LIMIT'));
  protected readonly hasPotassium = computed(() => this.entries().some((entry) => entry.code === 'POTASSIUM'));
  protected readonly chart = computed<ProteinChart | null>(() => {
    const view = this.proteinByMeal();
    return view ? proteinChart(view) : null;
  });

  private rows(kind: BalanceEntry['kind']): RowWithDots[] {
    return this.entries()
      .filter((entry) => entry.kind === kind)
      .map((entry) => ({ view: balanceRow(entry), dots: weekDots(this.days(), this.dates(), this.today(), entry.code) }));
  }
}
