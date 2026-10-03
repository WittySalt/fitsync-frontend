import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, take } from 'rxjs';

import { AccountDataService } from '../../../core/account-data.service';
import { mapActivityProgress, mapExerciseProgress, mapTrainingProgress, num } from './training-mappers';
import { ActivityProgress, ExerciseProgress, TrainingProgress } from './training.models';

const BASE = '/api/v1/workouts/progress';

/** The header that carries the profile's latest weight for relative strength (contract 1.1). */
export const BODY_WEIGHT_HEADER = 'X-Body-Weight-Kg';

/** A weight the backend accepts for the header: 30 to 300 kg, else none is sent. */
export function validBodyWeight(value: unknown): number | null {
  const weight = num(value);
  return weight !== null && weight >= 30 && weight <= 300 ? Math.round(weight * 10) / 10 : null;
}

/**
 * The three workout-service progress reads. Each sends the profile's latest weight in
 * `X-Body-Weight-Kg` so the server can work out relative strength when it does not project
 * weight itself; a profile that cannot be read, or a weight outside 30 to 300 kg, sends nothing.
 * Failures propagate so each page can show its own retry.
 */
@Injectable({ providedIn: 'root' })
export class TrainingApiService {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountDataService);

  getTraining(from: string, to: string): Observable<TrainingProgress> {
    return this.get(`${BASE}/training`, from, to).pipe(map((response) => mapTrainingProgress(response, from, to)));
  }

  getActivity(key: string, from: string, to: string): Observable<ActivityProgress> {
    return this.get(`${BASE}/activities/${encodeURIComponent(key)}`, from, to).pipe(map((response) => mapActivityProgress(response, key)));
  }

  getExercise(exerciseId: string, from: string, to: string): Observable<ExerciseProgress> {
    return this.get(`${BASE}/exercises/${encodeURIComponent(exerciseId)}`, from, to).pipe(
      map((response) => mapExerciseProgress(response, exerciseId))
    );
  }

  private get(url: string, from: string, to: string): Observable<unknown> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.bodyWeight().pipe(
      switchMap((weight) => {
        const headers = weight === null ? new HttpHeaders() : new HttpHeaders({ [BODY_WEIGHT_HEADER]: String(weight) });
        return this.http.get<unknown>(url, { params, headers });
      })
    );
  }

  private bodyWeight(): Observable<number | null> {
    return this.account.getCurrentUser().pipe(
      take(1),
      map((user) => validBodyWeight(user?.latestBodyMetrics?.weightKg)),
      catchError(() => of(null))
    );
  }
}
