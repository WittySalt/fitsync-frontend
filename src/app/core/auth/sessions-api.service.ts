import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

/** One signed-in device. The API sends no IP address, and the app never shows one. */
export interface DeviceSession {
  sessionId: string;
  deviceLabel: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  current: boolean;
}

const SESSIONS_URL = '/api/v1/auth/sessions';

function toDeviceSession(raw: unknown): DeviceSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value['sessionId'] !== 'string' || !value['sessionId']) {
    return null;
  }
  const text = (field: string): string | null => (typeof value[field] === 'string' ? (value[field] as string) : null);
  return {
    sessionId: value['sessionId'],
    deviceLabel: text('deviceLabel'),
    createdAt: text('createdAt'),
    lastSeenAt: text('lastSeenAt'),
    current: value['current'] === true
  };
}

@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<DeviceSession[]> {
    return this.http.get<{ sessions?: unknown }>(SESSIONS_URL).pipe(
      map((response) => (Array.isArray(response?.sessions) ? (response.sessions as unknown[]) : [])),
      map((sessions) => sessions.map(toDeviceSession).filter((session): session is DeviceSession => session !== null))
    );
  }

  revoke(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${SESSIONS_URL}/${encodeURIComponent(sessionId)}`);
  }

  /** Signs out every other device. Emits the number the server revoked, or null when it did not say. */
  revokeOthers(): Observable<number | null> {
    return this.http
      .delete<void>(SESSIONS_URL, { params: { scope: 'others' }, observe: 'response' })
      .pipe(
        map((response) => {
          const count = Number.parseInt(response.headers.get('X-Revoked-Count') ?? '', 10);
          return Number.isNaN(count) || count < 0 ? null : count;
        })
      );
  }
}
