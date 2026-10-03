import { Injectable, computed, signal } from '@angular/core';

import { dateKeyInZone, profileTimezone } from './zone-time';

/**
 * The one place that knows which zone the person lives in. The zone is the profile's own when it is
 * known and a real zone name, otherwise the browser's. The HTTP interceptor sends it as the
 * `X-Timezone` header, and every screen that needs "today" or the start of a week reads it from here,
 * so what the server counts and what the page shows are the same day.
 */
@Injectable({ providedIn: 'root' })
export class UserTimezoneService {
  private readonly profileZone = signal<string | null>(null);

  /** The zone in use, as an IANA name. It changes at once when the profile zone changes. */
  readonly zone = computed(() => profileTimezone(this.profileZone()));

  /** Called whenever a profile is read or saved, so the zone follows Settings without a reload. */
  setProfileZone(timezone: string | null | undefined): void {
    this.profileZone.set(timezone?.trim() || null);
  }

  /** The calendar day of an instant in the zone, as YYYY-MM-DD. */
  dateKey(instant: Date = new Date()): string {
    return dateKeyInZone(instant, this.zone());
  }
}
