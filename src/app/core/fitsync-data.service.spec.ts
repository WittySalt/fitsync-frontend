import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FitSyncDataService, ProgressData } from './fitsync-data.service';

describe('FitSyncDataService', () => {
  let service: FitSyncDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FitSyncDataService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(FitSyncDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads progress data from body metrics, trend, and goals endpoints', () => {
    let result: ProgressData | undefined;
    service.getProgressData({ startDate: '2026-06-01', endDate: '2026-06-18' }).subscribe((data) => {
      result = data;
    });

    const metricsRequest = httpTesting.expectOne(
      (request) =>
        request.url === '/api/v1/users/me/body-metrics' &&
        request.params.get('startDate') === '2026-06-01' &&
        request.params.get('endDate') === '2026-06-18'
    );
    metricsRequest.flush({
      content: [
        {
          weightKg: 71.8,
          bmi: 24.9,
          bodyFatRate: 20.4,
          waistCm: 82,
          measuredAt: '2026-06-17T07:00:00Z'
        }
      ]
    });

    const trendsRequest = httpTesting.expectOne('/api/v1/users/me/body-metrics/trends?startDate=2026-06-01&endDate=2026-06-18');
    trendsRequest.flush({
      points: [
        {
          weightKg: 72.6,
          bmi: 25.2,
          bodyFatRate: 21.1,
          waistCm: 83,
          date: '2026-06-01'
        }
      ]
    });

    const goalsRequest = httpTesting.expectOne('/api/v1/users/me/goals?status=ACTIVE');
    goalsRequest.flush([
      {
        goalType: 'WEIGHT',
        targetValue: 68,
        targetUnit: 'kg',
        targetDate: '2026-09-30',
        status: 'ACTIVE',
        progressRatio: 0.55
      }
    ]);

    expect(result?.latestBodyMetric?.weightKg).toBe(71.8);
    expect(result?.trendPoints[0].measuredAt).toBe('2026-06-01');
    expect(result?.goals[0].progressRatio).toBe(0.55);
  });
});
