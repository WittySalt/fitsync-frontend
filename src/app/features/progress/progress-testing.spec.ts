import { of } from 'rxjs';

import { mapFoodNutrition, mapFoodProgress, mapGoalProgress, mapReviews } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService, mergeFood } from './progress-api.service';

/** Wire fixtures for the Progress endpoints, shared by the service and page specs. Figures follow boards 19a and 19b. */
export const GOAL_WIRE = {
  period: { from: '2026-07-05', to: '2026-10-03' },
  previous: { from: '2026-04-05', to: '2026-07-04' },
  goal: { type: 'WEIGHT', targetKg: 68, byDate: '2026-12-11' },
  hero: { nowKg: 71.2, changeKg: -1.6, weeklyRate: { value: -0.41, previous: -0.28 }, projectedDate: { value: '2026-11-25', previous: '2027-01-10' }, daysLeft: 69 },
  highlights: [{ code: 'RATE_IN_RANGE', title: 'You lose 0.41 kg a week.', series: [{ label: '2026-09-07', value: 0.3 }, { label: '2026-09-28', value: 0.41 }], unit: 'kg', context: 'Was 0.28' }],
  weight: {
    daily: [
      { date: '2026-09-28', kg: 71.35 },
      { date: '2026-10-01', kg: 71.2 }
    ],
    weekly: [
      { weekStart: '2026-07-06', avgKg: 74.6, weighIns: 5 },
      { weekStart: '2026-09-28', avgKg: 71.2, weighIns: 3 }
    ],
    projection: [
      { date: '2026-10-01', kg: 71.2 },
      { date: '2026-11-25', kg: 68 }
    ],
    rateChangeMark: { date: '2026-09-14', text: 'Faster from 14 Sept' },
    method: '28-day average change carried forward'
  },
  body: {
    bodyFat: { series: [{ date: '2026-09-05', value: 22.4 }, { date: '2026-10-03', value: 21.3 }], start: 22.4, end: 21.3, context: 'from the smart scale' },
    waist: { series: [{ date: '2026-09-05', value: 85.9 }, { date: '2026-10-03', value: 83.8 }], start: 85.9, end: 83.8, context: '' },
    bmi: null
  },
  pace: { weeks: [{ weekStart: '2026-08-10', expectedKg: -0.1, actualKg: -0.3 }, { weekStart: '2026-09-28', expectedKg: -0.7, actualKg: -2.7 }] },
  otherGoals: [
    { type: 'PROTEIN', target: 140, unit: 'g', metDays: 19, loggedDays: 26, days: [{ date: '2026-09-04', state: 'MET' }, { date: '2026-09-05', state: 'MISSED' }], weeks: [] },
    { type: 'WORKOUT_FREQUENCY', target: 4, unit: 'sessions', metDays: 2, loggedDays: 4, days: [], weeks: [{ weekStart: '2026-09-07', value: 3, target: 4 }, { weekStart: '2026-09-28', value: 4, target: 4 }] }
  ]
};

export const FOOD_WIRE = {
  period: { from: '2026-09-04', to: '2026-10-03' },
  previous: { from: '2026-08-05', to: '2026-09-03' },
  hero: {
    eatenPerDay: { value: 2123, previous: 2189 },
    proteinPerDay: { value: 136, previous: 150 },
    balancePerDay: { value: -279, daysLogged: 5 },
    daysLogged: { value: 26, previous: 24, days: 30 }
  },
  highlights: [{ code: 'PROTEIN_DRIFT', title: 'Protein drifted from 150 g to 136 g a day.', series: [1, 2, 3, 4].map((i) => ({ label: `2026-09-0${i}`, value: 150 - i * 3 })), unit: 'g', context: '' }],
  energy: {
    thisWeek: null,
    weeklyBalance: [
      { weekStart: '2026-09-21', balance: -180, daysLogged: 6, current: false },
      { weekStart: '2026-09-28', balance: -279, daysLogged: 5, current: true }
    ]
  },
  macros: {
    protein: { firstWeek: 150, thisWeek: 136, target: 140, series: [{ weekStart: '2026-08-10', value: 150 }, { weekStart: '2026-09-28', value: 136 }] },
    carbs: { firstWeek: 250, thisWeek: 219, target: 236, series: [{ weekStart: '2026-08-10', value: 250 }, { weekStart: '2026-09-28', value: 219 }] },
    fat: null,
    summary: [{ text: 'Protein 150 → 136 g a day', trend: 'DOWN' }]
  },
  plate: {
    basis: 'CALORIES',
    current: [{ group: 'VEG', kcal: 9900, share: 18 }, { group: 'GRAINS', share: 27 }],
    previous: [{ group: 'VEG', share: 10 }, { group: 'GRAINS', share: 30 }],
    changes: [{ group: 'VEG', deltaPoints: 8 }]
  },
  meals: { share: [{ mealType: 'DINNER', sharePct: 38, deltaPoints: 2, kcalPerDay: 807 }, { mealType: 'BREAKFAST', sharePct: 22 }] },
  habits: { loggedDays: 26 }
};

export const NUTRITION_WIRE = {
  mealTimes: [{ mealType: 'DINNER', medianMinuteOfDay: 1160, p25: 1135, p75: 1185, count: 12 }],
  topFoods: [{ foodCatalogItemId: 'f1', name: 'Chicken breast, grilled', foodGroup: 'PROTEIN', categoryCode: 'POULTRY', times: 18 }],
  cooks: { count: 3, last: { recipeId: 'r3', name: 'Algerian Kefta', finishedAt: '2026-10-02T19:00:00Z' } },
  recentWindow: { from: '2026-09-03', to: '2026-10-03' },
  lowestNutrients: [{ code: 'VIT_D', displayName: 'Vitamin D', share: 0.34 }],
  habits: { loggedDays: 26, fibreMetDays: 11 }
};

export const REVIEWS_WIRE = [
  { weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'READY', headline: 'All four planned days done.', body: 'Calories 7% under the week before.' },
  { weekStart: '2026-09-28', weekEnd: '2026-10-04', current: true, status: 'READY', headline: 'Two sessions in.', body: 'Weight still moving down.' },
  { weekStart: '2026-09-14', weekEnd: '2026-09-20', status: 'NONE', headline: '', body: '' }
];


export const TODAY = '2026-10-03';

export function goalData(): GoalProgress {
  return mapGoalProgress(GOAL_WIRE);
}
export function foodData(): FoodProgress {
  return mergeFood(mapFoodProgress(FOOD_WIRE), mapFoodNutrition(NUTRITION_WIRE));
}
export function reviewsData(): WeeklyReview[] {
  return mapReviews(REVIEWS_WIRE);
}

/** A ProgressApiService stand-in whose answers each test can change. */
export function progressApi(): jasmine.SpyObj<ProgressApiService> {
  const api = jasmine.createSpyObj<ProgressApiService>('ProgressApiService', ['getGoal', 'getFood', 'getReviews', 'getEnergyWeek']);
  api.getGoal.and.callFake(() => of(goalData()));
  api.getFood.and.callFake(() => of(foodData()));
  api.getReviews.and.callFake(() => of(reviewsData()));
  api.getEnergyWeek.and.callFake(() => of(null));
  return api;
}

export const timezoneStub = { dateKey: () => TODAY, zone: () => 'Asia/Singapore' };
