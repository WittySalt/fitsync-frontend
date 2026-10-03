import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { AccountDataService, AccountUserResponse } from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { PlaceholderPage } from './placeholder.page';

describe('PlaceholderPage', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let warn: jasmine.Spy;

  beforeEach(async () => {
    warn = spyOn(console, 'warn');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', component: PlaceholderPage, data: { placeholder: 'soon', heading: 'Following friends is on its way.', line: 'Not ready yet.' } },
          ...routes
        ]),
        { provide: AuthService, useValue: { ensureSession: () => of(true), isAdmin: () => false } },
        {
          provide: AccountDataService,
          useValue: { getCurrentUser: () => of({ userId: 'u1', profile: { onboardingCompleted: true } } as AccountUserResponse) }
        }
      ]
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  it('resolves an unknown address to the missing page and shows the path', async () => {
    await harness.navigateByUrl('/progres?token=x');

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBe('This page is off the map.');
    expect(text()).toContain('Page not found');
    expect(text()).toContain('The link may be old or mistyped. Nothing you logged is lost.');
    expect(el.querySelector('.path')?.textContent).toBe('/progres');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(warn).toHaveBeenCalledOnceWith('Page not found: /progres');
  });

  it('Back to Home goes to the dashboard', async () => {
    await harness.navigateByUrl('/nowhere');
    const home = (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>('.home');
    expect(home?.textContent).toContain('Back to Home');

    home?.click();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/dashboard');
  });

  it('renders the soon copy from route data without a path chip', async () => {
    await harness.navigateByUrl('/dashboard');

    const el = harness.routeNativeElement as HTMLElement;
    expect(text()).toContain('Coming soon');
    expect(el.querySelector('h1')?.textContent).toBe('Following friends is on its way.');
    expect(text()).toContain('Not ready yet.');
    expect(el.querySelector('.path')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('moves focus to the heading', async () => {
    await harness.navigateByUrl('/nowhere');
    await harness.fixture.whenStable();

    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('no longer redirects unknown addresses to the dashboard', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBeUndefined();
    expect(wildcard?.data).toEqual({ placeholder: 'missing' });
  });
});
