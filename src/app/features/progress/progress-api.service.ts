import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { mapFoodNutrition, mapFoodProgress, mapGoalProgress, mapReviews } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';

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
    }).pipe(map(({ analytics, nutrition }) => ({ ...analytics, nutrition })));
  }

  /** The last `weeks` weekly reviews, newest first. */
  getReviews(weeks = 8): Observable<WeeklyReview[]> {
    return this.http.get<unknown>('/api/v1/coach/reviews', { params: new HttpParams().set('weeks', weeks) }).pipe(map(mapReviews));
  }
}

function period(from: string, to: string): HttpParams {
  return new HttpParams().set('from', from).set('to', to);
}
