import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';

import { formatDeletionDate } from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { DeviceSession, SessionsApiService } from '../../core/auth/sessions-api.service';
import { ToastService } from '../../core/toast/toast.service';
import { UserTimezoneService } from '../../core/user-timezone.service';

type DevicesState = 'unavailable' | 'loading' | 'error' | 'ready';

const ACTIVE_NOW_MS = 2 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const RELATIVE_TIME = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago", "yesterday", "3 months ago" for an instant in the past. */
export function relativeTimeAgo(instantMs: number, nowMs: number): string {
  const elapsed = Math.max(nowMs - instantMs, 0);
  if (elapsed < HOUR_MS) {
    return RELATIVE_TIME.format(-Math.max(Math.floor(elapsed / MINUTE_MS), 1), 'minute');
  }
  if (elapsed < DAY_MS) {
    return RELATIVE_TIME.format(-Math.floor(elapsed / HOUR_MS), 'hour');
  }
  if (elapsed < 30 * DAY_MS) {
    return RELATIVE_TIME.format(-Math.floor(elapsed / DAY_MS), 'day');
  }
  if (elapsed < 365 * DAY_MS) {
    return RELATIVE_TIME.format(-Math.floor(elapsed / (30 * DAY_MS)), 'month');
  }
  return RELATIVE_TIME.format(-Math.floor(elapsed / (365 * DAY_MS)), 'year');
}

export function signedOutMessage(count: number): string {
  return `Signed out of ${count} ${count === 1 ? 'device' : 'devices'}.`;
}

/** Settings, Security: the devices signed in to this account, and signing them out. */
@Component({
  selector: 'app-devices-list',
  templateUrl: './devices-list.component.html',
  styleUrl: './devices-list.component.scss'
})
export class DevicesListComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly sessionsApi = inject(SessionsApiService);
  private readonly toast = inject(ToastService);
  private readonly userTimezone = inject(UserTimezoneService);

  readonly state = signal<DevicesState>('loading');
  readonly sessions = signal<DeviceSession[]>([]);
  /** The session being signed out, or 'others' while every other device is. */
  readonly revoking = signal<string | null>(null);
  readonly confirmingOthers = signal(false);

  readonly otherSessions = computed(() => this.sessions().filter((session) => !session.current));

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmOthers');

  constructor() {
    // The confirm step replaces the button that opened it, so focus moves to the confirm button.
    effect(() => this.confirmButton()?.nativeElement.focus());
  }

  ngOnInit(): void {
    if (!this.authService.hasRefreshToken()) {
      // A backend without refresh tokens has no device list either.
      this.state.set('unavailable');
      return;
    }
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.sessionsApi.list().subscribe({
      next: (sessions) => {
        this.sessions.set(this.ordered(sessions));
        this.state.set('ready');
      },
      error: (error: unknown) => {
        this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'unavailable' : 'error');
      }
    });
  }

  revoke(session: DeviceSession): void {
    if (this.revoking() || session.current) {
      return;
    }
    this.revoking.set(session.sessionId);
    this.sessionsApi.revoke(session.sessionId).subscribe({
      next: () => {
        this.revoking.set(null);
        this.toast.success(signedOutMessage(1));
        this.load();
      },
      error: (error: unknown) => {
        this.revoking.set(null);
        this.toast.error('That device could not be signed out. Try again.');
        // A 404 means the session is already gone, so the list is out of date.
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.load();
        }
      }
    });
  }

  revokeOthers(): void {
    if (this.revoking()) {
      return;
    }
    const expected = this.otherSessions().length;
    this.revoking.set('others');
    this.sessionsApi.revokeOthers().subscribe({
      next: (count) => {
        this.revoking.set(null);
        this.confirmingOthers.set(false);
        this.toast.success(signedOutMessage(count ?? expected));
        this.load();
      },
      error: () => {
        this.revoking.set(null);
        this.toast.error('The other devices could not be signed out. Try again.');
      }
    });
  }

  protected activityLine(session: DeviceSession): string {
    if (session.current) {
      return 'Active now';
    }
    const lastSeen = Date.parse(session.lastSeenAt ?? session.createdAt ?? '');
    if (Number.isNaN(lastSeen)) {
      return 'Last active time unknown';
    }
    const now = Date.now();
    return now - lastSeen < ACTIVE_NOW_MS ? 'Active now' : `Last active ${relativeTimeAgo(lastSeen, now)}`;
  }

  protected signedInLine(session: DeviceSession): string {
    const date = formatDeletionDate(session.createdAt, this.userTimezone.zone());
    return date ? `Signed in ${date}` : '';
  }

  private ordered(sessions: DeviceSession[]): DeviceSession[] {
    const lastSeen = (session: DeviceSession): number => Date.parse(session.lastSeenAt ?? session.createdAt ?? '') || 0;
    return [...sessions].sort((a, b) => Number(b.current) - Number(a.current) || lastSeen(b) - lastSeen(a));
  }
}
