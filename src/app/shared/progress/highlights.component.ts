import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { CoachStore } from '../../core/coach/coach.store';
import { formatNumber, isDateKey, signed } from './progress-format';
import { Highlight, ProgressCardContext, SeriesPoint } from './progress.models';
import { SmallTrendComponent } from './small-trend.component';

/** The word over each finding, by its rule code. An unknown code shows no word. */
export const HIGHLIGHT_KICKERS: Record<string, string> = {
  LIFT_UP: 'Strength',
  PACE_FASTER: 'Cardio',
  MUSCLE_UNDER: 'Balance',
  LOAD_TREND: 'Training load',
  CONSISTENCY: 'Consistency',
  RATE_IN_RANGE: 'Pace',
  LOG_VS_SCALE: 'Log and scale',
  WAIST_VS_WEIGHT: 'Body',
  PROTEIN_MET: 'Protein',
  PROTEIN_DRIFT: 'Protein',
  LOWEST_NUTRIENT: 'Nutrients',
  PLATE_SHIFT: 'Plate',
  LARGEST_MEAL: 'Meals'
};

/** How a finding's series is drawn: a trend line over dates, or bars for a few named values. */
export function highlightChart(series: readonly SeriesPoint[]): 'line' | 'bars' | 'none' {
  if (!series.length) {
    return 'none';
  }
  if (series.length >= 2 && (series.length > 3 || series.every((point) => isDateKey(point.label)))) {
    return 'line';
  }
  return 'bars';
}

interface BarRow {
  label: string;
  width: number;
  text: string;
}

function barRows(series: readonly SeriesPoint[], unit: string): BarRow[] {
  const top = Math.max(...series.map((p) => Math.abs(p.value)), 1);
  const digits = series.some((p) => !Number.isInteger(p.value)) ? 1 : 0;
  const anyNegative = series.some((p) => p.value < 0);
  return series.map((point) => ({
    label: point.label,
    width: Math.max((Math.abs(point.value) / top) * 100, 4),
    text: `${anyNegative ? signed(point.value, digits) : formatNumber(point.value, digits)}${unit ? ' ' + unit : ''}`
  }));
}

/**
 * Highlights: up to four rule-based findings, each with its own small chart. On a phone two show
 * and the rest wait behind "N more highlights". The section says so in words when there are none.
 */
@Component({
  selector: 'app-highlights',
  imports: [SmallTrendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="highlights" aria-labelledby="highlights-title">
      <header class="head">
        <div>
          <h2 id="highlights-title">Highlights</h2>
          @if (sub()) {
            <span class="sub">{{ sub() }}</span>
          }
        </div>
        @if (context()) {
          <button type="button" class="ask" (click)="askCoach()">Ask</button>
        }
      </header>
      @if (cards().length) {
        <div class="grid" [class.open]="expanded()">
          @for (card of cards(); track card.code + $index) {
            <article class="card">
              @if (card.kicker) {
                <span class="kicker">{{ card.kicker }}</span>
              }
              <strong class="title">{{ card.title }}</strong>
              <div class="chart">
                @if (card.chart === 'line') {
                  <app-small-trend [points]="card.series" [unit]="card.unit" [digits]="card.digits" [label]="card.title" />
                } @else if (card.chart === 'bars') {
                  <div class="bars" role="img" [attr.aria-label]="card.title">
                    @for (row of card.rows; track $index) {
                      <span class="bar-label">{{ row.label }}</span>
                      <span class="track"><i [style.width.%]="row.width"></i></span>
                      <span class="bar-value">{{ row.text }}</span>
                    }
                  </div>
                }
              </div>
              @if (card.context) {
                <span class="foot">{{ card.context }}</span>
              }
            </article>
          }
        </div>
        @if (cards().length > 2 && !expanded()) {
          <button type="button" class="more" (click)="expanded.set(true)">{{ cards().length - 2 }} more highlights ›</button>
        }
      } @else {
        <p class="none">Not enough data yet. Highlights appear once there is a period to compare.</p>
      }
    </section>
  `,
  styles: `
    :host { display: block; scroll-margin-top: 64px; }
    .highlights { display: flex; flex-direction: column; gap: 10px; }
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 17px; color: var(--text-primary); }
    .sub { font-size: 13px; color: var(--text-secondary); }
    .ask { height: 30px; padding: 0 11px; border-radius: 10px; border: 1px solid var(--accent-subtle); background: var(--surface); font: inherit; font-size: var(--text-xs); font-weight: 700; color: var(--accent-text); cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { box-sizing: border-box; min-width: 0; padding: 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
    .kicker { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-text); }
    .title { font-size: 15px; line-height: 1.35; color: var(--text-primary); }
    .chart { min-height: 66px; display: flex; flex-direction: column; justify-content: center; margin-top: auto; }
    .bars { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 8px; align-items: center; }
    .bar-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); }
    .track { height: 10px; border-radius: 5px; background: var(--surface-sunken); overflow: hidden; }
    .track i { display: block; height: 100%; border-radius: 5px; background: var(--accent); }
    .bar-value { font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .foot { font-size: var(--text-xs); color: var(--text-secondary); }
    .more { display: none; align-self: flex-start; border: 0; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 700; color: var(--accent-text); cursor: pointer; }
    .none { margin: 0; font-size: 13px; color: var(--text-secondary); }
    @media (max-width: 640px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .grid:not(.open) .card:nth-child(n + 3) { display: none; }
      .more { display: inline; }
    }
  `
})
export class HighlightsComponent {
  private readonly coach = inject(CoachStore);

  readonly highlights = input.required<readonly Highlight[]>();
  readonly sub = input('');
  readonly context = input<ProgressCardContext | null>(null);

  readonly expanded = signal(false);

  protected readonly cards = computed(() =>
    this.highlights().map((highlight) => ({
      ...highlight,
      kicker: HIGHLIGHT_KICKERS[highlight.code] ?? '',
      chart: highlightChart(highlight.series),
      digits: highlight.series.some((p) => !Number.isInteger(p.value)) ? 1 : 0,
      rows: highlightChart(highlight.series) === 'bars' ? barRows(highlight.series, highlight.unit) : []
    }))
  );

  askCoach(): void {
    const context = this.context();
    if (context) {
      this.coach.askAboutCard(context);
    }
  }
}
