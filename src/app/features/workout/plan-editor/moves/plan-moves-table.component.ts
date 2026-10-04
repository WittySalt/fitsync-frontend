import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';

import { DragList } from '../../../nutrition/recipes/drag-list';
import { ExercisePickerComponent } from '../picker/exercise-picker.component';
import {
  MoveField,
  PickedExercise,
  PlanSetEntry,
  WidthBand,
  appendEntry,
  fieldBounds,
  moveEntry,
  parseField,
  patchField,
  patchNotes,
  removeEntry,
  swapExercise,
  widthBand
} from './moves-model';

interface Column {
  field: MoveField;
  label: string;
  unit: string;
  placeholder: string;
}

const COLUMNS: Column[] = [
  { field: 'sets', label: 'Sets', unit: '', placeholder: '' },
  { field: 'reps', label: 'Reps', unit: '', placeholder: '' },
  { field: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'Body' },
  { field: 'restSeconds', label: 'Rest', unit: 's', placeholder: '' },
  { field: 'tempoSeconds', label: 'Tempo', unit: 's', placeholder: 'None' }
];

/**
 * The moves of one strength or mobility day as a table (spec section 3). It holds no copy of the
 * rows: every edit builds a new list and hands it up through `entriesChange`.
 */
@Component({
  selector: 'app-plan-moves-table',
  imports: [ExercisePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-moves-table.component.html',
  styleUrl: './plan-moves-table.component.scss',
  host: { '[attr.data-band]': 'band()' }
})
export class PlanMovesTableComponent {
  readonly entries = input<readonly PlanSetEntry[]>([]);
  /** Mobility days make every new move time-based. */
  readonly timeBasedDefault = input(false);
  readonly entriesChange = output<PlanSetEntry[]>();

  readonly band = signal<WidthBand>('wide');
  readonly coarse = signal(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  /** The row whose notes line is open, and the row whose arrows are shown on touch. */
  readonly openRow = signal<number | null>(null);
  readonly arrowsRow = signal<number | null>(null);
  /** Null: the picker is shut. -1: it adds a move. Otherwise it swaps that row's exercise. */
  readonly pickerFor = signal<number | null>(null);
  readonly swapName = computed(() => {
    const index = this.pickerFor();
    return index !== null && index >= 0 ? (this.entries()[index]?.exerciseName ?? null) : null;
  });

  protected readonly columns = COLUMNS;
  protected readonly drag = new DragList();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure(this.host.nativeElement.getBoundingClientRect().width);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver((records) => this.measure(records[0]?.contentRect.width ?? 0));
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  measure(width: number): void {
    if (width > 0) {
      this.band.set(widthBand(width));
    }
  }

  protected columnLabel(column: Column, entry: PlanSetEntry): string {
    return column.field === 'reps' && entry.timeBased ? 'Time' : column.label;
  }

  /** The field a column edits in a row: a timed move edits its seconds where reps would be. */
  protected fieldOf(column: Column, entry: PlanSetEntry): MoveField {
    return column.field === 'reps' && entry.timeBased ? 'plannedSeconds' : column.field;
  }

  protected unitOf(column: Column, entry: PlanSetEntry): string {
    return column.field === 'reps' && entry.timeBased ? 's' : column.unit;
  }

  protected valueOf(entry: PlanSetEntry, field: MoveField): string {
    const value = entry[field];
    return value === null || value === undefined ? '' : String(value);
  }

  protected bounds(field: MoveField): { min: number; max: number } {
    return fieldBounds(field);
  }

  protected edit(index: number, field: MoveField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const entry = this.entries()[index];
    if (parseField(field, input.value) === undefined) {
      input.value = this.valueOf(entry, field);
      return;
    }
    const next = patchField(this.entries(), index, field, input.value);
    input.value = this.valueOf(next[index], field);
    this.entriesChange.emit(next);
  }

  protected editNotes(index: number, event: Event): void {
    this.entriesChange.emit(patchNotes(this.entries(), index, (event.target as HTMLInputElement).value));
  }

  protected toggleNotes(index: number): void {
    this.openRow.update((open) => (open === index ? null : index));
  }

  protected toggleArrows(index: number): void {
    this.arrowsRow.update((open) => (open === index ? null : index));
  }

  move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.entries().length) {
      return;
    }
    this.openRow.set(null);
    this.arrowsRow.set(to);
    this.entriesChange.emit(moveEntry(this.entries(), from, to));
  }

  protected handleKey(index: number, event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
    }
  }

  remove(index: number): void {
    this.openRow.set(null);
    this.arrowsRow.set(null);
    this.entriesChange.emit(removeEntry(this.entries(), index));
  }

  openAdd(): void {
    this.pickerFor.set(-1);
  }

  protected openSwap(index: number): void {
    this.pickerFor.set(index);
  }

  closePicker(): void {
    this.pickerFor.set(null);
  }

  /** An exercise was chosen: it is added at the end, or it replaces the row being swapped. */
  onPicked(picked: PickedExercise): void {
    const index = this.pickerFor();
    if (index === null) {
      return;
    }
    if (index >= 0) {
      this.entriesChange.emit(swapExercise(this.entries(), index, picked));
      this.pickerFor.set(null);
      return;
    }
    this.entriesChange.emit(appendEntry(this.entries(), picked, this.timeBasedDefault()));
  }
}
