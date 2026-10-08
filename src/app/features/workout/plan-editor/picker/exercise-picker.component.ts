import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { Exercise, ExerciseDetail, PagedExercises } from '../../../../core/fitsync.models';
import { MuscleFigureComponent } from '../../../../shared/charts/muscle-figure/muscle-figure.component';
import { MUSCLE_GROUPS } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { StatePanelComponent } from '../../../../shared/state-panel.component';
import { PickedExercise, pickedFrom, pickerLineOf, thumbnailOf } from '../moves/moves-model';
import {
  LEVEL_CHIPS,
  MUSCLE_CHIPS,
  PICKER_PAGE_SIZE,
  PickerFilters,
  SEARCH_DEBOUNCE_MS,
  imagesOf,
  mergeExercises,
  ownedEquipmentCodes,
  searchOptionsFor,
  stepsOf
} from './picker-filters';

interface LoadRequest {
  page: number;
  append: boolean;
}

interface LoadResult {
  items: Exercise[];
  hasMore: boolean;
}

const FALLBACK_EQUIPMENT = ['BODYWEIGHT', 'DUMBBELL', 'BARBELL', 'KETTLEBELL', 'MACHINE', 'CABLE', 'BAND', 'CARDIO_MACHINE'];

/**
 * The exercise picker (spec section 4): a dialog on computers and a bottom sheet on phones. It
 * searches the catalogue with the filters the person sets and hands a chosen exercise up through
 * `picked`. In add mode "Keep adding" leaves it open so several moves go in one visit.
 */
