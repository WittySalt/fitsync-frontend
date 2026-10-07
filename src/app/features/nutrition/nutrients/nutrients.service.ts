import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { mapNutrientDetail, mapNutrientsOverview } from './nutrients-mappers';
import { NutrientDetail, NutrientsOverview } from './nutrients.models';

type Wire = Record<string, unknown>;

/**
 * The reads behind All nutrients and a nutrient's page (API contract section 10). A failure goes to
 * the caller so each page can offer a retry; nothing here fills in made-up data.
 */
@Injectable({ providedIn: 'root' })
export class NutrientsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/nutrition/nutrients';

  /** Every nutrient with a reference, in table order, for the days from `from` to `to`. */
  getAll(from: string, to: string, days: number | null = null): Observable<NutrientsOverview> {
    // The server keeps 31 days for from and to; 90 days is asked for by `days`, which ends today.
    const params = days === 90 ? new HttpParams().set('scope', 'all').set('days', '90') : new HttpParams().set('scope', 'all').set('from', from).set('to', to);
    return this.http.get<Wire>(`${this.base}/summary`, { params }).pipe(map((response) => mapNutrientsOverview(response ?? {})));
  }

  /** One nutrient with the person's days and sources and its guide. */
  getOne(code: string, from: string, to: string): Observable<NutrientDetail> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Wire>(`${this.base}/${encodeURIComponent(code)}`, { params }).pipe(
      map((response) => {
        const detail = mapNutrientDetail(response ?? {});
        if (!detail) {
          throw new Error('This nutrient could not be read.');
        }
        return detail;
      })
    );
  }
}
