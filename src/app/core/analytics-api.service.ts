import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnalyticsActivityCalendarResponse,
  AnalyticsBodyTrendsResponse,
  AnalyticsBucket,
  AnalyticsComparePeriod,
  AnalyticsDashboardResponse,
  AnalyticsGoalStatus,
  AnalyticsGoalsProgressResponse,
  AnalyticsNutritionSeriesResponse,
  AnalyticsNutritionSummaryResponse,
  AnalyticsSummaryCompareResponse,
  AnalyticsWorkoutSeriesResponse,
  AnalyticsWorkoutSummaryResponse
} from './analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);
  private readonly analyticsBaseUrl = '/api/v1/analytics';

  getDashboard(): Observable<AnalyticsDashboardResponse> {
    return this.http.get<AnalyticsDashboardResponse>(`${this.analyticsBaseUrl}/dashboard`);
  }

  getGoalsProgress(status?: AnalyticsGoalStatus): Observable<AnalyticsGoalsProgressResponse> {
    const options = status ? { params: new HttpParams().set('status', status) } : {};
    return this.http.get<AnalyticsGoalsProgressResponse>(`${this.analyticsBaseUrl}/goals/progress`, options);
  }

  getBodyTrends(from: string, to: string, bucket: AnalyticsBucket): Observable<AnalyticsBodyTrendsResponse> {
    return this.http.get<AnalyticsBodyTrendsResponse>(`${this.analyticsBaseUrl}/body/trends`, {
      params: this.rangeBucketParams(from, to, bucket)
    });
  }

  getWorkoutSeries(from: string, to: string, bucket: AnalyticsBucket): Observable<AnalyticsWorkoutSeriesResponse> {
    return this.http.get<AnalyticsWorkoutSeriesResponse>(`${this.analyticsBaseUrl}/workouts/series`, {
      params: this.rangeBucketParams(from, to, bucket)
    });
  }

  getNutritionSeries(from: string, to: string, bucket: AnalyticsBucket): Observable<AnalyticsNutritionSeriesResponse> {
    return this.http.get<AnalyticsNutritionSeriesResponse>(`${this.analyticsBaseUrl}/nutrition/series`, {
      params: this.rangeBucketParams(from, to, bucket)
    });
  }

  getWorkoutSummary(from: string, to: string): Observable<AnalyticsWorkoutSummaryResponse> {
    return this.http.get<AnalyticsWorkoutSummaryResponse>(`${this.analyticsBaseUrl}/workouts/summary`, {
      params: this.rangeParams(from, to)
    });
  }

  getNutritionSummary(from: string, to: string): Observable<AnalyticsNutritionSummaryResponse> {
    return this.http.get<AnalyticsNutritionSummaryResponse>(`${this.analyticsBaseUrl}/nutrition/summary`, {
      params: this.rangeParams(from, to)
    });
  }

  getSummaryCompare(period: AnalyticsComparePeriod): Observable<AnalyticsSummaryCompareResponse> {
    return this.http.get<AnalyticsSummaryCompareResponse>(`${this.analyticsBaseUrl}/summary/compare`, {
      params: new HttpParams().set('period', period)
    });
  }

  getActivityCalendar(from: string, to: string): Observable<AnalyticsActivityCalendarResponse> {
    return this.http.get<AnalyticsActivityCalendarResponse>(`${this.analyticsBaseUrl}/activity/calendar`, {
      params: this.rangeParams(from, to)
    });
  }

  private rangeBucketParams(from: string, to: string, bucket: AnalyticsBucket): HttpParams {
    return this.rangeParams(from, to).set('bucket', bucket);
  }

  private rangeParams(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }
}
