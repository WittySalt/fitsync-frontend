import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AccountDataService, AccountUserResponse } from '../account-data.service';
import { adminGuard, authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  let authService: { ensureSession: jasmine.Spy; isAdmin: jasmine.Spy };
  let accountDataService: { getCurrentUser: jasmine.Spy };
  let router: Router;

  const user = { userId: 'u1' } as AccountUserResponse;

  function run(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;
  }

  function result(): boolean | UrlTree | undefined {
    let value: boolean | UrlTree | undefined;
    run().subscribe((next) => (value = next));
    return value;
  }

  beforeEach(() => {
    authService = { ensureSession: jasmine.createSpy('ensureSession').and.returnValue(of(true)), isAdmin: jasmine.createSpy('isAdmin') };
    accountDataService = { getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue(of(user)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService }
      ]
    });
    router = TestBed.inject(Router);
  });

  it('sends a signed-out visitor to the login page', () => {
    authService.ensureSession.and.returnValue(of(false));

    expect(router.serializeUrl(result() as UrlTree)).toBe('/auth/login');
    expect(accountDataService.getCurrentUser).not.toHaveBeenCalled();
  });

  it('sends a member to the dashboard', () => {
    authService.isAdmin.and.returnValue(false);

    expect(router.serializeUrl(result() as UrlTree)).toBe('/dashboard');
  });

  it('lets an administrator through', () => {
    authService.isAdmin.and.returnValue(true);

    expect(result()).toBeTrue();
  });

  it('waits for the current user before deciding', () => {
    const pending = new Subject<AccountUserResponse>();
    accountDataService.getCurrentUser.and.returnValue(pending);
    authService.isAdmin.and.returnValue(false);
    let value: boolean | UrlTree | undefined;

    run().subscribe((next) => (value = next));
    expect(value).toBeUndefined();

    authService.isAdmin.and.returnValue(true);
    pending.next(user);
    pending.complete();
    expect(value).toBeTrue();
  });

  it('sends the visitor to the login page when the current user cannot be loaded', () => {
    accountDataService.getCurrentUser.and.returnValue(throwError(() => new Error('down')));

    expect(router.serializeUrl(result() as UrlTree)).toBe('/auth/login');
  });
});

describe('authGuard', () => {
  let authService: { ensureSession: jasmine.Spy; isAdmin: jasmine.Spy };
  let router: Router;

  function result(profile: { onboardingCompleted: boolean } | null): boolean | UrlTree | undefined {
    const accountDataService = {
      getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue(of({ userId: 'u1', profile } as AccountUserResponse))
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService }
      ]
    });
    router = TestBed.inject(Router);
    let value: boolean | UrlTree | undefined;
    (
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
      ) as Observable<boolean | UrlTree>
    ).subscribe((next) => (value = next));
    return value;
  }

  beforeEach(() => {
    authService = { ensureSession: jasmine.createSpy('ensureSession').and.returnValue(of(true)), isAdmin: jasmine.createSpy('isAdmin') };
  });

  it('sends an administrator to the admin console, whatever the onboarding state', () => {
    authService.isAdmin.and.returnValue(true);

    const tree = result(null) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/admin');
  });

  it('lets a member who finished onboarding through', () => {
    authService.isAdmin.and.returnValue(false);

    expect(result({ onboardingCompleted: true })).toBeTrue();
  });

  it('sends a member who has not finished onboarding to it', () => {
    authService.isAdmin.and.returnValue(false);

    const tree = result({ onboardingCompleted: false }) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/onboarding');
  });
});
