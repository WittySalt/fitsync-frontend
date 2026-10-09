import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { DeviceSession, SessionsApiService } from '../../core/auth/sessions-api.service';
import { ToastService } from '../../core/toast/toast.service';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { DevicesListComponent, relativeTimeAgo } from './devices-list.component';

const NOW = new Date('2026-10-09T12:00:00Z');

const THIS_DEVICE: DeviceSession = {
  sessionId: 'this',
  deviceLabel: 'Chrome on Windows',
  createdAt: '2026-10-01T12:00:00Z',
  lastSeenAt: '2026-10-09T11:59:00Z',
  current: true
};
const PHONE: DeviceSession = {
  sessionId: 'phone',
  deviceLabel: 'Safari on iPhone',
  createdAt: '2026-09-20T12:00:00Z',
  lastSeenAt: '2026-10-09T09:00:00Z',
  current: false
};
const LAPTOP: DeviceSession = {
  sessionId: 'laptop',
  deviceLabel: 'Firefox on Linux',
  createdAt: '2026-09-02T12:00:00Z',
  lastSeenAt: '2026-10-09T11:59:30Z',
  current: false
};

describe('DevicesListComponent', () => {
  let fixture: ComponentFixture<DevicesListComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let sessionsApi: jasmine.SpyObj<SessionsApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  function button(label: string): HTMLButtonElement {
    const found = buttons().find((candidate) => candidate.textContent?.trim() === label);
    if (!found) {
      throw new Error(`No button "${label}"`);
    }
    return found;
  }

  function render(): void {
    fixture = TestBed.createComponent(DevicesListComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(NOW);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['hasRefreshToken']);
    authService.hasRefreshToken.and.returnValue(true);
    sessionsApi = jasmine.createSpyObj<SessionsApiService>('SessionsApiService', ['list', 'revoke', 'revokeOthers']);
    sessionsApi.list.and.returnValue(of([PHONE, THIS_DEVICE, LAPTOP]));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [DevicesListComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionsApiService, useValue: sessionsApi },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
    TestBed.inject(UserTimezoneService).setProfileZone('UTC');
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows a loading state while the list is on its way', () => {
    sessionsApi.list.and.returnValue(NEVER);
    render();

    const loading = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(text()).not.toContain('Only this device is signed in.');
  });

  it('lists this device first, then the others by last activity, with no IP addresses', () => {
    render();

    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.device-row')).map(
      (row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain('Chrome on Windows');
    expect(rows[0]).toContain('This device');
    expect(rows[0]).toContain('Active now');
    expect(rows[0]).toContain('Signed in 1 Oct 2026');
    expect(rows[0]).not.toContain('Sign out');
    expect(rows[1]).toContain('Firefox on Linux');
    expect(rows[1]).toContain('Active now');
    expect(rows[2]).toContain('Safari on iPhone');
    expect(rows[2]).toContain('Last active 3 hours ago');
    expect(rows[2]).toContain('Signed in 20 Sept 2026');
    expect(text()).toContain('Sign out of all other devices');
    expect(text()).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('shows the empty state when only this device is signed in', () => {
    sessionsApi.list.and.returnValue(of([THIS_DEVICE]));
    render();

    expect(text()).toContain('Only this device is signed in.');
    expect(text()).not.toContain('Sign out of all other devices');
  });

  it('shows an error state with a retry that loads the list again', () => {
    sessionsApi.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    render();

    expect(text()).toContain('Your devices could not be loaded.');
    sessionsApi.list.and.returnValue(of([THIS_DEVICE, PHONE]));
    button('Try again').click();
    fixture.detectChanges();

    expect(sessionsApi.list).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Safari on iPhone');
  });

  it('signs out one device and reloads the list', () => {
    sessionsApi.revoke.and.returnValue(of(undefined));
    render();
    sessionsApi.list.and.returnValue(of([THIS_DEVICE, LAPTOP]));

    const phoneRow = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.device-row')).find((row) =>
      row.textContent?.includes('Safari on iPhone')
    )!;
    const signOut = phoneRow.querySelector('button')!;
    expect(signOut.classList).toContain('danger-text');
    signOut.click();
    fixture.detectChanges();

    expect(sessionsApi.revoke).toHaveBeenCalledOnceWith('phone');
    expect(toast.success).toHaveBeenCalledWith('Signed out of 1 device.');
    expect(sessionsApi.list).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Safari on iPhone');
  });

  it('shows the busy label and an error when signing out one device fails', () => {
    const pending = new Subject<void>();
    sessionsApi.revoke.and.returnValue(pending);
    render();

    button('Sign out').click();
    fixture.detectChanges();
    expect(text()).toContain('Signing out...');
    expect(button('Sign out of all other devices').disabled).toBeTrue();

    pending.error(new HttpErrorResponse({ status: 500 }));
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledWith('That device could not be signed out. Try again.');
    expect(sessionsApi.list).toHaveBeenCalledTimes(1);
  });

  it('asks inline before signing out of all other devices and reports the revoked count', () => {
    sessionsApi.revokeOthers.and.returnValue(of(5));
    render();

    button('Sign out of all other devices').click();
    fixture.detectChanges();
    expect(sessionsApi.revokeOthers).not.toHaveBeenCalled();
    expect(text()).toContain('Sign out of every other device?');
    const confirm = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.confirm-row .danger-solid')!;
    expect(document.activeElement).toBe(confirm);

    sessionsApi.list.and.returnValue(of([THIS_DEVICE]));
    confirm.click();
    fixture.detectChanges();

    expect(sessionsApi.revokeOthers).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Signed out of 5 devices.');
    expect(text()).toContain('Only this device is signed in.');
  });

  it('cancels the inline confirm without signing anything out', () => {
    render();

    button('Sign out of all other devices').click();
    fixture.detectChanges();
    button('Cancel').click();
    fixture.detectChanges();

    expect(sessionsApi.revokeOthers).not.toHaveBeenCalled();
    expect(text()).toContain('Sign out of all other devices');
  });

  it('falls back to the number of other devices when the server sends no count', () => {
    sessionsApi.revokeOthers.and.returnValue(of(null));
    render();

    button('Sign out of all other devices').click();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.confirm-row .danger-solid')!.click();

    expect(toast.success).toHaveBeenCalledWith('Signed out of 2 devices.');
  });

  it('shows an error when signing out the other devices fails', () => {
    sessionsApi.revokeOthers.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    render();

    button('Sign out of all other devices').click();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.confirm-row .danger-solid')!.click();

    expect(toast.error).toHaveBeenCalledWith('The other devices could not be signed out. Try again.');
  });

  it('says the list is not available on a backend without refresh tokens, without calling it', () => {
    authService.hasRefreshToken.and.returnValue(false);
    render();

    expect(text()).toContain('Device list is not available yet.');
    expect(sessionsApi.list).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });

  it('says the list is not available when the endpoint does not exist yet', () => {
    sessionsApi.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    render();

    expect(text()).toContain('Device list is not available yet.');
    expect(text()).not.toContain('could not be loaded');
  });
});

describe('relativeTimeAgo', () => {
  const now = NOW.getTime();

  it('describes minutes, hours, days, and months', () => {
    expect(relativeTimeAgo(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(relativeTimeAgo(now - 3 * 3_600_000, now)).toBe('3 hours ago');
    expect(relativeTimeAgo(now - 24 * 3_600_000, now)).toBe('yesterday');
    expect(relativeTimeAgo(now - 60 * 86_400_000, now)).toBe('2 months ago');
  });
});
