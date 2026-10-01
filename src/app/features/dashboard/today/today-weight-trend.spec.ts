import { ProgressInsight } from '../../../core/fitsync.models';
import { goalKgFigure, kgFigure, trendDate, trendSentence } from './today-weight-trend';

function insight(overrides: Partial<ProgressInsight> = {}): ProgressInsight {
  return {
    referenceDate: '2026-10-01',
    weightKg: 71.1,
    measuredOn: '2026-10-01',
    weeklyRateKg: -0.41,
    rateWindowDays: 28,
    goalWeightKg: 68,
    goalDate: '2026-12-31',
    projectedDate: '2026-11-25',
    series: [
      { date: '2026-09-13', weightKg: 72.5 },
      { date: '2026-10-01', weightKg: 71.1 }
    ],
    ...overrides
  };
}

describe('weight trend figures', () => {
  it('writes kilograms with at most two decimals and drops trailing zeros', () => {
    expect(kgFigure(0.41)).toBe('0.41');
    expect(kgFigure(0.4)).toBe('0.4');
    expect(kgFigure(0.4166)).toBe('0.42');
    expect(kgFigure(2)).toBe('2');
    expect(kgFigure(1234.5)).toBe('1234.5');
  });

  it('writes the goal with at most one decimal', () => {
    expect(goalKgFigure(68)).toBe('68');
    expect(goalKgFigure(67.5)).toBe('67.5');
    expect(goalKgFigure(67.46)).toBe('67.5');
  });

  it('adds the year only when it differs from the reference year', () => {
    expect(trendDate('2026-11-25', '2026-10-01')).toBe('25 Nov');
    expect(trendDate('2027-01-10', '2026-10-01')).toBe('10 Jan 2027');
    expect(trendDate('not a date', '2026-10-01')).toBe('');
  });
});

describe('weight trend sentence', () => {
  it('says the goal comes before the date when the projection is on or before it', () => {
    expect(trendSentence(insight())).toBe('At this pace 68 kg comes on 25 Nov, before your date.');
    expect(trendSentence(insight({ goalDate: '2026-11-25' }))).toBe('At this pace 68 kg comes on 25 Nov, before your date.');
  });

  it('says only when the goal comes when the projection is after the goal date', () => {
    expect(trendSentence(insight({ goalDate: '2026-11-01', projectedDate: '2027-01-10' }))).toBe('At this pace 68 kg comes on 10 Jan 2027.');
    expect(trendSentence(insight({ goalDate: '2026-11-01', projectedDate: '2026-11-25' }))).toBe('At this pace 68 kg comes on 25 Nov.');
  });

  it('says when the goal comes without a remark when the goal has no date', () => {
    expect(trendSentence(insight({ goalDate: null }))).toBe('At this pace 68 kg comes on 25 Nov.');
  });

  it('writes a goal with a decimal as it is', () => {
    expect(trendSentence(insight({ goalWeightKg: 67.5 }))).toContain('67.5 kg comes on');
  });

  it('says nothing for a goal the pace does not lead to', () => {
    expect(trendSentence(insight({ projectedDate: null }))).toBe('');
    expect(trendSentence(insight({ projectedDate: null, weeklyRateKg: null }))).toBe('');
  });

  it('tells the pace when there is no goal', () => {
    const noGoal = { goalWeightKg: null, goalDate: null, projectedDate: null };
    expect(trendSentence(insight({ ...noGoal }))).toBe('Down 0.41 kg a week over four weeks.');
    expect(trendSentence(insight({ ...noGoal, weeklyRateKg: 0.5 }))).toBe('Up 0.5 kg a week over four weeks.');
    expect(trendSentence(insight({ ...noGoal, rateWindowDays: 7 }))).toBe('Down 0.41 kg a week over a week.');
    expect(trendSentence(insight({ ...noGoal, rateWindowDays: 91 }))).toBe('Down 0.41 kg a week over 13 weeks.');
  });

  it('leaves the window out when it is unknown and says nothing for a zero or missing rate', () => {
    const noGoal = { goalWeightKg: null, goalDate: null, projectedDate: null };
    expect(trendSentence(insight({ ...noGoal, rateWindowDays: null }))).toBe('Down 0.41 kg a week.');
    expect(trendSentence(insight({ ...noGoal, weeklyRateKg: 0 }))).toBe('');
    expect(trendSentence(insight({ ...noGoal, weeklyRateKg: 0.004 }))).toBe('');
    expect(trendSentence(insight({ ...noGoal, weeklyRateKg: null }))).toBe('');
  });

  it('never prints null, undefined or NaN', () => {
    const sentences = [
      trendSentence(insight({ referenceDate: null })),
      trendSentence(insight({ weeklyRateKg: Number.NaN, goalWeightKg: null, projectedDate: null })),
      trendSentence(insight({ projectedDate: 'soon' }))
    ];
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/null|undefined|NaN/);
    }
  });
});
