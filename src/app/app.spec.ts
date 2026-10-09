import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { AccountDataService, AccountSummary } from './core/account-data.service';
import { AuthService } from './core/auth/auth.service';
import { CoachStore } from './core/coach/coach.store';
import { GuideService } from './core/guide/guide.service';
import { ThemeService } from './core/theme/theme.service';
import { WorkoutLiveService } from './features/workout/workout-live.service';

describe('App', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;

  const accountSummary: AccountSummary = {
    displayName: 'Alice Tan',
    email: 'alice@example.com',
    initials: 'AT',
    avatarUrl: null,
    authProvider: 'Cognito',
    membershipTier: 'FitSync Member'
  };

  beforeEach(async () => {
    localStorage.removeItem('fs-theme');
    document.documentElement.removeAttribute('data-theme');
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'ensureSession', 'isAdmin']);
    authService.isAdmin.and.returnValue(false);
    authService.ensureSession.and.returnValue(of(true));
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getProfileSummary']);
    accountDataService.getProfileSummary.and.returnValue(of(accountSummary));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // The shell mounts the coach dock, whose store reaches HttpClient through the API client.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('fs-theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders primary navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('FitSync');
    expect(compiled.textContent).toContain('Workout');
    expect(compiled.textContent).toContain('Nutrition');
    expect(compiled.textContent).toContain('Progress');
    // Body was folded into the Progress hub; the bottom nav now carries five items.
    const navLabels = Array.from(compiled.querySelectorAll('.nav-list a')).map((a) => a.textContent?.trim());
    expect(navLabels).toEqual(['Home', 'Workout', 'Nutrition', 'Progress', 'Me']);
  });

  it('shows the privacy notice without the member shell and without asking for a session', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/privacy');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-shell')).toBeNull();
    expect(authService.ensureSession).not.toHaveBeenCalled();
  });

  it('marks the shell while the coach dock is open and lifts the mark when it closes', () => {
    const fixture = TestBed.createComponent(App);
    const shell = (): HTMLElement | null => (fixture.nativeElement as HTMLElement).querySelector('.app-shell');
    fixture.detectChanges();
    expect(shell()?.classList).not.toContain('dock-open');

    TestBed.inject(CoachStore).open();
    fixture.detectChanges();
    expect(shell()?.classList).toContain('dock-open');

    TestBed.inject(CoachStore).close();
    fixture.detectChanges();
    expect(shell()?.classList).not.toContain('dock-open');
  });

  it('makes room for the dock only from 1200 px, in 200 ms, and not for reduced motion', () => {
    const css = ((App as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/\s+/g, ' ');

    expect(css).toMatch(/@media \(min-width: 1200px\) \{[^@]*\.app-shell\.dock-open \{ padding-right: 420px;/);
    expect(css).toContain('transition: padding-right 200ms');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.app-shell \{ transition: none;/);
  });

  it('opens the account menu from the avatar control', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const accountButton = compiled.querySelector<HTMLButtonElement>('.account-button');
    expect(accountButton?.getAttribute('aria-label')).toBe('Open account menu');

    accountButton?.click();
    fixture.detectChanges();

    expect(accountButton?.getAttribute('aria-label')).toBe('Close account menu');
    expect(compiled.textContent).toContain('Profile overview');
    expect(compiled.textContent).toContain('Security settings');
    expect(compiled.textContent).toContain('Sign out');
  });

  it('reflects system theme preference in the header theme control', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const themeButton = compiled.querySelector<HTMLButtonElement>('.theme-toggle');

    expect(themeButton?.getAttribute('aria-label')).toContain('System theme (light)');

    TestBed.inject(ThemeService).setTheme('dark');
    fixture.detectChanges();

    expect(themeButton?.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  function openAccountMenu(fixture: ComponentFixture<App>): HTMLElement {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.account-button')?.click();
    fixture.detectChanges();
    return compiled;
  }

  it('has no way into the admin area from the member account menu', () => {
    const compiled = openAccountMenu(TestBed.createComponent(App));

    expect(compiled.querySelector('.account-popover')).not.toBeNull();
    expect(compiled.querySelector('.account-popover a[href="/admin"]')).toBeNull();
    expect(compiled.querySelector('.account-popover')?.textContent).not.toContain('Admin');
  });

  describe('coach entry in the sidebar', () => {
    it('sits after the navigation and names itself, with the key hint on its right', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const sidebar = (fixture.nativeElement as HTMLElement).querySelector('aside.sidebar') as HTMLElement;
      const entry = sidebar.querySelector<HTMLButtonElement>('.coach-entry');

      expect(entry).not.toBeNull();
      expect(entry?.querySelector('.coach-entry-label')?.textContent?.trim()).toBe('Ask your coach');
      expect(entry?.querySelector('.coach-entry-keys')?.textContent?.trim()).toBe('Ctrl K');
      expect(sidebar.lastElementChild).toBe(entry);
    });

    it('opens the coach panel and reflects it in aria-expanded', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const entry = compiled.querySelector<HTMLButtonElement>('.coach-entry') as HTMLButtonElement;
      expect(entry.getAttribute('aria-expanded')).toBe('false');
      expect(compiled.querySelector('aside.dock')).toBeNull();

      entry.click();
      fixture.detectChanges();

      expect(TestBed.inject(CoachStore).dockOpen()).toBeTrue();
      expect(entry.getAttribute('aria-expanded')).toBe('true');
      expect(compiled.querySelector('aside.dock')).not.toBeNull();
    });
  });

  it('leaves the member navigation and coach dock out of the admin area', async () => {
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: 'admin', children: [] }]);
    await router.navigateByUrl('/admin');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-shell')).toBeNull();
    expect(compiled.querySelector('.nav-list')).toBeNull();
    expect(compiled.querySelector('.bottom-nav')).toBeNull();
    expect(compiled.querySelector('app-coach-dock')).toBeNull();
  });

  describe('the workout in progress', () => {
    const activeUrl = '/api/v1/workouts/sessions/active';
    const requests = () => TestBed.inject(HttpTestingController).match((request) => request.url === activeUrl);

    it('is asked for once the shell knows who is signed in, and shows the bar when there is one', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      const calls = requests();
      expect(calls.length).toBe(1);
      calls[0].flush({
        session: {
          sessionId: 'session-live',
          name: 'Leg day',
          workoutType: 'STRENGTH',
          status: 'IN_PROGRESS',
          startedAt: new Date(Date.now() - 90_000).toISOString(),
          exercises: []
        },
        resume: null
      });
      fixture.detectChanges();

      const bar = (fixture.nativeElement as HTMLElement).querySelector('app-workout-bar .bar');
      expect(bar?.textContent).toContain('Leg day');
    });

    it('shows no bar when the answer is no content', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      requests()[0].flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('app-workout-bar .bar')).toBeNull();
    });

    it('is not asked for while signed out', () => {
      authService.ensureSession.and.returnValue(of(false));
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      expect(requests().length).toBe(0);
    });

    it('is not asked for in the admin area', async () => {
      const router = TestBed.inject(Router);
      router.resetConfig([{ path: 'admin', children: [] }]);
      await router.navigateByUrl('/admin');
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      expect(requests().length).toBe(0);
    });

    it('is asked for later, when a member reaches the app from the admin area', async () => {
      const router = TestBed.inject(Router);
      router.resetConfig([
        { path: 'admin', children: [] },
        { path: 'workout', children: [] }
      ]);
      await router.navigateByUrl('/admin');
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      expect(requests().length).toBe(0);

      await router.navigateByUrl('/workout');
      fixture.detectChanges();

      expect(requests().length).toBe(1);
    });

    it('is forgotten when the person signs out', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      requests()[0].flush({
        session: { sessionId: 'session-live', name: 'Leg day', status: 'IN_PROGRESS', startedAt: new Date().toISOString(), exercises: [] },
        resume: null
      });
      fixture.detectChanges();
      const live = TestBed.inject(WorkoutLiveService);
      expect(live.session()).not.toBeNull();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.account-button')?.click();
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.logout-row')?.click();

      expect(live.session()).toBeNull();
      expect(authService.logout).toHaveBeenCalled();
    });
  });
  describe('the "?" of the guide', () => {
    const entry = (fixture: ComponentFixture<App>): HTMLButtonElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.topbar-actions app-how-this-works .round');

    it('is left of the theme toggle, in the top bar, once the page has a surface with a path', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      expect(entry(fixture)).toBeNull();

      TestBed.inject(GuideService).publishSurface('progress');
      fixture.detectChanges();

      const actions = (fixture.nativeElement as HTMLElement).querySelector('.topbar-actions') as HTMLElement;
      const children = Array.from(actions.children).map((child) => child.tagName.toLowerCase() + (child.classList.contains('theme-toggle') ? '.theme-toggle' : ''));
      expect(children.slice(0, 2)).toEqual(['app-how-this-works', 'button.theme-toggle']);
      expect(entry(fixture)?.getAttribute('aria-label')).toBe('How this works');
      expect(entry(fixture)?.getAttribute('title')).toBe('How this works');
    });

    it('is not drawn on a page that has no path', () => {
      const fixture = TestBed.createComponent(App);
      TestBed.inject(GuideService).publishSurface(null);
      fixture.detectChanges();
      expect(entry(fixture)).toBeNull();
    });
  });
});
