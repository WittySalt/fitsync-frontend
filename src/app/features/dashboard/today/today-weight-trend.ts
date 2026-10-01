import { ProgressInsight } from '../../../core/fitsync.models';
import { dateLabel } from '../../../shared/coach/insight/weight-projection.geometry';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Kilograms with at most two decimals and no trailing zero, for example "0.41", "71.1" or "68". */
export function kgFigure(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false }).format(value);
}

/** A goal weight with at most one decimal, for example "68" or "67.5". */
export function goalKgFigure(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: false }).format(value);
}

/** A date key written the way the chart's axis writes it, with the year only when it differs. */
export function trendDate(key: string, referenceKey: string): string {
  return DAY_KEY.test(key) ? dateLabel(key, referenceKey.slice(0, 4)) : '';
}

function windowPhrase(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) {
    return '';
  }
  const weeks = Math.round(days / 7);
  if (weeks < 1) {
    return '';
  }
  if (weeks === 1) {
    return ' over a week';
  }
  return ` over ${weeks < WEEK_WORDS.length ? WEEK_WORDS[weeks] : weeks} weeks`;
}

/**
 * The one sentence under the weight chart, or an empty string when the figures do not support one.
 * A goal with a projected date says when the goal weight comes at this pace, and says it is before
 * the person's own date only when that is true. A projected date after the goal date carries no
 * remark. A goal the pace does not lead to says nothing. Without a goal the pace itself is told.
 */
export function trendSentence(insight: ProgressInsight): string {
  const reference = insight.referenceDate ?? insight.measuredOn ?? insight.series.at(-1)?.date ?? '';
  const goal = insight.goalWeightKg;
  if (goal != null && Number.isFinite(goal) && goal > 0) {
    const projected = insight.projectedDate && DAY_KEY.test(insight.projectedDate) ? insight.projectedDate : null;
    if (projected === null) {
      return '';
    }
    const when = trendDate(projected, reference || projected);
    const early = insight.goalDate != null && DAY_KEY.test(insight.goalDate) && projected <= insight.goalDate;
    return `At this pace ${goalKgFigure(goal)} kg comes on ${when}${early ? ', before your date' : ''}.`;
  }
  const rate = insight.weeklyRateKg;
  if (rate == null || !Number.isFinite(rate)) {
    return '';
  }
  const amount = kgFigure(Math.abs(rate));
  if (amount === '0') {
    return '';
  }
  return `${rate < 0 ? 'Down' : 'Up'} ${amount} kg a week${windowPhrase(insight.rateWindowDays)}.`;
}
