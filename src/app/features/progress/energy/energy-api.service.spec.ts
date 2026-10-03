import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EnergyApiService } from './energy-api.service';
import { energyWire } from './energy-testing.spec';

describe('EnergyApiService', () => {
  let service: EnergyApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EnergyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for this week with no parameters when no week is named', () => {
    let status = '';
    service.getWeek().subscribe((week) => (status = week.status));
    const request = http.expectOne((req) => req.url === '/api/v1/analytics/energy/weekly');
    expect(request.request.params.has('weekStart')).toBeFalse();
    expect(request.request.params.keys().length).toBe(0);
    request.flush(energyWire());
    expect(status).toBe('OK');
  });

  it('asks for the week that starts on a given Monday', () => {
    service.getWeek('2026-09-21').subscribe();
    const request = http.expectOne((req) => req.url === '/api/v1/analytics/energy/weekly');
    expect(request.request.params.get('weekStart')).toBe('2026-09-21');
    request.flush(energyWire({ weekStart: '2026-09-21' }));
  });

  it('lets a failure through and fails an answer it cannot read', () => {
    let failed = 0;
    service.getWeek().subscribe({ error: () => failed++ });
    http.expectOne((req) => req.url.endsWith('/weekly')).flush('no', { status: 500, statusText: 'Server Error' });
    service.getWeek('2026-09-21').subscribe({ error: () => failed++ });
    http.expectOne((req) => req.url.endsWith('/weekly')).flush({});
    expect(failed).toBe(2);
  });
});
