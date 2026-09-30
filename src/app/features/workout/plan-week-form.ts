import { AbstractControl, FormArray, FormBuilder, ValidationErrors } from '@angular/forms';

import {
  PlanDayKind,
  SportActivityOption,
  WorkoutPlanDay,
  WorkoutPlanDayRequest
} from '../../core/fitsync.models';
import {
  createExerciseArray,
  createExerciseGroup,
  ExerciseGroup,
  exerciseGroupsToInputs,
  fillExerciseGroup,
  isBlankExerciseGroup
} from './plan-exercise-form';

/** What a day of the week can be set to. A rest day is not a kind on the server, it is a day that
 *  is left out of the request. */
export type PlanDayChoice = PlanDayKind | 'REST';

export const PLAN_DAY_CHOICES: readonly PlanDayChoice[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT', 'REST'];

export const PLAN_DAY_CHOICE_LABELS: Record<PlanDayChoice, string> = {
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  MOBILITY: 'Mobility',
  SPORT: 'Sport',
  REST: 'Rest'
};

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const MAX_DAY_TITLE_LENGTH = 120;
export const MAX_DAY_MINUTES = 600;
export const MAX_DAY_MOVES = 30;

/** Kinds whose day is a list of moves. A sport day names the activity instead. */
export function hasMoves(choice: PlanDayChoice): boolean {
  return choice === 'STRENGTH' || choice === 'CARDIO' || choice === 'MOBILITY';
}

/** The rules the server enforces on a day, reported as error keys for the editor to word. A rest
 *  day has none, and neither does a day whose fields are hidden by its kind. */
function dayRules(control: AbstractControl): ValidationErrors | null {
  const day = control as DayGroup;
  const kind = day.controls.kind.value;
  if (kind === 'REST') {
    return null;
  }
  const errors: ValidationErrors = {};
  const title = (day.controls.title.value ?? '').trim();
  if (!title) {
    errors['titleRequired'] = true;
  } else if (title.length > MAX_DAY_TITLE_LENGTH) {
    errors['titleLength'] = true;
  }
  const minutes = day.controls.minutes.value;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_DAY_MINUTES)) {
    errors['minutesRange'] = true;
  }
  if (kind === 'SPORT') {
    if (!day.controls.sportActivity.value) {
      errors['sportRequired'] = true;
    }
  } else if (day.controls.exercises.length === 0) {
    errors['noMoves'] = true;
  } else if (day.controls.exercises.length > MAX_DAY_MOVES) {
    errors['tooManyMoves'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

export function createDayGroup(fb: FormBuilder) {
  const day = fb.nonNullable.group(
    {
      planDayId: [null as string | null],
      kind: ['REST' as PlanDayChoice],
      title: [''],
      minutes: [null as number | null],
      sportActivity: [''],
      exercises: createExerciseArray(fb, 0)
    },
    { validators: dayRules }
  );
  day.controls.exercises.disable({ emitEvent: false });
  return day;
}

export type DayGroup = ReturnType<typeof createDayGroup>;

/** Seven days, Monday first, all resting. */
export function createWeek(fb: FormBuilder): FormArray<DayGroup> {
  return fb.array(Array.from({ length: WEEKDAY_NAMES.length }, () => createDayGroup(fb)));
}

/** Sets a day's kind and turns its moves on or off with it: the moves of a rest or sport day take
 *  no part in the day's validity or its value, while they stay in the form in case the user
 *  switches back. */
export function applyDayKind(day: DayGroup, kind: PlanDayChoice): void {
  day.controls.kind.setValue(kind);
  if (hasMoves(kind)) {
    day.controls.exercises.enable();
  } else {
    day.controls.exercises.disable();
  }
}

export function resetWeek(week: FormArray<DayGroup>): void {
  week.controls.forEach((day) => {
    day.controls.exercises.clear();
    day.patchValue({ planDayId: null, title: '', minutes: null, sportActivity: '' });
    applyDayKind(day, 'REST');
  });
}

/** Loads a saved week into the form, replacing whatever it held. */
export function fillWeek(fb: FormBuilder, week: FormArray<DayGroup>, days: readonly WorkoutPlanDay[]): void {
  resetWeek(week);
  days.forEach((saved) => {
    const day = week.at(saved.dayOfWeek - 1);
    if (!day) {
      return;
    }
    day.patchValue({
      planDayId: saved.planDayId,
      title: saved.title,
      minutes: saved.estimatedDurationMinutes,
      sportActivity: saved.sportActivity ?? ''
    });
    saved.exercises.forEach((exercise) => {
      const group = createExerciseGroup(fb);
      fillExerciseGroup(group, exercise);
      day.controls.exercises.push(group);
    });
    applyDayKind(day, saved.kind);
  });
}

/** Index of the first day that has to be fixed before the week can be saved, or -1. */
export function firstInvalidDay(week: FormArray<DayGroup>): number {
  return week.controls.findIndex((day) => day.invalid);
}

export function trainingDayCount(week: FormArray<DayGroup>): number {
  return week.controls.filter((day) => day.controls.kind.value !== 'REST').length;
}

/** The rows a week holds that would be kept as a plain list: the moves of the days that have any,
 *  Monday first, without the rows nobody filled in. */
export function weekMoves(week: FormArray<DayGroup>): ExerciseGroup[] {
  return week.controls
    .filter((day) => hasMoves(day.controls.kind.value))
    .flatMap((day) => day.controls.exercises.controls)
    .filter((group) => !isBlankExerciseGroup(group));
}

/** The `days` of a plan request. Rest days are left out, a sport day carries no moves, and the
 *  moves of the others are numbered from one within their own day. */
export function buildWeekRequest(week: FormArray<DayGroup>): WorkoutPlanDayRequest[] {
  return week.controls.flatMap((day, index) => {
    const raw = day.getRawValue();
    const kind = raw.kind;
    if (kind === 'REST') {
      return [];
    }
    return [
      {
        ...(raw.planDayId ? { planDayId: raw.planDayId } : {}),
        dayOfWeek: index + 1,
        kind,
        title: (raw.title ?? '').trim(),
        sportActivity: kind === 'SPORT' ? raw.sportActivity : null,
        estimatedDurationMinutes: raw.minutes,
        exercises: kind === 'SPORT' ? [] : exerciseGroupsToInputs(day.controls.exercises.controls)
      }
    ];
  });
}

/** "3 h 15 min", "3 h" or "45 min", and nothing at all for no time. */
export function formatPlanMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) {
    return '';
  }
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function findSportLabel(activities: readonly SportActivityOption[], code: string | null): string {
  return activities.find((activity) => activity.code === code)?.label ?? '';
}
