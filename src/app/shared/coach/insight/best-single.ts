import { LiftProgress, ReadingFact } from '../../../core/coach/coach.models';

/** The key of the fact that reads strength as the estimated best single of a lift. */
export const BEST_SINGLE_KEY = 'BEST_SINGLE';

/** Keys the server has used for the strength fact: the old weight-moved one and the best-single one. */
export const STRENGTH_FACT_KEYS: ReadonlySet<string> = new Set(['VOLUME_PER_SESSION', BEST_SINGLE_KEY]);

function kg(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function change(lift: LiftProgress): number {
  return lift.fromKg > 0 ? Math.round(((lift.toKg - lift.fromKg) / lift.fromKg) * 100) : 0;
}

/**
 * Strength is read as the estimated best single of a lift, never as the weight moved. A server that
 * still sends the weight-moved fact gets it shown as the best single of the lift that changed most,
 * taken from the reading's own lifts; the fact keeps its number so the sentence's citation holds. A
 * reading with no usable lift is left as the server wrote it, and so is a fact that is already the
 * best single.
 */
export function strengthFactsAsBestSingle(facts: readonly ReadingFact[], lifts: readonly LiftProgress[] | null | undefined): ReadingFact[] {
  const usable = (lifts ?? []).filter((lift) => lift.exerciseName && lift.toKg > 0 && lift.fromKg > 0);
  if (!usable.length) {
    return [...facts];
  }
  const lead = usable.reduce((best, lift) => (Math.abs(change(lift)) > Math.abs(change(best)) ? lift : best));
  const pct = change(lead);
  const note = pct > 0 ? `Up ${pct}%` : pct < 0 ? `Down ${Math.abs(pct)}%` : 'Steady';
  return facts.map((fact) =>
    fact.key === 'VOLUME_PER_SESSION'
      ? {
          ...fact,
          key: BEST_SINGLE_KEY,
          label: 'Estimated best single',
          value: kg(lead.toKg),
          unit: 'kg',
          numericValue: lead.toKg,
          note,
          detail: `${lead.exerciseName}, ${kg(lead.fromKg)} kg before`
        }
      : fact
  );
}
