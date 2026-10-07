import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CookRecipe, mapCookRecipe } from './cook.models';

export interface CookRecord {
  /** Made when the cook session started, so sending it again counts once. */
  clientCookId: string;
  servings: number;
  /** The servings the Finished card logged; 0 when none, so every cooked serving is left. */
  servingsLogged: number;
  startedAt: Date;
  finishedAt: Date;
}

/** Reads one recipe in full (contract section 7.3, with the cook mode fields of section 8) and records a finished cook. */
@Injectable({ providedIn: 'root' })
export class CookRecipeService {
  private readonly http = inject(HttpClient);

  /** Records that the recipe was cooked (POST /recipes/{id}/cooks, contract section 9.4). */
  recordCook(id: string, record: CookRecord): Observable<number | null> {
    return this.http
      .post(`/api/v1/nutrition/recipes/${encodeURIComponent(id)}/cooks`, {
        clientCookId: record.clientCookId,
        servings: record.servings,
        servingsLogged: record.servingsLogged,
        startedAt: record.startedAt.toISOString(),
        finishedAt: record.finishedAt.toISOString()
      })
      .pipe(map((view) => ((view as Record<string, unknown> | null)?.['servingsLeft'] as number | undefined) ?? null));
  }

  getRecipe(id: string): Observable<CookRecipe> {
    return this.http
      .get<Record<string, unknown>>(`/api/v1/nutrition/recipes/${encodeURIComponent(id)}`)
      .pipe(map(mapCookRecipe));
  }
}
