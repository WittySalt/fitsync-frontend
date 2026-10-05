import { dateRangeLabel, parseLocalDate } from '../../../shared/date-label';
import { formatNumber, lastDays } from '../../../shared/progress/progress-format';
import { ReviewFact, WeeklyReview } from '../progress-api.models';

export type PeriodKey = '4w' | '3m' | '1y';

export interface PeriodOption {
  key: PeriodKey;
  label: string;
  words: string;
  days: number;
  /** How the Training headline names the period: "Trained in these 4 weeks". */
  trained: string;
  /** How a line says it: "in 4 weeks", "in 3 months", "in a year". */
  span: string;
}

export const PERIODS: readonly PeriodOption[] = [
  { key: '4w', label: '4 weeks', words: 'The last 4 weeks', days: 28, trained: 'these 4 weeks', span: '4 weeks' },
  { key: '3m', label: '3 months', words: 'The last 3 months', days: 91, trained: 'these 3 months', span: '3 months' },
  { key: '1y', label: '1 year', words: 'The last year', days: 364, trained: 'this year', span: 'a year' }
];

export function periodOf(value: string | null | undefined): PeriodOption {
  return PERIODS.find((period) => period.key === value) ?? PERIODS[0];
}

/** "Progress · The last 4 weeks · 6 Sept to 3 Oct"; the year shows when the period crosses one. */
export function eyebrowText(period: PeriodOption, today: string): string {
  const { from, to } = lastDays(period.days, today);
  return `Progress · ${period.words} · ${dateRangeLabel(from, to, parseLocalDate(today))}`;
}

export interface WeekChip {
  key: string;
  label: string;
  figure: string;
  delta: string;
}

const CHIPS: readonly { key: string; label: string }[] = [
  { key: 'SESSIONS', label: 'Sessions' },
  { key: 'MINUTES', label: 'Minutes' },
  { key: 'CALORIES_PER_DAY', label: 'Calories a day' },
  { key: 'PROTEIN_PER_DAY', label: 'Protein a day' }
];

function chip(spec: { key: string; label: string }, fact: ReviewFact | undefined): WeekChip {
  if (!fact) {
    return { ...spec, figure: '–', delta: '' };
  }
  // Only grams stay with the figure: the label already says sessions, minutes and calories.
  return { ...spec, figure: fact.unit === 'g' ? `${fact.value} g` : fact.value, delta: fact.detail || fact.note };
}

/**
 * Today is never a week, so a daily average never holds today. While the week has no full logged
 * day the server sends today's figure and the chip reads "476 today so far"; afterwards it keeps
 * the average with its "on N logged days".
 */
function todaySoFar(spec: { key: string; label: string }, soFar: number | undefined, unit: string): WeekChip {
  return { key: spec.key, label: spec.label.replace(' a day', ''), figure: `${formatNumber(Math.round(soFar ?? 0))}${unit}`, delta: 'today so far' };
}

/** The four chips of "This week so far", from the facts of the current week's review. */
export function weekChips(review: WeeklyReview | null): WeekChip[] {
  return CHIPS.map((spec) => {
    const soFar = !review?.current ? undefined : spec.key === 'CALORIES_PER_DAY' ? review.eatenTodaySoFarKcal : spec.key === 'PROTEIN_PER_DAY' ? review.proteinTodaySoFarGrams : undefined;
    return soFar === undefined ? chip(spec, review?.facts.find((fact) => fact.key === spec.key)) : todaySoFar(spec, soFar, spec.key === 'PROTEIN_PER_DAY' ? ' g' : '');
  });
}

/** The chips of one earlier week: only the facts it has. */
export function reviewChips(review: WeeklyReview): WeekChip[] {
  return weekChips(review).filter((item) => item.figure !== '–');
}

export const SECTIONS = [
  { id: 'goal', label: 'Goal' },
  { id: 'training', label: 'Training' },
  { id: 'food', label: 'Food' }
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * The section being read: the last one whose top has passed the reading line, else the first.
 * `tops` are the sections' distances from the top of the window, in page order.
 */
export function currentSection(tops: readonly { id: SectionId; top: number }[], line: number): SectionId {
  let current: SectionId = tops[0]?.id ?? 'goal';
  for (const section of tops) {
    if (section.top <= line) {
      current = section.id;
    }
  }
  return current;
}
