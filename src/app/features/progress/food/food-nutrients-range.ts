/** What the Nutrients section of the Food page covers for the page's period. */
export interface NutrientsRange {
  days: 30 | 90;
  /** Said under the section when the range is shorter than the period; null when it matches. */
  caption: string | null;
}

/** Four weeks reads 30 days, three months 90 days, and a year the last 90 days too, which the caption says. */
export function nutrientsDays(period: '4w' | '3m' | '1y'): NutrientsRange {
  if (period === '4w') {
    return { days: 30, caption: null };
  }
  return { days: 90, caption: period === '1y' ? 'Last 3 months' : null };
}
