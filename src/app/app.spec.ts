import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { AccountDataService, AccountSummary } from './core/account-data.service';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';

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

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'ensureSession']);
    authService.ensureSession.and.returnValue(of(true));
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getProfileSummary']);
    accountDataService.getProfileSummary.and.returnValue(of(accountSummary));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
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
});
