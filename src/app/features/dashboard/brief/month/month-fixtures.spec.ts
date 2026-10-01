import { AccountBodyMetric } from '../../../../core/account-data.service';
import { MonthDayInsight, MonthlyTrainingInsight } from '../../../../core/fitsync.models';

export function monthInsight(overrides: Partial<MonthlyTrainingInsight> = {}): MonthlyTrainingInsight {
  return {
    timezone: 'Asia/Singapore',
    month: '2026-09',
    monthStart: '2026-09-01',
    monthEnd: '2026-09-30',
    referenceDate: '2026-09-27',
    firstSessionDate: '2026-08-03',
    days: [
      { date: '2026-09-03', kind: 'CARDIO', label: 'Cardio', sessions: 1, minutes: 35, muscles: ['CARDIO'], record: true },
      { date: '2026-09-04', kind: 'STRENGTH', label: 'Strength', sessions: 1, minutes: 50, muscles: ['CHEST'], record: false },
      { date: '2026-09-27', kind: 'SPORT', label: 'Badminton', sessions: 1, minutes: 60, muscles: [], record: false }
    ] satisfies MonthDayInsight[],
    weeks: [],
    totals: { sessions: 16, minutes: 780, records: 3, longestStreakDays: 3 },
    previousTotals: null,
    muscles: [],
    ...overrides
  };
}

export function weighIn(measuredAt: string): AccountBodyMetric {
  return {
    metricId: 'metric-1',
    weightKg: 80,
    bodyFatRate: null,
    waistCm: null,
    hipCm: null,
    chestCm: null,
    armCm: null,
    thighCm: null,
    calfCm: null,
    bmi: null,
    measuredAt,
    source: 'MANUAL',
    note: null
  };
}
