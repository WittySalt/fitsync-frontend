import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { AccountDataService, AccountSummary } from './core/account-data.service';
import { AuthService } from './core/auth/auth.service';

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
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'ensureSession']);
    authService.ensureSession.and.returnValue(of(true));
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getAccountSummary']);
    accountDataService.getAccountSummary.and.returnValue(of(accountSummary));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService }
      ]
    }).compileComponents();
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
    expect(compiled.textContent).toContain('Body');
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
});
