import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { AccountDataService, AccountUserResponse } from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminApiService, toCoachQuality } from './admin-api.service';

describe('admin routes', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    const authService = { ensureSession: () => of(true), isAdmin: () => true };
    const accountDataService = { getCurrentUser: () => of({ userId: 'u1', role: 'ADMIN' } as AccountUserResponse) };
    const adminApi = { getCoachQuality: () => of(toCoachQuality({})) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService },
        { provide: AdminApiService, useValue: adminApi }
      ]
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  it('sends /admin to the coach quality page', async () => {
    await harness.navigateByUrl('/admin');

    expect(router.url).toBe('/admin/coach-quality');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Coach quality');
  });

  it('lets an administrator reach the coach quality page inside the admin shell', async () => {
    await harness.navigateByUrl('/admin/coach-quality');

    expect(router.url).toBe('/admin/coach-quality');
    expect(harness.routeNativeElement?.querySelector('nav[aria-label="Admin"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('FitSync Admin · Coach quality');
  });

  it('shows the same placeholder for the pages that are not built yet', async () => {
    const pages: [string, string][] = [
      ['/admin/catalogue', 'Catalogue'],
      ['/admin/users', 'User data'],
      ['/admin/events', 'Events']
    ];

    for (const [url, heading] of pages) {
      await harness.navigateByUrl(url);
      const main = harness.routeNativeElement?.querySelector('main');
      expect(main?.querySelector('h1')?.textContent).toBe(heading);
      expect(main?.textContent).toContain('This page is being built.');
      expect(TestBed.inject(Title).getTitle()).toBe(`FitSync Admin · ${heading}`);
    }
  });
});
