import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise } from '../../core/fitsync.models';
import { ExerciseGroup, isTimedExerciseGroup, TIMED_EXERCISE_TYPES } from './plan-exercise-form';

/** What the picker of one row shows while it is being used. The text in the box and the type of
 *  the chosen exercise live in the row's own form group, so they are saved and moved with it. */
interface PickerUiState {
  query: string;
  results: Exercise[];
  loading: boolean;
  error: string | null;
  open: boolean;
  activeIndex: number;
}

export interface ExercisePickerView extends PickerUiState {
  inputValue: string;
  exerciseType: string | null;
}

interface ExerciseSearchRequest {
  group: ExerciseGroup;
  query: string;
}

const EMPTY_PICKER: PickerUiState = {
  query: '',
  results: [],
  loading: false,
  error: null,
  open: false,
  activeIndex: -1
};

/**
 * The exercise rows of a plan with the exercise picker in each. The plain list of the plan form and
 * every day of a week use this one component, so searching, the keyboard handling and the sets or
 * duration inputs are the same in both. Adding and removing rows is left to the host, which knows
 * whether the last row may go.
 */
@Component({
  selector: 'app-plan-exercise-rows',
  imports: [ReactiveFormsModule],
  templateUrl: './plan-exercise-rows.component.html',
  styleUrl: './plan-exercise-rows.component.scss'
})
export class PlanExerciseRowsComponent {
  private readonly dataService = inject(FitSyncDataService);
  private readonly searchTerms = new Subject<ExerciseSearchRequest>();

  readonly rows = input.required<FormArray<ExerciseGroup>>();
  readonly removeRow = output<number>();

  // Keyed by the row's group, so a row keeps its own picker state when the rows before it go.
  private readonly uiStates = signal<ReadonlyMap<ExerciseGroup, PickerUiState>>(new Map());

  constructor() {
    this.searchTerms
      .pipe(
        debounceTime(275),
        distinctUntilChanged((previous, current) => previous.group === current.group && previous.query === current.query),
        switchMap(({ group, query }) =>
          this.dataService.searchExercisesPage({ q: query, page: 0, size: 20 }).pipe(
            map((page) => ({ group, query, results: page.items, error: null as string | null })),
            catchError(() =>
              of({
                group,
                query,
                results: [] as Exercise[],
                error: 'Unable to search exercises. Please retry.'
              })
            )
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ group, query, results, error }) => {
        const current = this.uiStates().get(group);
        if (!current || current.query !== query) {
          return;
        }
        this.patchState(group, { results, error, loading: false, open: true, activeIndex: results.length ? 0 : -1 });
      });
  }

  pickerState(index: number): ExercisePickerView {
    const group = this.rows().at(index);
    if (!group) {
      return { ...EMPTY_PICKER, inputValue: '', exerciseType: null };
    }
    return {
      ...EMPTY_PICKER,
      ...this.uiStates().get(group),
      inputValue: group.controls.exerciseName.value ?? '',
      exerciseType: group.controls.exerciseType.value
    };
  }

  // A row is "timed" once a CARDIO or MOBILITY exercise is chosen: then the row shows a single
  // Duration target instead of sets, reps and weight.
  isTimedRow(index: number): boolean {
    const group = this.rows().at(index);
    return !!group && isTimedExerciseGroup(group);
  }

  setSearchQuery(index: number, value: string): void {
    const group = this.rows().at(index);
    if (!group) {
      return;
    }
    const query = value.trim();
    group.controls.exerciseId.setValue('');
    group.controls.exerciseName.setValue(value);
    this.patchState(group, { query, results: [], error: null, loading: Boolean(query), open: true, activeIndex: -1 });
    if (query) {
      this.searchTerms.next({ group, query });
    }
  }

  openPicker(index: number): void {
    this.patchAt(index, { open: true });
  }

  closePicker(index: number): void {
    this.patchAt(index, { open: false, activeIndex: -1 });
  }

  markTouched(index: number): void {
    this.rows().at(index)?.controls.exerciseId.markAsTouched();
  }

  handleKeydown(event: KeyboardEvent, index: number): void {
    const state = this.pickerState(index);
    if (event.key === 'Escape') {
      this.closePicker(index);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActive(index, 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(index, -1);
      return;
    }
    if (event.key === 'Enter' && state.open && state.activeIndex >= 0) {
      event.preventDefault();
      const exercise = state.results[state.activeIndex];
      if (exercise) {
        this.selectResult(index, exercise);
      }
    }
  }

  selectResult(index: number, exercise: Exercise): void {
    const group = this.rows().at(index);
    if (!exercise.exerciseId || !group) {
      return;
    }
    group.controls.exerciseId.setValue(exercise.exerciseId);
    group.controls.exerciseId.markAsDirty();
    group.controls.exerciseId.markAsTouched();
    group.controls.exerciseName.setValue(exercise.name);
    group.controls.exerciseType.setValue(exercise.exerciseType);
    // Give a timed exercise a sensible default duration so the field isn't blank.
    if (TIMED_EXERCISE_TYPES.has(exercise.exerciseType) && !group.controls.targetDurationSeconds.value) {
      group.controls.targetDurationSeconds.setValue(60);
    }
    this.patchState(group, {
      query: '',
      results: [exercise],
      error: null,
      loading: false,
      open: false,
      activeIndex: -1
    });
  }

  exerciseHint(exercise: Exercise): string {
    return [exercise.primaryMuscleGroup, exercise.equipment]
      .filter(Boolean)
      .map((value) => this.formatLabel(value))
      .join(' / ');
  }

  listboxId(index: number): string {
    return `plan-exercise-results-${index}`;
  }

  optionId(rowIndex: number, optionIndex: number): string {
    return `plan-exercise-option-${rowIndex}-${optionIndex}`;
  }

  activeOptionId(index: number): string | null {
    const state = this.pickerState(index);
    return state.open && state.activeIndex >= 0 ? this.optionId(index, state.activeIndex) : null;
  }

  private formatLabel(value: string): string {
    return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private moveActive(index: number, delta: number): void {
    const state = this.pickerState(index);
    if (!state.open) {
      this.openPicker(index);
      return;
    }
    if (!state.results.length) {
      return;
    }
    const next = (state.activeIndex + delta + state.results.length) % state.results.length;
    this.patchAt(index, { activeIndex: next });
  }

  private patchAt(index: number, patch: Partial<PickerUiState>): void {
    const group = this.rows().at(index);
    if (group) {
      this.patchState(group, patch);
    }
  }

  private patchState(group: ExerciseGroup, patch: Partial<PickerUiState>): void {
    this.uiStates.update((states) => new Map(states).set(group, { ...EMPTY_PICKER, ...states.get(group), ...patch }));
  }
}
