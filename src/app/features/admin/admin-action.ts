import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';

export interface ActionResult {
  kind: 'success' | 'error';
  message: string;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 403;
}

/**
 * The state of one admin action: whether it runs, and what it said last. It ignores a second call while
 * the first is still running, so a double click cannot send the request twice. Create it as a field of a
 * component, because it ends its request together with the component.
 */
export class AdminAction {
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelled$ = new Subject<void>();

  readonly busy = signal(false);
  readonly result = signal<ActionResult | null>(null);

  run<T>(request: () => Observable<T>, describe: (value: T) => string, afterSuccess?: (value: T) => void): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.result.set(null);
    request()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntil(this.cancelled$),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (value) => {
          this.result.set({ kind: 'success', message: describe(value) });
          afterSuccess?.(value);
        },
        error: (error: unknown) => {
          this.result.set({
            kind: 'error',
            message: isForbidden(error) ? 'This action is for administrators.' : 'It did not run. Try again.'
          });
        }
      });
  }

  /** Forgets the last result and drops a request that is still running, for when what it belongs to has gone. */
  reset(): void {
    this.cancelled$.next();
    this.busy.set(false);
    this.result.set(null);
  }
}
