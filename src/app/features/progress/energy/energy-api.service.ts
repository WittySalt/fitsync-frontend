import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { mapEnergyWeek } from './energy-mappers';
import { EnergyWeek } from './energy.models';

type Wire = Record<string, unknown>;

/** Energy this week (API contract section 11). A failure goes to the card, which offers a retry. */
@Injectable({ providedIn: 'root' })
export class EnergyApiService {
  private readonly http = inject(HttpClient);

  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';

  /** The week that starts on `weekStart` (a Monday), or this week when none is given. */
  getWeek(weekStart?: string): Observable<EnergyWeek> {
    let params = new HttpParams().set('timezone', this.timezone);
    if (weekStart) {
      params = params.set('weekStart', weekStart);
    }
    return this.http.get<Wire>('/api/v1/analytics/energy/weekly', { params }).pipe(
      map((response) => {
        const week = mapEnergyWeek(response ?? {});
        if (!week) {
          throw new Error('The energy week could not be read.');
        }
        return week;
      })
    );
  }
}
