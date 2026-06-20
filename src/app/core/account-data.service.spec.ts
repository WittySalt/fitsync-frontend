import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccountDataService } from './account-data.service';

describe('AccountDataService', () => {
  let service: AccountDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountDataService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AccountDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists body metrics with the backend history query parameters', () => {
    let result: unknown;

    service.listBodyMetrics({
      from: '2026-01-01T00:00:00Z',
      to: '2026-06-01T00:00:00Z',
      limit: 50
    }).subscribe((metrics) => {
      result = metrics;
    });

    const request = httpTesting.expectOne((entry) =>
      entry.url === '/api/v1/users/me/body-metrics' &&
      entry.params.get('from') === '2026-01-01T00:00:00Z' &&
      entry.params.get('to') === '2026-06-01T00:00:00Z' &&
      entry.params.get('limit') === '50'
    );
    request.flush([
      {
        metricId: 'metric-1',
        weightKg: 72.4,
        bodyFatRate: 18.2,
        waistCm: 82,
        measuredAt: '2026-06-01T08:00:00Z',
        source: 'MANUAL'
      }
    ]);

    expect(result).toEqual([jasmine.objectContaining({
      metricId: 'metric-1',
      weightKg: 72.4,
      measuredAt: '2026-06-01T08:00:00Z'
    })]);
  });

  it('uploads avatars as multipart form data without forcing the content type', () => {
    const avatar = new Blob(['avatar'], { type: 'image/png' });
    let result: unknown;

    service.uploadAvatar(avatar).subscribe((profile) => {
      result = profile;
    });

    const request = httpTesting.expectOne('/api/v1/users/me/profile/avatar');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.headers.has('Content-Type')).toBeFalse();

    const form = request.request.body as FormData;
    expect(form.get('file')).toEqual(jasmine.any(Blob));

    request.flush({
      displayName: 'Alice Tan',
      firstName: 'Alice',
      lastName: 'Tan',
      avatarUrl: 'https://cdn.example/avatar.png',
      birthDate: null,
      gender: null,
      heightCm: null,
      activityLevel: null,
      timezone: null,
      locationDisplay: null,
      bio: null,
      membershipTier: null,
      membershipStatus: null,
      onboardingCompleted: true
    });

    expect(result).toEqual(jasmine.objectContaining({
      avatarUrl: 'https://cdn.example/avatar.png'
    }));
  });
});
