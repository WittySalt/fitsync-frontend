import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { Meal, MealItemDraft } from '../../../core/fitsync.models';
import {
  DiaryMeal,
  DiarySummary,
  DrinkDetail,
  DrinkOption,
  FrequentDrink,
  NutrientSummary,
  RangeDay,
  WaterDay
} from './diary.models';
import {
  mapDiaryMeal,
  mapDiarySummary,
  mapDrinkDetail,
  mapDrinkOption,
  mapFrequentDrink,
  mapNutrientSummary,
  mapRangeDay,
  mapWaterDay
} from './diary-mappers';
import { dayBounds, mealTypeByClock } from './diary-time';

type Wire = Record<string, unknown>;

interface PageOf<T> {
  content?: T[];
}

/**
 * The calls behind the Nutrition Diary. Reads let a failure through so each card can show its own
 * retry; nothing here falls back to made-up data. Paths follow the Diary API contract.
 */
@Injectable({ providedIn: 'root' })
export class NutritionDiaryService {
  private readonly http = inject(HttpClient);
  private readonly dataService = inject(FitSyncDataService);
  private readonly base = '/api/v1/nutrition';

  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';

  getSummary(date: string): Observable<DiarySummary> {
    const params = new HttpParams().set('date', date).set('timezone', this.timezone);
    return this.http.get<Wire>(`${this.base}/summary/daily`, { params }).pipe(map(mapDiarySummary));
  }

  /** Every meal logged on a local day, with its foods. */
  getMeals(date: string): Observable<DiaryMeal[]> {
    const { from, to } = dayBounds(date);
    const params = new HttpParams().set('from', from).set('to', to).set('timezone', this.timezone);
    return this.http.get<Wire[]>(`${this.base}/meals`, { params }).pipe(map((meals) => (meals ?? []).map(mapDiaryMeal)));
  }

  /** The days from `from` to `to`, at most 31. */
  getRange(from: string, to: string): Observable<RangeDay[]> {
    const params = new HttpParams().set('from', from).set('to', to).set('timezone', this.timezone);
    return this.http.get<Wire>(`${this.base}/summary/range`, { params }).pipe(
      map((response) => (Array.isArray(response?.['days']) ? (response['days'] as Wire[]).map(mapRangeDay) : []))
    );
  }

  getWater(date: string): Observable<WaterDay> {
    const params = new HttpParams().set('date', date).set('timezone', this.timezone);
    return this.http.get<Wire>(`${this.base}/water`, { params }).pipe(map((response) => mapWaterDay(response ?? {}, date)));
  }

  getNutrients(from: string, to: string): Observable<NutrientSummary> {
    const params = new HttpParams().set('from', from).set('to', to).set('timezone', this.timezone);
    return this.http.get<Wire>(`${this.base}/nutrients/summary`, { params }).pipe(map((response) => mapNutrientSummary(response ?? {})));
  }

  searchDrinks(query: string): Observable<DrinkOption[]> {
    const params = new HttpParams().set('q', query).set('foodGroup', 'DRINKS').set('size', '8');
    return this.http
      .get<PageOf<Wire>>(`${this.base}/foods/search`, { params })
      .pipe(map((page) => this.drinkOptions(page?.content ?? [])));
  }

  recentDrinks(limit = 6): Observable<DrinkOption[]> {
    const params = new HttpParams().set('foodGroup', 'DRINKS').set('limit', String(limit));
    return this.http.get<Wire[]>(`${this.base}/foods/recent`, { params }).pipe(map((foods) => this.drinkOptions(foods ?? [])));
  }

  frequentDrinks(limit = 2): Observable<FrequentDrink[]> {
    const params = new HttpParams().set('foodGroup', 'DRINKS').set('limit', String(limit));
    return this.http.get<Wire[]>(`${this.base}/foods/frequent`, { params }).pipe(
      map((foods) => (foods ?? []).map(mapFrequentDrink).filter((drink): drink is FrequentDrink => drink !== null))
    );
  }

  getDrinkDetail(foodId: string): Observable<DrinkDetail> {
    return this.http.get<Wire>(`${this.base}/foods/${encodeURIComponent(foodId)}`).pipe(map(mapDrinkDetail));
  }

  /** Plain water. The server answers with the entry, whose id the undo uses. */
  logWater(amountMl: number, at: Date): Observable<{ waterId: string }> {
    return this.http
      .post<Wire>(`${this.base}/water`, { amountMl, loggedAt: at.toISOString(), timezone: this.timezone })
      .pipe(map((entry) => ({ waterId: typeof entry?.['waterId'] === 'string' ? entry['waterId'] : '' })));
  }

  deleteWater(waterId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/water/${encodeURIComponent(waterId)}`);
  }

  /** A drink is a meal of one food, filed under the meal type the clock gives. */
  logDrink(item: MealItemDraft, at: Date): Observable<Meal> {
    return this.dataService.createMeal({
      mealType: mealTypeByClock(at),
      name: item.foodName,
      note: '',
      consumedAt: at.toISOString(),
      timezone: this.timezone,
      items: [item]
    });
  }

  /** Soft delete on the server: the meal stops showing everywhere and nothing is lost for good. */
  deleteMeal(mealId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meals/${encodeURIComponent(mealId)}`);
  }

  private drinkOptions(foods: Wire[]): DrinkOption[] {
    return foods.map(mapDrinkOption).filter((option): option is DrinkOption => option !== null);
  }
}
