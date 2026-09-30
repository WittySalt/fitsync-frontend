import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AdminApiService, AdminUser, GoalReconcileResult, RebuildResult } from './admin-api.service';
import { UserDataPage, rebuiltMessage } from './user-data.page';

const user: AdminUser = {
  userId: 'u-1',
  email: 'member@example.com',
  displayName: 'Example Member',
  role: 'MEMBER',
  authProvider: 'COGNITO'
};

function rebuilt(scope: string): RebuildResult {
  return { userId: 'u-1', scope, date: '2026-09-30', rebuiltAt: new Date(2026, 8, 30, 14, 5).toISOString() };
}


// Angular drops the whitespace between elements, so the pieces of text are joined with a space.
function text(target: Element | null | undefined): string {
  const pieces: string[] = [];
  const walker = document.createTreeWalker(target ?? document.createElement('div'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const piece = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces.join(' ');
}

describe('UserDataPage', () => {
  let fixture: ComponentFixture<UserDataPage>;
  let api: jasmine.SpyObj<AdminApiService>;
  let element: HTMLElement;

  function create(): void {
    fixture = TestBed.createComponent(UserDataPage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find((candidate) => text(candidate) === label);
    if (!found) {
      throw new Error(`No button named ${label}`);
    }
    return found;
  }

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(`No input ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function search(email: string): void {
    type('#admin-user-email', email);
    click('Find');
  }

  const message = () => text(element.querySelector('.message'));
  const panel = (heading: string) => Array.from(element.querySelectorAll('section.panel')).find((candidate) => text(candidate.querySelector('h2')) === heading) as HTMLElement;
  const statusOf = (scope: Element) => text(scope.querySelector('[role="status"]'));
  const actionRow = (label: string) => Array.from(element.querySelectorAll('.action-row')).find((candidate) => text(candidate.querySelector('button')) === label) as HTMLElement;

  beforeEach(async () => {
    // Noon UTC is the same calendar day in every timezone from UTC-11 to UTC+11.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-30T12:00:00Z'));
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'lookupUser',
      'rebuildDashboard',
      'rebuildNutrition',
      'rebuildWorkouts',
      'reconcileGoals'
    ]);
    await TestBed.configureTestingModule({
      imports: [UserDataPage],
      providers: [{ provide: AdminApiService, useValue: api }]
    }).compileComponents();
  });

  afterEach(() => jasmine.clock().uninstall());

  function findUser(response: Observable<AdminUser> = of(user)): void {
    api.lookupUser.and.returnValue(response);
    create();
    search('member@example.com');
  }

  describe('the search form', () => {
    it('has one labelled email input with the limits and no autofill', () => {
      create();
      const input = element.querySelector<HTMLInputElement>('#admin-user-email');

      expect(text(element.querySelector('label[for="admin-user-email"]'))).toBe('Email');
      expect(input?.type).toBe('email');
      expect(input?.required).toBeTrue();
      expect(input?.maxLength).toBe(120);
      expect(input?.getAttribute('autocomplete')).toBe('off');
      expect(element.querySelectorAll('form input').length).toBe(1);
      expect(button('Find').type).toBe('submit');
      expect(text(element.querySelector('h1'))).toBe('User data');
    });

    it('shows no user and no rebuild panel before a search, but always the goals panel', () => {
      create();

      expect(element.querySelector('dl')).toBeNull();
      expect(panel('Rebuild analytics')).toBeUndefined();
      expect(panel('Goals')).toBeDefined();
    });

    it('does not send an empty or malformed address and asks for a valid one', () => {
      create();

      click('Find');
      expect(message()).toBe('Enter a valid email address.');

      search('not-an-address');
      expect(message()).toBe('Enter a valid email address.');
      expect(api.lookupUser).not.toHaveBeenCalled();
      expect(element.querySelector('#admin-user-email')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('sends the trimmed address and marks Find busy while it waits', () => {
      const request = new Subject<AdminUser>();
      api.lookupUser.and.returnValue(request);
      create();

      search('  member@example.com ');

      expect(api.lookupUser).toHaveBeenCalledOnceWith('member@example.com');
      expect(button('Find').disabled).toBeTrue();
      expect(button('Find').getAttribute('aria-busy')).toBe('true');

      request.next(user);
      request.complete();
      fixture.detectChanges();

      expect(button('Find').disabled).toBeFalse();
    });

    it('says that no account has the email on a 404', () => {
      findUser(throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(message()).toBe('No account has this email.');
      expect(element.querySelector('dl')).toBeNull();
    });

    it('asks for a valid address when the server answers 400', () => {
      findUser(throwError(() => new HttpErrorResponse({ status: 400 })));

      expect(message()).toBe('Enter a valid email address.');
    });

    it('fails in plain words on any other error', () => {
      findUser(throwError(() => new HttpErrorResponse({ status: 500 })));

      expect(message()).toBe('The search did not work. Try again.');
      expect(element.querySelector('#admin-user-email')?.getAttribute('aria-invalid')).toBe('false');
    });

    it('tells a member that the page is for administrators', () => {
      findUser(throwError(() => new HttpErrorResponse({ status: 403 })));

      expect(text(element.querySelector('[role="alert"]'))).toBe('This page is for administrators.');
      expect(element.querySelector('form')).toBeNull();
    });
  });

  describe('the found user', () => {
    it('shows exactly five fields', () => {
      findUser();

      const rows = Array.from(element.querySelectorAll('dl .field-row')).map((row) => [text(row.querySelector('dt')), text(row.querySelector('dd'))]);

      expect(rows).toEqual([
        ['Name', 'Example Member'],
        ['Email', 'member@example.com'],
        ['Role', 'Member'],
        ['Sign-in', 'Cognito'],
        ['User ID', 'u-1']
      ]);
      expect(element.querySelectorAll('dl dd.mono').length).toBe(1);
      expect(text(element.querySelectorAll('dl dd.mono')[0])).toBe('u-1');
    });

    it('writes a dash for a field the server left out', () => {
      findUser(of({ ...user, displayName: '' }));

      expect(text(element.querySelector('dl .field-row dd'))).toBe('-');
    });

    it('drops the user when the input names another address', () => {
      findUser();

      type('#admin-user-email', 'other@example.com');

      expect(element.querySelector('dl')).toBeNull();
      expect(panel('Rebuild analytics')).toBeUndefined();
    });

    it('keeps the user when the input still names the same address in another case', () => {
      findUser();

      type('#admin-user-email', ' Member@Example.com ');

      expect(element.querySelector('dl')).not.toBeNull();
    });

    it('replaces the user when a new search runs and forgets the earlier rebuild results', () => {
      findUser();
      api.rebuildDashboard.and.returnValue(of(rebuilt('DASHBOARD')));
      click('Rebuild dashboard');
      click('Confirm');
      expect(statusOf(actionRow('Rebuild dashboard'))).toBe('Rebuilt at 14:05.');

      api.lookupUser.and.returnValue(of({ ...user, userId: 'u-2', email: 'other@example.com', displayName: 'Other Member' }));
      search('other@example.com');

      expect(text(element.querySelectorAll('dl dd')[0])).toBe('Other Member');
      expect(statusOf(actionRow('Rebuild dashboard'))).toBe('');
    });

    it('keeps the user out of storage and out of the address', () => {
      const address = window.location.href;
      const stored = [localStorage.length, sessionStorage.length];

      findUser();

      expect(window.location.href).toBe(address);
      expect([localStorage.length, sessionStorage.length]).toEqual(stored);
    });
  });

  describe('the date of a rebuild', () => {
    beforeEach(() => findUser());

    it('starts at today and cannot go past today', () => {
      const input = element.querySelector<HTMLInputElement>('#admin-rebuild-date');

      expect(input?.type).toBe('date');
      expect(input?.value).toBe('2026-09-30');
      expect(input?.max).toBe('2026-09-30');
      expect(text(element.querySelector('label[for="admin-rebuild-date"]'))).toBe('Date');
    });

    it('turns off the two date actions for a day after today or no day, but not the dashboard rebuild', () => {
      type('#admin-rebuild-date', '2026-10-01');

      expect(button('Rebuild nutrition for this date').disabled).toBeTrue();
      expect(button('Rebuild workouts for this date').disabled).toBeTrue();
      expect(button('Rebuild dashboard').disabled).toBeFalse();

      type('#admin-rebuild-date', '');

      expect(button('Rebuild nutrition for this date').disabled).toBeTrue();

      type('#admin-rebuild-date', '2026-09-29');

      expect(button('Rebuild nutrition for this date').disabled).toBeFalse();
    });
  });

  describe('the rebuild actions', () => {
    beforeEach(() => findUser());

    it('asks before rebuilding the dashboard and runs nothing on Cancel', () => {
      click('Rebuild dashboard');

      expect(text(actionRow('Confirm'))).toContain('Cancel');
      expect(api.rebuildDashboard).not.toHaveBeenCalled();

      click('Cancel');

      expect(api.rebuildDashboard).not.toHaveBeenCalled();
    });

    it('rebuilds the dashboard once, stays busy, and reports the time', () => {
      const request = new Subject<RebuildResult>();
      api.rebuildDashboard.and.returnValue(request);

      click('Rebuild dashboard');
      click('Confirm');

      expect(api.rebuildDashboard).toHaveBeenCalledOnceWith('u-1');
      expect(button('Rebuild dashboard').disabled).toBeTrue();
      expect(button('Rebuild dashboard').getAttribute('aria-busy')).toBe('true');

      request.next(rebuilt('DASHBOARD'));
      request.complete();
      fixture.detectChanges();

      expect(statusOf(actionRow('Rebuild dashboard'))).toBe('Rebuilt at 14:05.');
      expect(button('Rebuild dashboard').disabled).toBeFalse();
    });

    it('rebuilds nutrition for the chosen date', () => {
      api.rebuildNutrition.and.returnValue(of(rebuilt('NUTRITION')));
      type('#admin-rebuild-date', '2026-09-28');

      click('Rebuild nutrition for this date');
      click('Confirm');

      expect(api.rebuildNutrition).toHaveBeenCalledOnceWith('u-1', '2026-09-28');
      expect(statusOf(actionRow('Rebuild nutrition for this date'))).toBe('Rebuilt at 14:05.');
    });

    it('rebuilds workouts for the default date', () => {
      api.rebuildWorkouts.and.returnValue(of(rebuilt('WORKOUTS')));

      click('Rebuild workouts for this date');
      click('Confirm');

      expect(api.rebuildWorkouts).toHaveBeenCalledOnceWith('u-1', '2026-09-30');
      expect(statusOf(actionRow('Rebuild workouts for this date'))).toBe('Rebuilt at 14:05.');
    });

    it('shows a failure next to the action that failed and no other', () => {
      api.rebuildNutrition.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      click('Rebuild nutrition for this date');
      click('Confirm');

      expect(statusOf(actionRow('Rebuild nutrition for this date'))).toBe('It did not run. Try again.');
      expect(statusOf(actionRow('Rebuild workouts for this date'))).toBe('');
      expect(button('Rebuild nutrition for this date').disabled).toBeFalse();
    });

    it('cannot send a rebuild twice with a double click on Confirm', () => {
      api.rebuildDashboard.and.returnValue(new Subject<RebuildResult>());

      click('Rebuild dashboard');
      const confirm = button('Confirm');
      confirm.click();
      confirm.click();

      expect(api.rebuildDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('the goals action', () => {
    it('is there without a user and reports how many events were published', () => {
      create();
      const request = new Subject<GoalReconcileResult>();
      api.reconcileGoals.and.returnValue(request);

      click('Reconcile goals for all users');
      expect(api.reconcileGoals).not.toHaveBeenCalled();
      click('Confirm');

      expect(api.reconcileGoals).toHaveBeenCalledTimes(1);
      expect(button('Reconcile goals for all users').disabled).toBeTrue();
      expect(button('Reconcile goals for all users').getAttribute('aria-busy')).toBe('true');

      request.next({ publishedCount: 12 });
      request.complete();
      fixture.detectChanges();

      expect(statusOf(panel('Goals'))).toBe('Published 12 goal events.');
    });

    it('runs nothing on Cancel and shows a failure in words', () => {
      create();
      api.reconcileGoals.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      click('Reconcile goals for all users');
      click('Cancel');
      expect(api.reconcileGoals).not.toHaveBeenCalled();

      click('Reconcile goals for all users');
      click('Confirm');

      expect(statusOf(panel('Goals'))).toBe('It did not run. Try again.');
    });
  });

  describe('rebuiltMessage', () => {
    it('falls back to the current time when the server sent none', () => {
      const now = new Date(2026, 8, 30, 9, 3);

      expect(rebuiltMessage({ userId: '', scope: '', date: '', rebuiltAt: '' }, now)).toBe('Rebuilt at 09:03.');
    });
  });
});

describe('UserDataPage requests', () => {
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<UserDataPage>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDataPage],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserDataPage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => httpTesting.verify());

  it('never puts the email in the address of any request', () => {
    const input = element.querySelector<HTMLInputElement>('#admin-user-email');
    if (!input) {
      throw new Error('No email input');
    }
    input.value = 'member@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const lookup = httpTesting.expectOne('/api/v1/admin/auth/users/lookup');
    expect(lookup.request.method).toBe('POST');
    expect(lookup.request.body).toEqual({ email: 'member@example.com' });
    expect(lookup.request.urlWithParams).not.toContain('example.com');
    lookup.flush({ userId: 'u-1', email: 'member@example.com', displayName: 'Example Member', role: 'MEMBER', authProvider: 'COGNITO' });
    fixture.detectChanges();

    const rebuild = Array.from(element.querySelectorAll('button')).find((candidate) => text(candidate) === 'Rebuild dashboard');
    rebuild?.click();
    fixture.detectChanges();
    Array.from(element.querySelectorAll('button')).find((candidate) => text(candidate) === 'Confirm')?.click();

    const request = httpTesting.expectOne((req) => req.url.endsWith('/dashboard/rebuild'));
    expect(request.request.urlWithParams).toBe('/api/v1/admin/analytics/analytics/users/u-1/dashboard/rebuild');
    request.flush({ userId: 'u-1', scope: 'DASHBOARD', date: '', rebuiltAt: '' });
  });
});
