import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CookRecipe, mapCookRecipe } from './cook.models';

/** Reads one recipe in full (contract section 7.3, with the cook mode fields of section 8). */
@Injectable({ providedIn: 'root' })
export class CookRecipeService {
  private readonly http = inject(HttpClient);

  getRecipe(id: string): Observable<CookRecipe> {
    return this.http
      .get<Record<string, unknown>>(`/api/v1/nutrition/recipes/${encodeURIComponent(id)}`)
      .pipe(map(mapCookRecipe));
  }
}
