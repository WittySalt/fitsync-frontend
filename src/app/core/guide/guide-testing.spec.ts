import { Observable, of, throwError } from 'rxjs';

import { AccountDataService } from '../account-data.service';
import { AUTH_STORAGE_KEYS } from '../auth/auth.config';
import { FitSyncDataService } from '../fitsync-data.service';

/** Stores a sign-in for the given subject, in the shape the guide reads. The parts are not a real credential. */
export function signInAs(subject: string): void {
  const body = btoa(JSON.stringify({ sub: subject }));
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, ['header', body, 'signature'].join('.'));
}

/** A createdAt for an account made `days` days ago. */
export function createdDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

/**
 * Stands in for the two things the guide asks the server for: its own state (`/users/me/guide`) and the profile, whose
 * `createdAt` decides whether the account is new. Answers are synchronous, so the state is loaded as soon as the guide
 * adopts a person. Set `failLoad` to make the load fail, and read `puts` for what was written back.
 */
export class GuideBackendFake {
  /** The state the server holds, or null for a person with no row. */
  state: Record<string, unknown> | null = null;
  createdAt: string | null = createdDaysAgo(1);
  failLoad = false;
  readonly puts: Record<string, unknown>[] = [];
  completedSessions = 0;
  gets = 0;

  readonly data = {
    getGuideState: (): Observable<{ state: Record<string, unknown> | null; updatedAt: string | null }> => {
      this.gets++;
      return this.failLoad ? throwError(() => new Error('down')) : of({ state: this.state, updatedAt: null });
    },
    putGuideState: (state: Record<string, unknown>): Observable<{ state: Record<string, unknown>; updatedAt: string }> => {
      this.puts.push(state);
      this.state = state;
      return of({ state, updatedAt: '2026-10-07T00:00:00Z' });
    },
    getWorkoutSessionPage: (): Observable<{ sessions: unknown[] }> => of({ sessions: this.completedSessions ? [{}] : [] })
  };

  readonly account = {
    getCurrentUser: (): Observable<{ profile: { createdAt: string | null } }> => of({ profile: { createdAt: this.createdAt } })
  };

  /** What to hand to TestBed so the guide reads this fake. Extra methods can be added to `data` before this is called. */
  providers(): { provide: unknown; useValue: unknown }[] {
    return [
      { provide: FitSyncDataService, useValue: this.data },
      { provide: AccountDataService, useValue: this.account }
    ];
  }
}

/** The steps of one path whose anchors are written into the markup of `root` (static attributes), in document order. */
export function anchorSteps(root: ParentNode, page: string): string[] {
  return Array.from(root.querySelectorAll(`[appspotlight="${page}"]`)).map((anchor) => anchor.getAttribute('spotlightstep') ?? '');
}
