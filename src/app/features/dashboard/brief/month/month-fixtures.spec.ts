import { of } from 'rxjs';

import { AccountBodyMetric } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../../../core/analytics.models';
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

/** A stand-in for the badge request of the month view. */
export function analyticsStub(achievements: AnalyticsAchievement[] = []): jasmine.SpyObj<AnalyticsApiService> {
  const stub = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getAchievements']);
  stub.getAchievements.and.returnValue(of({ achievements }));
  return stub;
}

const day = (date: string, kind: MonthDayInsight['kind'], record = false): MonthDayInsight => ({
  date,
  kind,
  label: kind,
  sessions: 1,
  minutes: 45,
  muscles: [],
  record
});

/** September 2026 as the demo account sees it: 17 sessions over five weeks, the first and the last
 *  of which spill over the month's edges, and August as the month before. */
export function septemberInsight(overrides: Partial<MonthlyTrainingInsight> = {}): MonthlyTrainingInsight {
  return monthInsight({
    days: [
      day('2026-09-03', 'CARDIO', true),
      day('2026-09-07', 'STRENGTH', true),
      day('2026-09-10', 'STRENGTH', true),
      day('2026-09-14', 'STRENGTH', true),
      day('2026-09-21', 'STRENGTH', true),
      day('2026-09-24', 'SPORT', true)
    ],
    weeks: [
      { weekStart: '2026-08-31', weekEnd: '2026-09-06', sessions: 3, minutes: 150, strengthSessions: 2, cardioSessions: 1, mobilitySessions: 0, sportSessions: 0, complete: true },
      { weekStart: '2026-09-07', weekEnd: '2026-09-13', sessions: 4, minutes: 190, strengthSessions: 2, cardioSessions: 1, mobilitySessions: 0, sportSessions: 1, complete: true },
      { weekStart: '2026-09-14', weekEnd: '2026-09-20', sessions: 4, minutes: 200, strengthSessions: 2, cardioSessions: 1, mobilitySessions: 1, sportSessions: 0, complete: true },
      { weekStart: '2026-09-21', weekEnd: '2026-09-27', sessions: 4, minutes: 190, strengthSessions: 2, cardioSessions: 1, mobilitySessions: 0, sportSessions: 1, complete: true },
      { weekStart: '2026-09-28', weekEnd: '2026-10-04', sessions: 2, minutes: 85, strengthSessions: 1, cardioSessions: 0, mobilitySessions: 1, sportSessions: 0, complete: false }
    ],
    totals: { sessions: 17, minutes: 815, records: 6, longestStreakDays: 3 },
    previousTotals: { sessions: 15, minutes: 735, records: 6, longestStreakDays: 3 },
    muscles: [
      { group: 'CHEST', label: 'Chest', sessions: 8 },
      { group: 'BACK', label: 'Back', sessions: 8 },
      { group: 'CORE', label: 'Core', sessions: 13 },
      { group: 'LEGS', label: 'Legs', sessions: 8 },
      { group: 'CARDIO', label: 'Cardio', sessions: 5 }
    ],
    ...overrides
  });
}
