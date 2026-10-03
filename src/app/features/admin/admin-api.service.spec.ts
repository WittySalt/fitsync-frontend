import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  AdminApiService,
  CoachQuality,
  OutboxService,
  toAdminUser,
  toCoachQuality,
  toExerciseSummary,
  toImportResult,
  toOutboxPending,
  toPublishResult,
  toRebuildResult,
  toReconcileResult
} from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('asks for the coach quality with the doubled service path and the range', () => {
    let result: CoachQuality | undefined;
    service.getCoachQuality('2026-09-24', '2026-09-30').subscribe((value) => (result = value));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/admin/coach/coach/quality');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-09-24');
    expect(request.request.params.get('to')).toBe('2026-09-30');
    expect(request.request.params.has('timezone')).toBeFalse();
    request.flush({ from: '2026-09-24', to: '2026-09-30', timezone: 'Asia/Singapore', answers: { total: 4, passed: 3 } });

    expect(result?.answers.total).toBe(4);
    expect(result?.answers.passed).toBe(3);
  });

  it('turns an empty body into zeros and empty lists', () => {
    const quality = toCoachQuality({});

    expect(quality.answers.total).toBe(0);
    expect(quality.answers.rejectedByRule).toEqual([]);
    expect(quality.latency).toEqual({ count: 0, medianMs: 0, p95Ms: 0 });
    expect(quality.tools).toEqual([]);
    expect(quality.readings).toEqual([]);
    expect(quality.daily).toEqual([]);
    expect(toCoachQuality(null).models).toEqual([]);
  });

  it('replaces missing or invalid numbers and texts inside rows', () => {
    const quality = toCoachQuality({
      answers: { rejectedByRule: [{ rule: 'WEEK_NOT_NAMED' }, null as never, { count: 2 }] },
      tools: [{ tool: 'readFacts', calls: 'many' as never }],
      daily: [{ date: '2026-09-30', answers: 3, passed: null }]
    });

    expect(quality.answers.rejectedByRule).toEqual([
      { rule: 'WEEK_NOT_NAMED', count: 0 },
      { rule: '', count: 2 }
    ]);
    expect(quality.tools).toEqual([{ tool: 'readFacts', calls: 0, failed: 0, medianMs: 0 }]);
    expect(quality.daily).toEqual([
      { date: '2026-09-30', answers: 3, passed: 0, rejected: 0, refused: 0, modelUnavailable: 0 }
    ]);
  });

  it('reads the exercise summary from the doubled workout path', () => {
    let total = -1;
    let types: string[] = [];
    service.getExerciseSummary().subscribe((summary) => {
      total = summary.total;
      types = summary.byType.map((row) => `${row.type}:${row.count}`);
    });

    const request = httpTesting.expectOne('/api/v1/admin/workouts/workouts/exercises/summary');
    expect(request.request.method).toBe('GET');
    request.flush({ total: 875, byType: [{ type: 'STRENGTH', count: 675 }, { type: 'CARDIO', count: 16 }] });

    expect(total).toBe(875);
    expect(types).toEqual(['STRENGTH:675', 'CARDIO:16']);
  });

  it('imports the catalogue with a post without a body and keeps only the count of unmapped terms', () => {
    let result: unknown;
    service.importExerciseCatalogue().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/admin/workouts/workouts/exercises/import-catalog');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ processed: 10, created: 4, updated: 5, rejected: 1, unmappedTerms: ['a', 'b', 'c'] });

    expect(result).toEqual({ processed: 10, created: 4, updated: 5, rejected: 1, unmappedTermCount: 3 });
  });

  it('asks each service for its waiting events by its own name', () => {
    const names: OutboxService[] = ['auth', 'users', 'workouts', 'nutrition'];
    for (const name of names) {
      let pending = -1;
      service.getOutboxPending(name).subscribe((value) => (pending = value.pending));

      const request = httpTesting.expectOne(`/api/v1/admin/${name}/outbox/pending`);
      expect(request.request.method).toBe('GET');
      request.flush({ pending: 3, oldestCreatedAt: '2026-09-30T04:00:00Z' });
      expect(pending).toBe(3);
    }
  });

  it('publishes a batch of fifty with a post without a body', () => {
    let published = -1;
    service.publishOutbox('workouts').subscribe((value) => (published = value.publishedCount));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/admin/workouts/outbox/publish');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.params.get('batchSize')).toBe('50');
    request.flush({ requestedBatchSize: 50, publishedCount: 7 });

    expect(published).toBe(7);
  });

  it('looks a user up with the email in the body and nowhere in the address', () => {
    let name = '';
    service.lookupUser('member@example.com').subscribe((user) => (name = user.displayName));

    const request = httpTesting.expectOne('/api/v1/admin/auth/users/lookup');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'member@example.com' });
    expect(request.request.urlWithParams).not.toContain('example.com');
    request.flush({ userId: 'u-1', email: 'member@example.com', displayName: 'Example Member', role: 'MEMBER', authProvider: 'COGNITO' });

    expect(name).toBe('Example Member');
  });

  it('rebuilds the dashboard without parameters', () => {
    service.rebuildDashboard('u-1').subscribe();

    const request = httpTesting.expectOne('/api/v1/admin/analytics/analytics/users/u-1/dashboard/rebuild');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ userId: 'u-1', scope: 'DASHBOARD', date: '', rebuiltAt: '2026-09-30T06:05:00Z' });
  });

  it('rebuilds nutrition and workouts for one date', () => {
    let scopes: string[] = [];
    service.rebuildNutrition('u-1', '2026-09-29').subscribe((value) => (scopes = [...scopes, value.scope]));
    const nutrition = httpTesting.expectOne((req) => req.url === '/api/v1/admin/analytics/analytics/users/u-1/nutrition/rebuild');
    expect(nutrition.request.method).toBe('POST');
    expect(nutrition.request.params.get('date')).toBe('2026-09-29');
    nutrition.flush({ userId: 'u-1', scope: 'NUTRITION', date: '2026-09-29', rebuiltAt: '2026-09-30T06:05:00Z' });

    service.rebuildWorkouts('u-1', '2026-09-28').subscribe((value) => (scopes = [...scopes, value.scope]));
    const workouts = httpTesting.expectOne((req) => req.url === '/api/v1/admin/analytics/analytics/users/u-1/workouts/rebuild');
    expect(workouts.request.method).toBe('POST');
    expect(workouts.request.params.get('date')).toBe('2026-09-28');
    workouts.flush({ userId: 'u-1', scope: 'WORKOUTS', date: '2026-09-28', rebuiltAt: '2026-09-30T06:05:00Z' });

    expect(scopes).toEqual(['NUTRITION', 'WORKOUTS']);
  });

  it('encodes the user id inside the path', () => {
    service.rebuildDashboard('a/b c').subscribe();

    const request = httpTesting.expectOne('/api/v1/admin/analytics/analytics/users/a%2Fb%20c/dashboard/rebuild');
    request.flush({});
  });

  it('reconciles goals for everyone with a post without a body', () => {
    let published = -1;
    service.reconcileGoals().subscribe((value) => (published = value.publishedCount));

    const request = httpTesting.expectOne('/api/v1/admin/users/goals/reconcile');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ publishedCount: 12 });

    expect(published).toBe(12);
  });

  it('turns empty or damaged bodies into zeros, empty texts and empty lists', () => {
    expect(toExerciseSummary({})).toEqual({ total: 0, byType: [] });
    expect(toExerciseSummary({ total: 'many' as never, byType: [null as never, { type: 'CARDIO' }] })).toEqual({
      total: 0,
      byType: [{ type: 'CARDIO', count: 0 }]
    });
    expect(toImportResult(null)).toEqual({ processed: 0, created: 0, updated: 0, rejected: 0, unmappedTermCount: 0 });
    expect(toImportResult({ unmappedTerms: 'none' })).toEqual(jasmine.objectContaining({ unmappedTermCount: 0 }));
    expect(toOutboxPending({})).toEqual({ pending: 0, oldestCreatedAt: null });
    expect(toOutboxPending({ pending: 2, oldestCreatedAt: null })).toEqual({ pending: 2, oldestCreatedAt: null });
    expect(toPublishResult(undefined)).toEqual({ requestedBatchSize: 0, publishedCount: 0 });
    expect(toAdminUser({ email: 'member@example.com', role: null })).toEqual({
      userId: '',
      email: 'member@example.com',
      displayName: '',
      role: '',
      authProvider: ''
    });
    expect(toRebuildResult({})).toEqual({ userId: '', scope: '', date: '', rebuiltAt: '' });
    expect(toReconcileResult({ publishedCount: Number.NaN })).toEqual({ publishedCount: 0 });
  });
});
