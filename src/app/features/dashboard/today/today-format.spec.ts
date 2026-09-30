import { Goal } from '../../../core/fitsync.models';
import { goalDueLabel, goalFigure, goalName, goalPercent, oneDecimal, weighedLabel, weightChangeLabel } from './today-format';

const now = new Date(2026, 8, 30, 9, 0);

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalType: 'WEIGHT',
    targetValue: 68,
    targetUnit: 'kg',
    targetDate: '2026-11-29',
    status: 'ACTIVE',
    progressRatio: 0.31,
    currentValue: 71.1,
    ...overrides
  };
}

describe('weighed label', () => {
  it('says today, yesterday and how many days ago inside a week', () => {
    expect(weighedLabel('2026-09-30', now)).toBe('today');
    expect(weighedLabel('2026-09-29', now)).toBe('yesterday');
    expect(weighedLabel('2026-09-26', now)).toBe('4 days ago');
  });

  it('writes an older date with the Sept spelling and no year in the current year', () => {
    expect(weighedLabel('2026-09-13', now)).toBe('13 Sept');
    expect(weighedLabel('2026-05-20', now)).toBe('20 May');
  });

  it('adds the year for another year and never reparses a display string', () => {
    expect(weighedLabel('2025-12-31', now)).toBe('31 Dec 2025');
    expect(weighedLabel('5 Jul', now)).toBe('');
    expect(weighedLabel(null, now)).toBe('');
    expect(weighedLabel('', now)).toBe('');
  });
});

describe('weight change label', () => {
  it('names the direction and the size', () => {
    expect(weightChangeLabel(-1.4)).toBe('Down 1.4 kg in 30 days');
    expect(weightChangeLabel(0.6)).toBe('Up 0.6 kg in 30 days');
  });

  it('reports no change for a change too small to show, and nothing without a figure', () => {
    expect(weightChangeLabel(0)).toBe('No change in 30 days');
    expect(weightChangeLabel(0.04)).toBe('No change in 30 days');
    expect(weightChangeLabel(null)).toBe('');
    expect(weightChangeLabel(undefined)).toBe('');
    expect(weightChangeLabel(Number.NaN)).toBe('');
  });
});

describe('goal labels', () => {
  it('capitalises each word of the goal type', () => {
    expect(goalName(goal({ goalType: 'WORKOUT_FREQUENCY' }))).toBe('Workout Frequency');
    expect(goalName(goal({ goalType: 'PROTEIN' }))).toBe('Protein');
  });

  it('writes current of target with the unit', () => {
    expect(goalFigure(goal())).toBe('71.1 kg, goal 68 kg');
    expect(goalFigure(goal({ goalType: 'CALORIES', targetUnit: 'kcal', targetValue: 2000, currentValue: 1900 }))).toBe('1,900 of 2,000 kcal');
  });

  it('falls back to the unit of the goal type and leaves out what is missing', () => {
    expect(goalFigure(goal({ goalType: 'PROTEIN', targetUnit: '', targetValue: 140, currentValue: 130 }))).toBe('130 of 140 g');
    expect(goalFigure(goal({ goalType: 'WORKOUT_FREQUENCY', targetUnit: '', targetValue: 4, currentValue: null }))).toBe('4 workouts/week');
    expect(goalFigure(goal({ goalType: 'STEPS', targetUnit: '', targetValue: 10, currentValue: 5 }))).toBe('5 of 10');
    expect(goalFigure(goal({ targetValue: 0 }))).toBe('No target set');
  });

  it('writes the due date, and was due once it has passed', () => {
    expect(goalDueLabel(goal())).toBe('by 29 Nov 2026');
    expect(goalDueLabel(goal({ targetDate: '2026-09-29' }))).toBe('by 29 Sept 2026');
    expect(goalDueLabel(goal({ targetDate: '2026-05-31', expired: true }))).toBe('was due 31 May 2026');
    expect(goalDueLabel(goal({ targetDate: '' }))).toBe('');
  });

  it('clamps the progress between 0 and 100', () => {
    expect(goalPercent(goal({ progressRatio: 0.314 }))).toBe(31);
    expect(goalPercent(goal({ progressRatio: 1.7 }))).toBe(100);
    expect(goalPercent(goal({ progressRatio: -0.2 }))).toBe(0);
    expect(goalPercent(goal({ progressRatio: Number.NaN }))).toBe(0);
  });
});

describe('one decimal', () => {
  it('drops a trailing zero and survives a bad number', () => {
    expect(oneDecimal(68)).toBe('68');
    expect(oneDecimal(71.14)).toBe('71.1');
    expect(oneDecimal(Number.NaN)).toBe('0');
  });
});
