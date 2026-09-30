import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { SportActivityOption } from '../../core/fitsync.models';
import { createExerciseGroup } from './plan-exercise-form';
import { PlanExerciseRowsComponent } from './plan-exercise-rows.component';
import { PlanDayGlyphComponent } from './plan-day-glyph.component';
import {
  applyDayKind,
  DayGroup,
  findSportLabel,
  formatPlanMinutes,
  hasMoves,
  MAX_DAY_MINUTES,
  MAX_DAY_MOVES,
  MAX_DAY_TITLE_LENGTH,
  PLAN_DAY_CHOICE_LABELS,
  PLAN_DAY_CHOICES,
  PlanDayChoice,
  WEEKDAY_NAMES
} from './plan-week-form';

type DaySnapshot = ReturnType<DayGroup['getRawValue']>;

/** What one button of the strip shows. */
export interface PlanDayView {
  abbr: string;
  kind: PlanDayChoice;
  title: string;
  meta: string;
  label: string;
}

function countedMoves(day: DaySnapshot): number {
  return day.exercises.filter((exercise) => Boolean(exercise.exerciseId)).length;
}

function dayView(day: DaySnapshot, index: number, sports: readonly SportActivityOption[]): PlanDayView {
  const weekday = WEEKDAY_NAMES[index];
  const kind = day.kind;
  let title = 'Rest';
  let meta = 'Nothing planned';
  if (kind !== 'REST') {
    const fallback =
      kind === 'SPORT'
        ? findSportLabel(sports, day.sportActivity) || PLAN_DAY_CHOICE_LABELS.SPORT
        : PLAN_DAY_CHOICE_LABELS[kind];
    title = day.title.trim() || fallback;
    const moves = hasMoves(kind) ? countedMoves(day) : 0;
    const minutes = day.minutes !== null && day.minutes > 0 ? `${day.minutes} min` : '';
    const parts = [moves > 0 ? `${moves} ${moves === 1 ? 'move' : 'moves'}` : '', minutes].filter(Boolean);
    meta = parts.length ? parts.join(' · ') : hasMoves(kind) ? 'No moves yet' : 'No time set';
  }
  return { abbr: weekday.slice(0, 3), kind, title, meta, label: `${weekday}, ${title}, ${meta}` };
}

/**
 * The week of a plan: a strip of seven days and the editor of the one that is selected. The week
 * itself is a form array owned by the plan form, so saving, merging back into a list and loading a
 * saved plan all work on the same controls that this component edits.
 */
@Component({
  selector: 'app-plan-week-editor',
  imports: [ReactiveFormsModule, PlanExerciseRowsComponent, PlanDayGlyphComponent],
  templateUrl: './plan-week-editor.component.html',
  styleUrl: './plan-week-editor.component.scss'
})
export class PlanWeekEditorComponent {
  private readonly fb = inject(FormBuilder);

  readonly week = input.required<FormArray<DayGroup>>();
  readonly planName = input('');
  readonly sportActivities = input<readonly SportActivityOption[]>([]);
  /** Index of the selected day, 0 for Monday. The plan form sets it to show the first day to fix. */
  readonly selectedDay = model(0);

  protected readonly choices = PLAN_DAY_CHOICES;
  protected readonly choiceLabels = PLAN_DAY_CHOICE_LABELS;
  protected readonly weekdayNames = WEEKDAY_NAMES;
  protected readonly maxTitleLength = MAX_DAY_TITLE_LENGTH;
  protected readonly maxMoves = MAX_DAY_MOVES;
  protected readonly maxMinutes = MAX_DAY_MINUTES;

  // The form is not a signal, so the strip reads a copy of its value that is refreshed on every
  // change, and everything derived below reads signals only.
  private readonly snapshot = signal<DaySnapshot[]>([]);

  protected readonly views = computed(() =>
    this.snapshot().map((day, index) => dayView(day, index, this.sportActivities()))
  );

  protected readonly sessionCount = computed(() => this.snapshot().filter((day) => day.kind !== 'REST').length);

  protected readonly restCount = computed(() => this.snapshot().length - this.sessionCount());

  protected readonly totalTime = computed(() =>
    formatPlanMinutes(
      this.snapshot()
        .filter((day) => day.kind !== 'REST')
        .reduce((sum, day) => sum + (day.minutes !== null && day.minutes > 0 ? day.minutes : 0), 0)
    )
  );

  protected readonly selectedGroup = computed<DayGroup | undefined>(() => this.week().at(this.selectedDay()));

  protected readonly selectedKind = computed<PlanDayChoice>(() => this.snapshot()[this.selectedDay()]?.kind ?? 'REST');

  constructor() {
    effect((onCleanup) => {
      const week = this.week();
      const refresh = () => this.snapshot.set(week.getRawValue());
      refresh();
      const subscription = week.valueChanges.subscribe(refresh);
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected selectDay(index: number): void {
    this.selectedDay.set(index);
  }

  protected chooseKind(choice: PlanDayChoice): void {
    const day = this.selectedGroup();
    if (!day) {
      return;
    }
    const current = day.controls.kind.value;
    if (choice === current) {
      return;
    }
    if (choice === 'REST') {
      const moves = hasMoves(current) ? day.controls.exercises.length : 0;
      if (moves > 0 && !window.confirm('Clear the moves of this day and make it a rest day?')) {
        return;
      }
      day.controls.exercises.clear();
    }
    applyDayKind(day, choice);
    if (choice === 'SPORT') {
      this.adoptSportLabel(day, day.controls.sportActivity.value);
    }
  }

  protected chooseSport(code: string): void {
    const day = this.selectedGroup();
    if (!day) {
      return;
    }
    day.controls.sportActivity.setValue(code);
    day.controls.sportActivity.markAsDirty();
    this.adoptSportLabel(day, code);
  }

  protected addMove(): void {
    const day = this.selectedGroup();
    if (day && day.controls.exercises.length < MAX_DAY_MOVES) {
      day.controls.exercises.push(createExerciseGroup(this.fb));
    }
  }

  protected removeMove(index: number): void {
    this.selectedGroup()?.controls.exercises.removeAt(index);
  }

  protected isSelectedSport(code: string): boolean {
    return this.selectedGroup()?.controls.sportActivity.value === code;
  }

  // A sport day is named after its activity until the user names it themselves: an empty title, or
  // one that is the label of some activity, follows the choice.
  private adoptSportLabel(day: DayGroup, code: string): void {
    const label = findSportLabel(this.sportActivities(), code);
    const title = day.controls.title.value.trim();
    if (label && (!title || this.sportActivities().some((activity) => activity.label === title))) {
      day.controls.title.setValue(label);
    }
  }
}
