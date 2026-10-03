import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { mapFoodNutrition, mapFoodProgress, mapGoalProgress, mapReviews } from './progress-api.mappers';
import { dateRangeLabel } from '../../shared/date-label';
import { FoodNutrition, FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';

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
  getFood(from: string, to: string): Observable<FoodProgress> {
    const params = period(from, to);
    return forkJoin({
      analytics: this.http.get<unknown>('/api/v1/analytics/progress/food', { params }).pipe(map(mapFoodProgress)),
      nutrition: this.http.get<unknown>('/api/v1/nutrition/progress/food', { params }).pipe(
        map(mapFoodNutrition),
        catchError(() => of(null))
      )
    }).pipe(map(({ analytics, nutrition }) => mergeFood(analytics, nutrition)));
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
        loggedDays: nutrition.habits.loggedDays ?? analytics.habits.loggedDays
      }
    : { waterMetDays: null, fibreMetDays: null, loggedDays: analytics.habits.loggedDays };
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
