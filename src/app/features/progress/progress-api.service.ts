import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { mapEnergyWeek } from './energy/energy-mappers';
import { EnergyWeek } from './energy/energy.models';
import { mapFoodNutrition, mapFoodProgress, mapGoalProgress, mapReviews } from './progress-api.mappers';
import { dateRangeLabel } from '../../shared/date-label';
import { FoodGranularity, FoodNutrition, FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';

/**
 * The reads behind the Goal page, the Food page and the weekly reviews. Each sends only `from` and
 * `to`; the zone goes in the X-Timezone header from the interceptor and the user from the token.
 */
@Injectable({ providedIn: 'root' })
export class ProgressApiService {
  private readonly http = inject(HttpClient);

  getGoal(from: string, to: string): Observable<GoalProgress> {
    return this.http.get<unknown>('/api/v1/analytics/progress/goal', { params: period(from, to) }).pipe(map(mapGoalProgress));
  }

  /**
   * The Food page: analytics' figures and nutrition's, merged here. Analytics carries the page, so
   * its failure fails the read; nutrition's failure only leaves its sections without figures.
   */
  getFood(from: string, to: string, granularity: FoodGranularity = 'week'): Observable<FoodProgress> {
    const params = period(from, to);
    // Only analytics knows months; the week answer is asked for exactly as before.
    const analyticsParams = granularity === 'month' ? params.set('granularity', 'month') : params;
    return forkJoin({
      analytics: this.http.get<unknown>('/api/v1/analytics/progress/food', { params: analyticsParams }).pipe(map((response) => mapFoodProgress(response, granularity))),
      nutrition: this.http.get<unknown>('/api/v1/nutrition/progress/food', { params }).pipe(
        map(mapFoodNutrition),
        catchError(() => of(null))
      )
    }).pipe(map(({ analytics, nutrition }) => mergeFood(analytics, nutrition)));
  }

  /** One week of energy by its Monday; null when the read fails or the answer has no week, so a card can go without it. */
  getEnergyWeek(weekStart: string): Observable<EnergyWeek | null> {
    return this.http
      .get<Record<string, unknown>>('/api/v1/analytics/energy/weekly', { params: new HttpParams().set('weekStart', weekStart) })
      .pipe(
        map((wire) => mapEnergyWeek(wire)),
        catchError(() => of(null))
      );
  }

  /** The last `weeks` weekly reviews, newest first. */
  getReviews(weeks = 8): Observable<WeeklyReview[]> {
    return this.http.get<unknown>('/api/v1/coach/reviews', { params: new HttpParams().set('weeks', weeks) }).pipe(map(mapReviews));
  }
}

/**
 * Analytics has no micronutrients and no water or fibre, so the lowest nutrient finding and those two
 * habits come from nutrition. Their days are nutrition's recent window, so its logged days go with them.
 */
export function mergeFood(analytics: Omit<FoodProgress, 'nutrition'>, nutrition: FoodNutrition | null): FoodProgress {
  const habits = nutrition
    ? {
        waterMetDays: nutrition.habits.waterMetDays,
        fibreMetDays: nutrition.habits.fibreMetDays,
        loggedDays: nutrition.habits.loggedDays ?? analytics.habits.loggedDays,
        loggedDaysPerMonth: analytics.habits.loggedDaysPerMonth
      }
    : { waterMetDays: null, fibreMetDays: null, loggedDays: analytics.habits.loggedDays, loggedDaysPerMonth: analytics.habits.loggedDaysPerMonth };
  const lowest = nutrition?.lowestNutrients[0];
  const highlights =
    lowest && analytics.highlights.length < 4 && !analytics.highlights.some((h) => h.code === 'LOWEST_NUTRIENT')
      ? [
          ...analytics.highlights,
          {
            code: 'LOWEST_NUTRIENT',
            title: `${lowest.displayName} is the furthest short, ${Math.round(lowest.share * 100)}% of the daily amount.`,
            series: [
              { label: lowest.displayName, value: Math.round(lowest.share * 100) },
              { label: 'Daily amount', value: 100 }
            ],
            unit: '%',
            context: nutrition?.recentWindow ? `On average, ${dateRangeLabel(nutrition.recentWindow.from, nutrition.recentWindow.to)}` : 'On average'
          }
        ]
      : analytics.highlights;
  return { ...analytics, highlights, habits, nutrition };
}

function period(from: string, to: string): HttpParams {
  return new HttpParams().set('from', from).set('to', to);
}
