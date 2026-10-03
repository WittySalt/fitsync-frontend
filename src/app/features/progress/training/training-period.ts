import { addDays } from './training-format';

/** The three periods of the Training pages; the default is four weeks. */
export type PeriodCode = '4w' | '3m' | '1y';

export interface PeriodOption {
  code: PeriodCode;
  label: string;
  weeks: number;
  /** How a comparison names the period before: "the 4 weeks before". */
  before: string;
}

export const PERIODS: PeriodOption[] = [
  { code: '4w', label: '4 weeks', weeks: 4, before: 'the 4 weeks before' },
  { code: '3m', label: '3 months', weeks: 13, before: 'the 3 months before' },
  { code: '1y', label: '1 year', weeks: 52, before: 'the year before' }
];

export function periodOption(code: string | null | undefined): PeriodOption {
  return PERIODS.find((option) => option.code === code) ?? PERIODS[0];
}

/** Whole weeks ending today, inclusive, so four weeks is 28 days and a year stays under the 370-day cap. */
export function periodRange(code: string | null | undefined, today: string): { from: string; to: string } {
  const option = periodOption(code);
  return { from: addDays(today, -(option.weeks * 7 - 1)), to: today };
}
