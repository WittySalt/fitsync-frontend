import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NutrientsService } from './nutrients.service';

describe('NutrientsService', () => {
  let service: NutrientsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NutrientsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for every nutrient with scope=all, the range and the time zone', () => {
    let count = -1;
    service.getAll('2026-09-26', '2026-10-02').subscribe((overview) => (count = overview.nutrients.length));
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/nutrients/summary');
    expect(request.request.params.get('scope')).toBe('all');
    expect(request.request.params.get('from')).toBe('2026-09-26');
    expect(request.request.params.get('to')).toBe('2026-10-02');
    expect(request.request.params.has('timezone')).toBeFalse();
    request.flush({ daysLogged: 3, nutrients: [{ code: 'IRON', groupCode: 'TRACE_MINERAL', reference: 8, averageAmount: 4 }, { code: 'FIBER', groupCode: null, reference: 30 }] });
    expect(count).toBe(1);
  });

  it('asks for 90 days with from and to, and sends no days parameter', () => {
    service.getAll('2026-07-05', '2026-10-02').subscribe();
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/nutrients/summary');
    expect(request.request.params.get('from')).toBe('2026-07-05');
    expect(request.request.params.get('to')).toBe('2026-10-02');
    expect(request.request.params.has('days')).toBeFalse();
    request.flush({ daysLogged: 40, nutrients: [] });
  });

  it('reads one nutrient by its encoded code', () => {
    let name = '';
    service.getOne('VIT_D', '2026-10-02', '2026-10-02').subscribe((detail) => (name = detail.tile.displayName));
    const request = http.expectOne((req) => req.url === '/api/v1/nutrition/nutrients/VIT_D');
    expect(request.request.params.get('from')).toBe('2026-10-02');
    request.flush({ code: 'VIT_D', displayName: 'Vitamin D', groupCode: 'FAT_SOLUBLE', reference: 15, guide: null });
    expect(name).toBe('Vitamin D');
  });

  it('lets a failure through, and a 404 reads as an error too', () => {
    let failed = 0;
    service.getAll('a', 'b').subscribe({ error: () => failed++ });
    http.expectOne((req) => req.url.endsWith('/summary')).flush('no', { status: 500, statusText: 'Server Error' });
    service.getOne('NOPE', 'a', 'b').subscribe({ error: () => failed++ });
    http.expectOne((req) => req.url.endsWith('/NOPE')).flush('no', { status: 404, statusText: 'Not Found' });
    expect(failed).toBe(2);
  });

  it('fails a detail that has no daily amount to measure against', () => {
    let failed = false;
    service.getOne('X', 'a', 'b').subscribe({ error: () => (failed = true) });
    http.expectOne((req) => req.url.endsWith('/X')).flush({});
    expect(failed).toBeTrue();
  });
});
