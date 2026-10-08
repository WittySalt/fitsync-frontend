import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subscription, map } from 'rxjs';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { PeriodCode, periodOption, periodRange } from './training-period';

/** Where a page's read stands: loading skeletons, the data, or an error with a retry. */
export type Load<T> = { status: 'loading'; previous: T | null } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** The data to show for a state: the answer, or the one before while the next is on its way. */
export function shownData<T>(state: Load<T>): T | null {
  return state.status === 'ready' ? state.data : state.status === 'loading' ? state.previous : null;
}

/**
 * The period of a Training page, read from `?period=` and written back to it, with today's date in
 * the person's zone so "the last four weeks" ends on the same day the server counts.
 */
export function usePeriod() {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const timezone = inject(UserTimezoneService);
  const query = toSignal(route.queryParamMap.pipe(map((params) => params.get('period'))), { initialValue: route.snapshot.queryParamMap.get('period') });
  const code = computed<PeriodCode>(() => periodOption(query()).code);
  const today = computed(() => timezone.dateKey());
  const range = computed(() => periodRange(code(), today()));
  const option = computed(() => periodOption(code()));
  const select = (next: PeriodCode): void => {
    // Four weeks is the default, so it leaves `?period=` out of the address.
    void router.navigate([], { relativeTo: route, queryParams: { period: next === '4w' ? null : next }, queryParamsHandling: 'merge', replaceUrl: true });
  };
  return { code, today, range, option, select };
}

/**
 * Runs a read whenever its inputs change, cancelling the one before, and keeps its state. `retry`
 * runs it again with the same inputs.
 */
export function useLoad<K, T>(key: Signal<K | null>, read: (key: K) => Observable<T>, failure: string) {
  const state = signal<Load<T>>({ status: 'loading', previous: null });
  const attempt = signal(0);
  let running: Subscription | null = null;
  inject(DestroyRef).onDestroy(() => running?.unsubscribe());
  effect(() => {
    const current = key();
    attempt();
    untracked(() => {
      running?.unsubscribe();
      if (current === null) {
        state.set({ status: 'error', message: failure });
        return;
      }
      state.set({ status: 'loading', previous: shownData(state()) });
      running = read(current).subscribe({
        next: (data) => state.set({ status: 'ready', data }),
        error: () => state.set({ status: 'error', message: failure })
      });
    });
  });
  return { state: state.asReadonly(), retry: () => attempt.update((value) => value + 1) };
}
