import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AdminApiService, CoachQuality, toCoachQuality } from './admin-api.service';

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
    service.getCoachQuality('2026-09-24', '2026-09-30', 'Asia/Singapore').subscribe((value) => (result = value));

    const request = httpTesting.expectOne((req) => req.url === '/api/v1/admin/coach/coach/quality');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-09-24');
    expect(request.request.params.get('to')).toBe('2026-09-30');
    expect(request.request.params.get('timezone')).toBe('Asia/Singapore');
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
});
