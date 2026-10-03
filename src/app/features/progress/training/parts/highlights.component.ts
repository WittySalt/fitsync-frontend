import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Highlight } from '../training.models';
import { grouped, kg, pace } from '../training-format';
import { HeatLevel, heatLevel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { SmallTrendComponent } from './small-trend.component';

const KICKERS: Record<string, string> = {
  LIFT_UP: 'Strength',
  PACE_FASTER: 'Cardio',
  MUSCLE_UNDER: 'Balance',
  LOAD_TREND: 'Training load',
  CONSISTENCY: 'Consistency'
};

/** A value of a highlight's series written in its unit: "93.3 kg", "5:50", "720". */
export function unitValue(value: number, unit: string): string {
  const key = unit.toLowerCase();
  if (key === 'kg') {
    return `${kg(value)} kg`;
  }
  if (key.includes('sec') && key.includes('km')) {
    return pace(value);
  }
  return `${grouped(value)}${unit && !key.includes('load') ? ` ${unit}` : ''}`;
}

export interface HighlightView {
  kicker: string;
  title: string;
  context: string;
  values: number[];
  start: string;
  end: string;
  from: string;
  to: string;
  /** A one-value finding, such as the fewest sets of any group, drawn as one bar against 0 to 25. */
  bar: { label: string; value: number; width: number; text: string; level: HeatLevel } | null;
}

export function highlightView(item: Highlight): HighlightView {
  const values = item.series.map((point) => point.value);
  const single = values.length === 1;
  const first = item.series[0];
  const last = item.series[item.series.length - 1];
  return {
    kicker: KICKERS[item.code] ?? 'Finding',
    title: item.title,
    context: item.context,
    values,
    start: first ? unitValue(first.value, item.unit) : '',
    end: last ? unitValue(last.value, item.unit) : '',
    from: values.length > 1 ? (first?.label ?? '') : '',
    to: values.length > 1 ? (last?.label ?? '') : '',
    bar: single && first ? { label: first.label, value: first.value, width: Math.min(100, (first.value / 25) * 100), text: `${grouped(first.value)} ${item.unit || 'sets'} a week`, level: heatLevel(first.value) } : null
  };
}

/**
 * Highlights: one rule-based finding each with its own small chart, at most four. On a phone the
 * first two show and the rest wait behind "2 more highlights". Private copy of `app-highlights`.
 */
@Component({
  selector: 'app-highlights',
  imports: [SmallTrendComponent],
  templateUrl: './highlights.component.html',
  styleUrl: './highlights.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HighlightsComponent {
  readonly items = input<readonly Highlight[]>([]);
  readonly sub = input('one finding each, from this period');

  protected readonly expanded = signal(false);
  protected readonly views = computed(() => this.items().slice(0, 4).map(highlightView));
  protected readonly hidden = computed(() => Math.max(0, this.views().length - 2));
}
