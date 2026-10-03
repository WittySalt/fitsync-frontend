import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { timezoneInterceptor } from './timezone.interceptor';
import { UserTimezoneService } from './user-timezone.service';

describe('timezoneInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let zone: UserTimezoneService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([timezoneInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    zone = TestBed.inject(UserTimezoneService);
  });

  afterEach(() => controller.verify());

  it('sends the profile zone on backend calls', () => {
    zone.setProfileZone('Pacific/Auckland');
    http.get('/api/v1/users/me').subscribe();
    const request = controller.expectOne('/api/v1/users/me');
    expect(request.request.headers.get('X-Timezone')).toBe('Pacific/Auckland');
    request.flush({});
  });

  it('falls back to the browser zone when the profile has none or an unknown one', () => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    zone.setProfileZone('Not/AZone');
    http.get('/api/v1/users/me').subscribe();
    const request = controller.expectOne('/api/v1/users/me');
    expect(request.request.headers.get('X-Timezone')).toBe(browser);
    request.flush({});
  });

  it('follows a zone change without a reload', () => {
    zone.setProfileZone('Asia/Tokyo');
    http.get('/api/v1/a').subscribe();
    expect(controller.expectOne('/api/v1/a').request.headers.get('X-Timezone')).toBe('Asia/Tokyo');
    zone.setProfileZone('Europe/London');
    http.get('/api/v1/b').subscribe();
    expect(controller.expectOne('/api/v1/b').request.headers.get('X-Timezone')).toBe('Europe/London');
  });

  it('leaves Cognito and other external calls alone', () => {
    http.post('https://cognito-idp.ap-southeast-1.amazonaws.com/', {}).subscribe();
    http.get('https://example.com/api/v1/x').subscribe();
    controller.expectOne('https://cognito-idp.ap-southeast-1.amazonaws.com/').flush({});
    const other = controller.expectOne('https://example.com/api/v1/x');
    expect(other.request.headers.has('X-Timezone')).toBe(false);
    other.flush({});
  });
});
