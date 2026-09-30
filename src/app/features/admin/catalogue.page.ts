import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { AdminAction, isForbidden } from './admin-action';
import { AdminActionStatusComponent } from './admin-action-status.component';
import { AdminApiService, CatalogueImportResult, ExerciseSummary } from './admin-api.service';
import { AdminConfirmButtonComponent } from './admin-confirm-button.component';
import { titleCase } from './admin-format';
import { barWidthPercent, largestCount } from './coach-quality.chart';
import { sharePercent } from './coach-quality.format';

type LoadState = { kind: 'loading' } | { kind: 'ready'; summary: ExerciseSummary } | { kind: 'error'; forbidden: boolean };

interface TypeRow {
  type: string;
  label: string;
  count: number;
  percent: number;
  widthPercent: number;
}

/** The sentence that reports an import; the unmapped terms are only counted. */
export function importResultMessage(result: CatalogueImportResult): string {
  const line = `Processed ${result.processed}. Created ${result.created}, updated ${result.updated}, rejected ${result.rejected}.`;
  if (result.unmappedTermCount <= 0) {
    return line;
  }
  return `${line} ${result.unmappedTermCount} ${result.unmappedTermCount === 1 ? 'term' : 'terms'} could not be mapped.`;
}

@Component({
  selector: 'app-admin-catalogue-page',
  imports: [AdminConfirmButtonComponent, AdminActionStatusComponent],
  templateUrl: './catalogue.page.html',
  styleUrls: ['./admin-page.scss', './catalogue.page.scss']
})
export class CataloguePage {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  // The flag says whether the reload is silent: after an import the page keeps what it shows until the new numbers arrive.
  private readonly reload$ = new Subject<boolean>();

  protected readonly state = signal<LoadState>({ kind: 'loading' });
  protected readonly importing = new AdminAction();

  protected readonly summary = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.summary : null;
  });

  protected readonly forbidden = computed(() => {
    const state = this.state();
    return state.kind === 'error' && state.forbidden;
  });

  protected readonly total = computed(() => this.summary()?.total ?? 0);

  protected readonly rows = computed<TypeRow[]>(() => {
    const byType = this.summary()?.byType ?? [];
    const total = this.total();
    const largest = largestCount(byType);
    return [...byType]
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
      .map((row) => ({
        type: row.type,
        label: titleCase(row.type) || 'Unknown',
        count: row.count,
        percent: sharePercent(row.count, total),
        widthPercent: barWidthPercent(row.count, largest)
      }));
  });

  constructor() {
    this.reload$
      .pipe(
        switchMap((silent) => {
          const request: Observable<LoadState> = this.api.getExerciseSummary().pipe(
            map((summary): LoadState => ({ kind: 'ready', summary })),
            catchError((error: unknown) => (silent ? EMPTY : of<LoadState>({ kind: 'error', forbidden: isForbidden(error) })))
          );
          return silent ? request : request.pipe(startWith<LoadState>({ kind: 'loading' }));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((state) => this.state.set(state));

    this.reload$.next(false);
  }

  protected retry(): void {
    this.reload$.next(false);
  }

  protected runImport(): void {
    this.importing.run(
      () => this.api.importExerciseCatalogue(),
      (result) => importResultMessage(result),
      () => this.reload$.next(true)
    );
  }
}