@Component({
  selector: 'app-exercise-picker',
  imports: [MuscleFigureComponent, StatePanelComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exercise-picker.component.html',
  styleUrl: './exercise-picker.component.scss',
  host: { '(document:keydown.escape)': 'closed.emit()', '(window:resize)': 'syncWide()' }
})
export class ExercisePickerComponent {
  /** The name of the move being swapped; null when the picker adds a move. */
  readonly swapName = input<string | null>(null);
  readonly timeBasedDefault = input(false);
  readonly picked = output<PickedExercise>();
  readonly closed = output<void>();

  private readonly data = inject(FitSyncDataService);
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly load$ = new Subject<LoadRequest>();
  private readonly typed$ = new Subject<void>();

  protected readonly muscleChips = MUSCLE_CHIPS;
  protected readonly levelChips = LEVEL_CHIPS;
  // Every group gets the same count (8 reads as the "low" heat level), so the figure is evenly tinted and
  // works only as a muscle chooser here, not as a chart.
  protected readonly allGroups = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 8]));

  readonly ready = signal(false);
  /** From 768 px of viewport the picker is a dialog with the muscle figure; below it is a bottom sheet. */
  readonly wide = signal(typeof window !== 'undefined' && window.innerWidth >= 768);
  readonly q = signal('');
  readonly muscle = signal<string | null>(null);
  readonly equipment = signal<string | null>(null);
  readonly level = signal<string | null>(null);
  /** "What I own": offered only when the profile lists equipment, and on by default then. */
  readonly ownedCodes = signal<string[] | null>(null);
  readonly owned = signal(false);
  readonly equipmentChoices = signal<string[]>(FALLBACK_EQUIPMENT);
  readonly catalogueTotal = signal<number | null>(null);

  readonly items = signal<Exercise[]>([]);
  readonly page = signal(0);
  readonly hasMore = signal(false);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly failed = signal(false);

  readonly keepAdding = signal(false);
  readonly addedCount = signal(0);
  readonly expandedId = signal<string | null>(null);
  readonly details = signal<Record<string, ExerciseDetail | null | 'loading'>>({});

  readonly swapping = computed(() => this.swapName() !== null);
  readonly title = computed(() => (this.swapping() ? `Swap ${this.swapName()}` : 'Add a move'));
  readonly placeholder = computed(() => {
    const total = this.catalogueTotal();
    return total ? `Search ${total.toLocaleString('en-US')} exercises` : 'Search exercises';
  });
  readonly expandedDetail = computed(() => {
    const id = this.expandedId();
    const detail = id ? this.details()[id] : null;
    return detail && detail !== 'loading' ? detail : null;
  });

  constructor() {
    this.load$
      .pipe(
        switchMap((request) => {
          this.failed.set(false);
          (request.append ? this.loadingMore : this.loading).set(true);
          return this.run(request.page).pipe(
            map((result) => ({ request, result })),
            catchError(() => of({ request, result: null as LoadResult | null }))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(({ request, result }) => {
        this.loading.set(false);
        this.loadingMore.set(false);
        if (!result) {
          this.failed.set(true);
          return;
        }
        this.page.set(request.page);
        this.hasMore.set(result.hasMore);
        this.items.set(request.append ? mergeUnique(this.items(), result.items) : result.items);
      });

    this.typed$.pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed()).subscribe(() => this.reload());

    forkJoin({
      metadata: this.data.getExerciseMetadata().pipe(catchError(() => of(null))),
      seed: this.data.getOnboardingSeed().pipe(catchError(() => of(null))),
      all: this.data.searchExercisesPage({ q: '', page: 0, size: 1 }).pipe(catchError(() => of(null as PagedExercises | null)))
    })
      .pipe(takeUntilDestroyed())
      .subscribe(({ metadata, seed, all }) => {
        const catalogue = metadata?.equipment ?? [];
        if (catalogue.length) {
          this.equipmentChoices.set(catalogue.filter((code) => code !== 'NONE' && code !== 'OTHER'));
        }
        const codes = ownedEquipmentCodes(seed?.value.equipmentInventory, catalogue);
        this.ownedCodes.set(codes);
        this.owned.set(codes !== null);
        this.catalogueTotal.set(all?.totalElements ?? null);
        this.ready.set(true);
        this.reload();
      });

    afterNextRender(() => this.search()?.nativeElement.focus());
  }

  syncWide(): void {
    this.wide.set(window.innerWidth >= 768);
  }

  protected label(code: string): string {
    return code.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
  }

  protected lineOf(exercise: Exercise): string {
    return pickerLineOf(exercise);
  }

  protected thumbOf(exercise: Exercise): string | null {
    return thumbnailOf(exercise);
  }

  protected framesOf(exercise: Exercise): string[] {
    const detail = this.expandedDetail();
    const frames = imagesOf(detail ?? exercise);
    return frames.slice(0, this.wide() ? 2 : 1);
  }

  protected stepsOf(exercise: Exercise): string[] {
    const detail = this.expandedDetail();
    return stepsOf(detail ?? { shortSteps: [], description: exercise.description });
  }

  setQuery(text: string): void {
    this.q.set(text);
    this.typed$.next();
  }

  /** Tapping the chip of the picked group lets it go; a muscle on the figure does the same as its chip. */
  pickMuscle(code: string): void {
    this.muscle.update((current) => (current === code ? null : code));
    this.reload();
  }

  pickEquipment(code: string): void {
    this.equipment.update((current) => (current === code ? null : code));
    if (this.equipment()) {
      this.owned.set(false);
    }
    this.reload();
  }

  toggleOwned(): void {
    this.owned.update((on) => !on);
    if (this.owned()) {
      this.equipment.set(null);
    }
    this.reload();
  }

  pickLevel(code: string): void {
    this.level.set(code || null);
    this.reload();
  }

  showMore(): void {
    if (this.hasMore() && !this.loadingMore()) {
      this.load$.next({ page: this.page() + 1, append: true });
    }
  }

  reload(): void {
    this.expandedId.set(null);
    this.load$.next({ page: 0, append: false });
  }

  toggleExpand(exercise: Exercise): void {
    const id = exercise.exerciseId;
    if (!id) {
      return;
    }
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    if (id in this.details()) {
      return;
    }
    this.details.update((all) => ({ ...all, [id]: 'loading' }));
    this.data.getExercise(id).subscribe({
      next: (detail) => this.details.update((all) => ({ ...all, [id]: detail })),
      error: () => this.details.update((all) => ({ ...all, [id]: null }))
    });
  }

  choose(exercise: Exercise): void {
    const picked = pickedFrom(exercise);
    if (!picked) {
      return;
    }
    this.picked.emit(picked);
    this.addedCount.update((count) => count + 1);
    if (this.swapping() || !this.keepAdding()) {
      this.closed.emit();
    }
  }

  private filters(): PickerFilters {
    return { q: this.q(), muscle: this.muscle(), equipment: this.equipment(), level: this.level() };
  }

  /** One catalogue query, or one per owned equipment (the catalogue takes one equipment at a time), merged. */
  private run(page: number) {
    const filters = this.filters();
    const codes = this.owned() && !filters.equipment ? this.ownedCodes() : null;
    const queries = codes?.length ? codes : [null];
    const size = Math.max(1, Math.ceil(PICKER_PAGE_SIZE / queries.length));
    return forkJoin(
      queries.map((code) => this.data.searchExercisesPage({ ...searchOptionsFor(filters, page, size), ...(code ? { equipment: code } : {}) }))
    ).pipe(
      map((results) => ({
        items: mergeExercises(results.map((result) => result.items)),
        hasMore: results.some((result) => result.page + 1 < result.totalPages)
      }))
    );
  }
}

function mergeUnique(current: readonly Exercise[], more: readonly Exercise[]): Exercise[] {
  const seen = new Set(current.map((exercise) => exercise.exerciseId ?? exercise.code));
  return [...current, ...more.filter((exercise) => !seen.has(exercise.exerciseId ?? exercise.code))];
}
