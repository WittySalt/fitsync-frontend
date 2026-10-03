import { E1RM_FORMULA, e1rm, ladderPosition, liftChangePct, rungsFor, toHalfKg, trackPosition } from './lift-math';
import { hm, heroChange, heroTime, kg, pace, rangeLabel, roundPct, signedPct } from './training-format';
import { periodRange } from './training-period';
import { Lift } from './training.models';

function lift(name: string, values: number[], extra: Partial<Lift> = {}): Lift {
  return {
    exerciseId: name,
    name,
    e1rm: values.map((value, index) => ({ date: `2026-09-${String(8 + index).padStart(2, '0')}`, value, isRecord: false })),
    bestSet: null,
    changePct: null,
    relative: null,
    bodyWeightKg: 71.2,
    bestBefore: null,
    ...extra
  };
}

describe('lift maths', () => {
  it('estimates the best single as weight × (1 + reps ÷ 30)', () => {
    expect(e1rm(80, 5)).toBeCloseTo(93.33, 2);
    expect(e1rm(67.5, 6)).toBeCloseTo(81, 5);
    expect(kg(e1rm(80, 5))).toBe('93.3');
    expect(kg(81)).toBe('81');
    expect(E1RM_FORMULA).toBe('worked out as weight × (1 + reps ÷ 30)');
  });

  it('picks the ladder of the lift by its name', () => {
    expect(rungsFor('Back squat')).toEqual([0.75, 1.0, 1.25, 1.75]);
    expect(rungsFor('Deadlift')).toEqual([1.0, 1.25, 1.5, 2.0]);
    expect(rungsFor('Bench press')).toEqual([0.5, 0.75, 1.0, 1.5]);
    expect(rungsFor('Overhead press')).toEqual([0.35, 0.55, 0.75, 1.0]);
    expect(rungsFor('Barbell row')).toEqual([0.5, 0.75, 1.0, 1.5]);
  });

  it('works out the level and the next rung from the latest e1RM when the server sends none', () => {
    const position = ladderPosition(lift('Deadlift', [81.7, 93.3]));
    expect(position?.ratio).toBeCloseTo(1.31, 2);
    expect(position?.level).toBe('INTERMEDIATE');
    expect(position?.nextLevel).toBe('ADVANCED');
    expect(position?.nextAtKg).toBe(107);
    expect(position?.position).toBeGreaterThan(50);
    expect(position?.position).toBeLessThan(75);
  });

  it('prefers the server level and next rung', () => {
    const position = ladderPosition(
      lift('Squat', [70, 81], { relative: { ratio: 1.14, level: 'INTERMEDIATE', nextLevel: 'ADVANCED', nextAtKg: 107 } })
    );
    expect(position?.level).toBe('INTERMEDIATE');
    expect(position?.nextAtKg).toBe(107);
    expect(position?.position).toBeGreaterThanOrEqual(50);
  });

  it('has no place on the ladder without a body weight', () => {
    expect(ladderPosition(lift('Squat', [70, 81], { bodyWeightKg: null }))).toBeNull();
  });

  it('says top rung when the lift is advanced', () => {
    const position = ladderPosition(lift('Bench press', [110], { bodyWeightKg: 70 }));
    expect(position?.level).toBe('ADVANCED');
    expect(position?.nextLevel).toBeNull();
    expect(position?.nextAtKg).toBeNull();
    expect(trackPosition(9, [0.5, 0.75, 1, 1.5], 3)).toBe(100);
    expect(toHalfKg(88.96)).toBe(89);
  });

  it('takes the server change, else the series change', () => {
    expect(liftChangePct(lift('Squat', [72, 81], { changePct: 12.4 }))).toBe(12.4);
    expect(liftChangePct(lift('Squat', [72, 81]))).toBeCloseTo(12.5, 5);
    expect(liftChangePct(lift('Squat', [72]))).toBeNull();
  });
});

describe('training wording', () => {
  it('rounds a half percent down, as every board does', () => {
    expect(roundPct(12.5)).toBe(12);
    expect(roundPct(12.6)).toBe(13);
    expect(signedPct(14.2)).toBe('+14%');
    expect(signedPct(-3.4)).toBe('−3%');
  });

  it('writes times and paces the board way', () => {
    expect(hm(290)).toBe('4 h 50 min');
    expect(hm(120)).toBe('2 h');
    expect(hm(45)).toBe('45 min');
    expect(heroTime(710)).toBe('11 h 50');
    expect(heroTime(65)).toBe('1 h 05');
    expect(pace(350)).toBe('5:50');
    expect(heroChange(710, 640, 'minutes')).toBe('+1 h 10');
    expect(heroChange(15, 13, 'count')).toBe('+2');
    expect(heroChange(4320, 3960, 'pct')).toBe('+9%');
    expect(heroChange(5, null, 'count')).toBe('');
  });

  it('names a period by its dates', () => {
    expect(rangeLabel('2026-09-06', '2026-10-03')).toMatch(/^6 Sept? to 3 Oct$/);
    expect(periodRange('4w', '2026-10-03')).toEqual({ from: '2026-09-06', to: '2026-10-03' });
    expect(periodRange('1y', '2026-10-03').from).toBe('2025-10-05');
    expect(periodRange('nonsense', '2026-10-03').from).toBe('2026-09-06');
  });
});
