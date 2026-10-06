import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { mapBadges } from './me-mappers';
import {
  AnalyticsAchievement,
  AnalyticsAchievementsResponse,
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

  /** Compares this period so far with the same days of the one before. The X-Timezone header
   *  tells the server which day is today. */
  getSummaryCompare(period: AnalyticsComparePeriod): Observable<AnalyticsSummaryCompareResponse> {
    const params = new HttpParams().set('period', period);
    return this.http.get<AnalyticsSummaryCompareResponse>(`${this.analyticsBaseUrl}/summary/compare`, { params });
  }

  getActivityCalendar(from: string, to: string): Observable<AnalyticsActivityCalendarResponse> {
    return this.http.get<AnalyticsActivityCalendarResponse>(`${this.analyticsBaseUrl}/activity/calendar`, {
      params: this.rangeParams(from, to)
    });
  }

  /** The badges flattened to one list with their progress, for the pages that only need a date or a
   *  percentage (the month view, the workout celebration). Both the old response and the themed one
   *  are read. Entries without a code are dropped and progress is forced into 0 to 1. */
  getAchievements(): Observable<AnalyticsAchievementsResponse> {
    return this.http.get<Record<string, unknown>>(`${this.analyticsBaseUrl}/achievements`).pipe(
      map((response) => {
        if (Array.isArray(response?.['themes'])) {
          const nodes = mapBadges(response).themes.flatMap((theme) => theme.paths.flatMap((path) => path.nodes));
          return {
            achievements: nodes.map((node) => ({
              code: node.code,
              title: node.name,
              unlocked: node.earnedOn !== null,
              unlockedAt: node.earnedOn ? `${node.earnedOn}T00:00:00Z` : null,
              progress: node.earnedOn ? 1 : node.progress.target > 0 ? clampUnit(node.progress.current / node.progress.target) : 0
            }))
          };
        }
        const list = response?.['achievements'] as Partial<AnalyticsAchievement>[] | null | undefined;
        return {
          achievements: (Array.isArray(list) ? list : [])
            .filter((entry) => typeof entry?.code === 'string' && entry.code.length > 0)
            .map((entry) => ({
              code: entry.code as string,
              title: typeof entry.title === 'string' && entry.title.trim() ? entry.title : (entry.code as string),
              unlocked: entry.unlocked === true,
              unlockedAt: typeof entry.unlockedAt === 'string' && entry.unlockedAt ? entry.unlockedAt : null,
              progress: clampUnit(entry.progress)
            }))
        };
      })
    );
  }

  private rangeBucketParams(from: string, to: string, bucket: AnalyticsBucket): HttpParams {
    return this.rangeParams(from, to).set('bucket', bucket);
  }

  private rangeParams(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }
}

function clampUnit(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? Math.min(Math.max(number, 0), 1) : 0;
}
