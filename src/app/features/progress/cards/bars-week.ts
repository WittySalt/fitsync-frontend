import { Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';

import { shiftWeek, thisMonday } from '../energy/energy-figures';
import { EnergyWeek } from '../energy/energy.models';
import { FoodProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { BarsWeek, barsWeek } from './energy-fallback';

/**
 * The week the Food card and the Food page read their energy balance from: this week, else the
 * last full week, else the average of the weeks before. The four earlier weeks are read only when
 * this week is too young to draw. Call it in an injection context, as a field initialiser.
 */
export function useBarsWeek(food: Signal<FoodProgress | null>, today: Signal<string>): Signal<BarsWeek | null> {
  const api = inject(ProgressApiService);
  // The Mondays of the four weeks before the one that holds today, newest first.
  const earlierMondays = computed(
    () => {
      const current = food();
      if (!current || current.energy.thisWeek?.status === 'OK') {
        return [] as string[];
      }
      const monday = thisMonday(today());
      return [1, 2, 3, 4].map((back) => shiftWeek(monday, -back));
    },
    { equal: (a, b) => a.join() === b.join() }
  );
  const earlierWeeks = toSignal(
    toObservable(earlierMondays).pipe(
      switchMap((mondays) => (mondays.length ? forkJoin(mondays.map((monday) => api.getEnergyWeek(monday))) : of([] as (EnergyWeek | null)[])))
    ),
    { initialValue: [] as (EnergyWeek | null)[] }
  );
  return computed(() => barsWeek(food()?.energy.thisWeek ?? null, earlierWeeks()));
}
