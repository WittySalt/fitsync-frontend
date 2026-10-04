import { LiftProgress, ReadingFact } from '../../../core/coach/coach.models';
import { BEST_SINGLE_KEY, strengthFactsAsBestSingle } from './best-single';

const fact = (key: string, label = 'x'): ReadingFact => ({ number: 1, key, label, value: '1,923', unit: 'kg', numericValue: 1923, note: 'Up 12%', detail: '1,716 kg the week before', card: 'TRAINING' });
const lift = (exerciseName: string, fromKg: number, toKg: number): LiftProgress => ({ exerciseName, fromKg, fromDate: '2026-09-01', toKg, toDate: '2026-09-27' });

describe('strengthFactsAsBestSingle', () => {
  it('shows the weight-moved fact as the best single of the lift that changed most', () => {
    const [mapped] = strengthFactsAsBestSingle([fact('VOLUME_PER_SESSION', 'Weight moved per session')], [lift('Row', 40, 41), lift('Dumbbell Bench Press', 27, 30)]);
    expect(mapped).toEqual(jasmine.objectContaining({ key: BEST_SINGLE_KEY, label: 'Estimated best single', value: '30', unit: 'kg', numericValue: 30, note: 'Up 11%', detail: 'Dumbbell Bench Press, 27 kg before', number: 1, card: 'TRAINING' }));
  });

  it('says a fall plainly and a level lift as steady', () => {
    expect(strengthFactsAsBestSingle([fact('VOLUME_PER_SESSION')], [lift('Squat', 100, 94)])[0].note).toBe('Down 6%');
    expect(strengthFactsAsBestSingle([fact('VOLUME_PER_SESSION')], [lift('Squat', 100, 100)])[0].note).toBe('Steady');
  });

  it('leaves the facts as written when there is no usable lift', () => {
    const facts = [fact('VOLUME_PER_SESSION', 'Weight moved per session')];
    expect(strengthFactsAsBestSingle(facts, [])).toEqual(facts);
    expect(strengthFactsAsBestSingle(facts, undefined)).toEqual(facts);
    expect(strengthFactsAsBestSingle(facts, [lift('Row', 0, 40)])).toEqual(facts);
  });

  it('leaves every other fact, and a fact that is already the best single, alone', () => {
    const facts = [fact('SESSION_LENGTH', 'Session length'), fact(BEST_SINGLE_KEY, 'Estimated best single')];
    expect(strengthFactsAsBestSingle(facts, [lift('Row', 40, 44)])).toEqual(facts);
  });
});
