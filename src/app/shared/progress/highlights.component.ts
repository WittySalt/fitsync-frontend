import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { DetailSectionComponent } from './detail-section.component';
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

/** Writes a value of a finding in its unit, for a page whose units need more than a number: "5:50" a km. */
export type HighlightFormat = (value: number, unit: string) => string;

function barRows(series: readonly SeriesPoint[], unit: string, format: HighlightFormat | null, max: number | null): BarRow[] {
  const top = Math.max(max ?? 0, ...series.map((p) => Math.abs(p.value)), 1);
  const digits = series.some((p) => !Number.isInteger(p.value)) ? 1 : 0;
  const anyNegative = series.some((p) => p.value < 0);
  return series.map((point) => ({
    label: point.label,
    width: Math.max((Math.abs(point.value) / top) * 100, 4),
    text: format ? format(point.value, unit) : `${anyNegative ? signed(point.value, digits) : formatNumber(point.value, digits)}${unit ? ' ' + unit : ''}`
  }));
}

/**
 * Highlights: up to four rule-based findings, each with its own small chart. On a phone two show
 * and the rest wait behind "N more highlights". The section says so in words when there are none.
 */
@Component({
  selector: 'app-highlights',
  imports: [DetailSectionComponent, SmallTrendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-detail-section name="Highlights" anchor="highlights" [context]="context()" [ask]="ask()">
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
                  <app-small-trend [points]="card.series" [unit]="card.unit" [digits]="card.digits" [startText]="card.startText" [endText]="card.endText" [label]="card.title" />
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
    </app-detail-section>
  `,
  styles: `
    :host { display: block; scroll-margin-top: 64px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { box-sizing: border-box; min-width: 0; padding: 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
    .kicker { font: 700 var(--pg-eyebrow) var(--font-sans); letter-spacing: var(--pg-eyebrow-tracking); text-transform: uppercase; color: var(--text-secondary); }
    .title { font: 600 var(--pg-text) / 1.4 var(--font-sans); color: var(--text-primary); }
    .chart { min-height: 66px; display: flex; flex-direction: column; justify-content: center; margin-top: auto; }
    .bars { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 8px; align-items: center; }
    .bar-label { font: 500 var(--pg-chart) var(--font-sans); color: var(--text-primary); }
    .track { height: 10px; border-radius: 5px; background: var(--surface-sunken); overflow: hidden; }
    .track i { display: block; height: 100%; border-radius: 5px; background: var(--accent); }
    .bar-value { font: 600 var(--pg-chart) var(--font-sans); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .foot { font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .more { display: none; align-self: flex-start; border: 0; background: none; padding: 0; font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); cursor: pointer; }
    .none { margin: 0; font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); }
    @media (max-width: 640px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .grid:not(.open) .card:nth-child(n + 3) { display: none; }
      .more { display: inline; }
    }
  `
})
export class HighlightsComponent {
  readonly highlights = input.required<readonly Highlight[]>();
  readonly context = input<ProgressCardContext | null>(null);
  /** What Ask puts in the composer. */
  readonly ask = input('What stands out in these findings, and what should I do about it?');
  /** How values are written; numbers with their unit when not given. */
  readonly format = input<HighlightFormat | null>(null);
  /** A shared top for the bars, so one value reads against a usual scale rather than filling the track. */
  readonly barMax = input<number | null>(null);

  readonly expanded = signal(false);

  protected readonly cards = computed(() =>
    this.highlights()
      .slice(0, 4)
      .map((highlight) => {
        const format = this.format();
        const series = highlight.series;
        const chart = highlightChart(series);
        return {
          ...highlight,
          kicker: HIGHLIGHT_KICKERS[highlight.code] ?? '',
          chart,
          digits: series.some((p) => !Number.isInteger(p.value)) ? 1 : 0,
          startText: format && series.length ? format(series[0].value, highlight.unit) : null,
          endText: format && series.length ? format(series[series.length - 1].value, highlight.unit) : null,
          rows: chart === 'bars' ? barRows(series, highlight.unit, format, this.barMax()) : []
        };
      })
  );

}
