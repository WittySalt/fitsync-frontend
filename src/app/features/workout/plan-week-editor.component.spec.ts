import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { SportActivityOption, WorkoutPlanDay, WorkoutPlanExercise } from '../../core/fitsync.models';
import { createExerciseGroup } from './plan-exercise-form';
import { PlanWeekEditorComponent } from './plan-week-editor.component';
import {
  buildWeekRequest,
  applyDayKind,
  createWeek,
  DayGroup,
  fillWeek,
  firstInvalidDay,
  formatPlanMinutes,
  weekMoves
} from './plan-week-form';

const SPORTS: SportActivityOption[] = [
  { code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' },
  { code: 'TENNIS', label: 'Tennis', effort: 'MODERATE', measure: 'TIME' }
];

function move(overrides: Partial<WorkoutPlanExercise> = {}): WorkoutPlanExercise {
  return {
    exerciseId: 'exercise-1',
    exerciseNameSnapshot: 'Back squat',
    sequence: 1,
    targetSets: 3,
    targetReps: 8,
    targetWeightKg: 60,
    targetDurationSeconds: null,
    targetDistanceKm: null,
    restSeconds: 90,
    notes: '',
    setTargets: [],
    ...overrides
  };
}

function savedDay(overrides: Partial<WorkoutPlanDay> = {}): WorkoutPlanDay {
  return {
    planDayId: 'day-1',
    dayOfWeek: 1,
    kind: 'STRENGTH',
    title: 'Full body',
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: 50,
    exercises: [move(), move({ exerciseId: 'exercise-2', sequence: 2 }), move({ exerciseId: 'exercise-3', sequence: 3 }), move({ exerciseId: 'exercise-4', sequence: 4 })],
    ...overrides
  };
}

// The week of the approved design: full body on Monday, a run on Thursday, full body on Friday,
// badminton on Saturday, and the other three days resting.
function designWeek(): WorkoutPlanDay[] {
  return [
    savedDay({ planDayId: 'mon', dayOfWeek: 1 }),
    savedDay({
      planDayId: 'thu',
      dayOfWeek: 4,
      kind: 'CARDIO',
      title: 'Treadmill run',
      estimatedDurationMinutes: 35,
      exercises: [move({ exerciseId: 'run', exerciseNameSnapshot: 'Treadmill Run', targetSets: null, targetDurationSeconds: 2100 }), move({ exerciseId: 'plank', targetSets: 3 })]
    }),
    savedDay({ planDayId: 'fri', dayOfWeek: 5 }),
    savedDay({
      planDayId: 'sat',
      dayOfWeek: 6,
      kind: 'SPORT',
      title: 'Badminton',
      sportActivity: 'BADMINTON',
      sportLabel: 'Badminton',
      estimatedDurationMinutes: 60,
      exercises: []
    })
  ];
}

describe('PlanWeekEditorComponent', () => {
  let fixture: ComponentFixture<PlanWeekEditorComponent>;
  let fb: FormBuilder;
  let week: FormArray<DayGroup>;

  function render(days: WorkoutPlanDay[] = designWeek(), planName = 'Recomp Strength + Cardio'): void {
    week = createWeek(fb);
    fillWeek(fb, week, days);
    fixture = TestBed.createComponent(PlanWeekEditorComponent);
    fixture.componentRef.setInput('week', week);
    fixture.componentRef.setInput('planName', planName);
    fixture.componentRef.setInput('sportActivities', SPORTS);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dayButtons(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('.strip .day'));
  }

  function kindButton(label: string): HTMLButtonElement {
    const button = Array.from(root().querySelectorAll<HTMLButtonElement>('.kinds .kind')).find(
      (candidate) => candidate.textContent?.trim() === label
    );
    if (!button) {
      throw new Error(`No kind button named ${label}`);
    }
    return button;
  }

  function select(index: number): void {
    dayButtons()[index].click();
    fixture.detectChanges();
  }

  function choose(label: string): void {
    kindButton(label).click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlanWeekEditorComponent],
      providers: [
        {
          provide: FitSyncDataService,
          useValue: { searchExercisesPage: () => of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }) }
        }
      ]
    });
    fb = TestBed.inject(FormBuilder);
  });

  describe('the strip', () => {
    it('shows seven buttons, Monday first, with the title and meta of each day', () => {
      render();

      const buttons = dayButtons();
      expect(buttons.length).toBe(7);
      expect(buttons.map((button) => button.querySelector('.day-eyebrow')?.textContent?.trim())).toEqual([
        'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
      ]);
      expect(buttons.map((button) => button.querySelector('.day-title')?.textContent?.trim())).toEqual([
        'Full body', 'Rest', 'Rest', 'Treadmill run', 'Full body', 'Badminton', 'Rest'
      ]);
      expect(buttons.map((button) => button.querySelector('.day-meta')?.textContent?.trim())).toEqual([
        '4 moves · 50 min',
        'Nothing planned',
        'Nothing planned',
        '2 moves · 35 min',
        '4 moves · 50 min',
        '60 min',
        'Nothing planned'
      ]);
    });

    it('draws a green tile for a training day and a grey one for rest', () => {
      render();

      const tiles = dayButtons().map((button) => button.querySelector('.day-tile') as HTMLElement);
      expect(tiles.map((tile) => tile.classList.contains('rest'))).toEqual([false, true, true, false, false, false, true]);
      expect(tiles.every((tile) => tile.querySelector('svg') !== null)).toBeTrue();
    });

    it('says what a day without moves or minutes still lacks', () => {
      render([savedDay({ exercises: [], estimatedDurationMinutes: null }), savedDay({ dayOfWeek: 2, kind: 'SPORT', title: '', sportActivity: null, estimatedDurationMinutes: null, exercises: [] })]);

      const buttons = dayButtons();
      expect(buttons[0].querySelector('.day-meta')?.textContent?.trim()).toBe('No moves yet');
      expect(buttons[1].querySelector('.day-title')?.textContent?.trim()).toBe('Sport');
      expect(buttons[1].querySelector('.day-meta')?.textContent?.trim()).toBe('No time set');
    });

    it('marks the selected day with aria-pressed and shows its editor', () => {
      render();
      expect(dayButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false']);

      select(3);

      expect(fixture.componentInstance.selectedDay()).toBe(3);
      expect(dayButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'false', 'false', 'false']);
      expect(root().querySelector('.day-heading')?.textContent?.trim()).toBe('Thursday');
      expect((root().querySelector('#plan-day-title') as HTMLInputElement).value).toBe('Treadmill run');
      expect((root().querySelector('#plan-day-minutes') as HTMLInputElement).value).toBe('35');
    });

    it('gives every day a full name to assistive technology', () => {
      render();

      expect(dayButtons()[0].getAttribute('aria-label')).toBe('Monday, Full body, 4 moves · 50 min');
      expect(dayButtons()[1].getAttribute('aria-label')).toBe('Tuesday, Rest, Nothing planned');
    });
  });

  describe('the header', () => {
    it('shows the plan name, the heading and the three chips', () => {
      render();

      expect(root().querySelector('.week-eyebrow')?.textContent?.trim()).toBe('Recomp Strength + Cardio');
      expect(root().querySelector('#plan-week-heading')?.textContent?.trim()).toBe('Your week');
      expect(Array.from(root().querySelectorAll('.chip')).map((chip) => chip.textContent?.trim())).toEqual([
        '4 sessions',
        '3 rest days',
        '3 h 15 min'
      ]);
    });

    it('leaves the total time out when no day has minutes, and keeps singular wording', () => {
      render([savedDay({ estimatedDurationMinutes: null })], '');

      expect(root().querySelector('.week-eyebrow')?.textContent?.trim()).toBe('New plan');
      expect(Array.from(root().querySelectorAll('.chip')).map((chip) => chip.textContent?.trim())).toEqual(['1 session', '6 rest days']);
    });

    it('follows edits made to the week', () => {
      render();

      select(1);
      week.at(1).controls.minutes.setValue(20);
      choose('Mobility');

      expect(Array.from(root().querySelectorAll('.chip')).map((chip) => chip.textContent?.trim())).toEqual([
        '5 sessions',
        '2 rest days',
        '3 h 35 min'
      ]);
    });

    it('formats totals in hours and minutes', () => {
      expect(formatPlanMinutes(0)).toBe('');
      expect(formatPlanMinutes(45)).toBe('45 min');
      expect(formatPlanMinutes(120)).toBe('2 h');
      expect(formatPlanMinutes(195)).toBe('3 h 15 min');
    });
  });

  describe('the kind of a day', () => {
    it('offers the five kinds and presses the current one', () => {
      render();
      select(3);

      const buttons = Array.from(root().querySelectorAll<HTMLButtonElement>('.kinds .kind'));
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Strength', 'Cardio', 'Mobility', 'Sport', 'Rest']);
      expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false']);
      expect(buttons.every((button) => button.querySelector('svg') !== null)).toBeTrue();
    });

    it('keeps the title and the minutes when the kind changes', () => {
      render();
      select(3);

      choose('Mobility');

      const thursday = week.at(3);
      expect(thursday.controls.kind.value).toBe('MOBILITY');
      expect(thursday.controls.title.value).toBe('Treadmill run');
      expect(thursday.controls.minutes.value).toBe(35);
      expect(thursday.controls.exercises.length).toBe(2);
    });

    it('names a sport day after its activity when the title is empty', () => {
      render([savedDay({ title: '', exercises: [] })]);

      choose('Sport');
      const sport = root().querySelector('#plan-day-sport') as HTMLSelectElement;
      sport.value = 'TENNIS';
      sport.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(week.at(0).controls.sportActivity.value).toBe('TENNIS');
      expect(week.at(0).controls.title.value).toBe('Tennis');
    });

    it('follows the activity while the title is still a previous activity label, and stops once it is the user\'s own', () => {
      render([savedDay({ kind: 'SPORT', title: 'Badminton', sportActivity: 'BADMINTON', exercises: [] })]);
      const sport = root().querySelector('#plan-day-sport') as HTMLSelectElement;

      sport.value = 'TENNIS';
      sport.dispatchEvent(new Event('change'));
      expect(week.at(0).controls.title.value).toBe('Tennis');

      week.at(0).controls.title.setValue('Club night');
      sport.value = 'BADMINTON';
      sport.dispatchEvent(new Event('change'));
      expect(week.at(0).controls.title.value).toBe('Club night');
    });

    it('keeps the title of a day that becomes a sport day before an activity is chosen', () => {
      render([savedDay({ title: 'Leg day', exercises: [] })]);

      choose('Sport');

      expect(week.at(0).controls.title.value).toBe('Leg day');
    });

    it('asks before a day with moves becomes a rest day and clears it when confirmed', () => {
      render();
      const confirm = spyOn(window, 'confirm').and.returnValue(false);

      choose('Rest');
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(week.at(0).controls.kind.value).toBe('STRENGTH');
      expect(week.at(0).controls.exercises.length).toBe(4);

      confirm.and.returnValue(true);
      choose('Rest');

      expect(week.at(0).controls.kind.value).toBe('REST');
      expect(week.at(0).controls.exercises.length).toBe(0);
      expect(dayButtons()[0].querySelector('.day-title')?.textContent?.trim()).toBe('Rest');
      expect(root().querySelector('#plan-day-title')).toBeNull();
    });

    it('does not ask when a day without moves becomes a rest day', () => {
      render([savedDay({ exercises: [] })]);
      const confirm = spyOn(window, 'confirm');

      choose('Rest');

      expect(confirm).not.toHaveBeenCalled();
      expect(week.at(0).controls.kind.value).toBe('REST');
    });

    it('does not ask about the hidden moves of a sport day', () => {
      render([savedDay({ kind: 'SPORT', sportActivity: 'BADMINTON', exercises: [] })]);
      week.at(0).controls.exercises.push(createExerciseGroup(fb));
      const confirm = spyOn(window, 'confirm');

      choose('Rest');

      expect(confirm).not.toHaveBeenCalled();
      expect(week.at(0).controls.exercises.length).toBe(0);
    });

    it('brings a rest day back as a training day with the title and minutes it had', () => {
      render([savedDay({ exercises: [] })]);
      choose('Rest');

      choose('Cardio');

      expect(week.at(0).controls.kind.value).toBe('CARDIO');
      expect(week.at(0).controls.title.value).toBe('Full body');
      expect(week.at(0).controls.minutes.value).toBe(50);
    });

    it('shows a sport select in place of the moves for Sport, and moves for the others', () => {
      render();
      expect(root().querySelector('#plan-day-sport')).toBeNull();
      expect(root().querySelector('app-plan-exercise-rows')).not.toBeNull();

      choose('Sport');

      const options = Array.from(root().querySelectorAll<HTMLOptionElement>('#plan-day-sport option')).map((option) => option.textContent?.trim());
      expect(options).toEqual(['Choose a sport', 'Badminton', 'Tennis']);
      expect(root().querySelector('app-plan-exercise-rows')).toBeNull();
      expect(root().querySelector('.add-move')).toBeNull();
    });
  });

  describe('the moves', () => {
    it('adds and removes a move with the shared rows', () => {
      render([savedDay({ exercises: [] })]);
      expect(root().querySelectorAll('.exercise-row').length).toBe(0);

      (root().querySelector('.add-move') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root().querySelectorAll('.exercise-row').length).toBe(1);
      expect(root().querySelector('.exercise-typeahead input')).not.toBeNull();

      const remove = Array.from(root().querySelectorAll<HTMLButtonElement>('.exercise-row button')).find((button) => button.textContent?.trim() === 'Remove');
      remove!.click();
      fixture.detectChanges();
      expect(week.at(0).controls.exercises.length).toBe(0);
    });

    it('stops adding at thirty moves', () => {
      render([savedDay({ exercises: [] })]);
      for (let index = 0; index < 30; index++) {
        week.at(0).controls.exercises.push(createExerciseGroup(fb));
      }
      fixture.detectChanges();

      const add = root().querySelector('.add-move') as HTMLButtonElement;
      expect(add.disabled).toBeTrue();
      add.click();
      expect(week.at(0).controls.exercises.length).toBe(30);
      expect(week.at(0).hasError('tooManyMoves')).toBeFalse();
      week.at(0).controls.exercises.push(createExerciseGroup(fb));
      expect(week.at(0).hasError('tooManyMoves')).toBeTrue();
    });
  });

  describe('validation', () => {
    it('accepts the design week', () => {
      render();

      expect(week.valid).toBeTrue();
      expect(firstInvalidDay(week)).toBe(-1);
    });

    it('needs a title on every training day, and shows it inline once the day was touched', () => {
      render();
      week.at(0).controls.title.setValue('   ');

      expect(week.at(0).hasError('titleRequired')).toBeTrue();
      expect(firstInvalidDay(week)).toBe(0);
      expect(root().querySelector('.field-error')).toBeNull();

      week.at(0).markAllAsTouched();
      fixture.detectChanges();
      expect(root().querySelector('.title-field .field-error')?.textContent?.trim()).toBe('Add a title.');
    });

    it('limits the title to 120 characters', () => {
      render();

      week.at(0).controls.title.setValue('x'.repeat(120));
      expect(week.at(0).valid).toBeTrue();
      week.at(0).controls.title.setValue('x'.repeat(121));
      expect(week.at(0).hasError('titleLength')).toBeTrue();
      expect((root().querySelector('#plan-day-title') as HTMLInputElement).getAttribute('maxlength')).toBe('120');
    });

    it('accepts minutes from 1 to 600, or none', () => {
      render();
      const monday = week.at(0);

      [1, 600, null].forEach((minutes) => {
        monday.controls.minutes.setValue(minutes);
        expect(monday.hasError('minutesRange')).toBeFalse();
      });
      [0, 601, 2.5, -5].forEach((minutes) => {
        monday.controls.minutes.setValue(minutes);
        expect(monday.hasError('minutesRange')).toBeTrue();
      });

      monday.markAllAsTouched();
      fixture.detectChanges();
      expect(root().querySelector('.minutes-field .field-error')?.textContent?.trim()).toBe('Use 1 to 600.');
    });

    it('needs an activity on a sport day', () => {
      render();
      select(5);
      week.at(5).controls.sportActivity.setValue('');

      expect(week.at(5).hasError('sportRequired')).toBeTrue();
      week.at(5).markAllAsTouched();
      fixture.detectChanges();
      expect(root().querySelector('.sport-field .field-error')?.textContent?.trim()).toBe('Choose a sport.');

      week.at(5).controls.sportActivity.setValue('TENNIS');
      expect(week.at(5).valid).toBeTrue();
    });

    it('needs a move on a day that is not a sport day, and a chosen exercise in every move', () => {
      render();
      week.at(0).controls.exercises.clear();

      expect(week.at(0).hasError('noMoves')).toBeTrue();
      week.at(0).markAllAsTouched();
      fixture.detectChanges();
      expect(root().querySelector('.moves .field-error')?.textContent?.trim()).toBe('Add at least one move.');

      week.at(0).controls.exercises.push(createExerciseGroup(fb));
      expect(week.at(0).invalid).toBeTrue();
      week.at(0).controls.exercises.at(0).controls.exerciseId.setValue('exercise-1');
      expect(week.at(0).valid).toBeTrue();
    });

    it('asks nothing of a rest day, and nothing of the hidden moves of a sport day', () => {
      render();
      week.at(1).controls.title.setValue('');
      week.at(5).controls.exercises.push(createExerciseGroup(fb));
      applyDayKind(week.at(5), 'SPORT');

      expect(week.at(1).valid).toBeTrue();
      expect(week.at(5).valid).toBeTrue();
      expect(week.valid).toBeTrue();
    });

    it('reports the first day that has to be fixed', () => {
      render();
      week.at(4).controls.title.setValue('');
      week.at(3).controls.exercises.clear();

      expect(firstInvalidDay(week)).toBe(3);
    });
  });

  describe('the value', () => {
    it('builds the days of the request', () => {
      render();

      const days = buildWeekRequest(week);

      expect(days.map((day) => [day.dayOfWeek, day.kind, day.title, day.estimatedDurationMinutes])).toEqual([
        [1, 'STRENGTH', 'Full body', 50],
        [4, 'CARDIO', 'Treadmill run', 35],
        [5, 'STRENGTH', 'Full body', 50],
        [6, 'SPORT', 'Badminton', 60]
      ]);
      expect(days.map((day) => day.planDayId)).toEqual(['mon', 'thu', 'fri', 'sat']);
      expect(days[0].exercises.map((row) => [row.exerciseId, row.sequence])).toEqual([
        ['exercise-1', 1],
        ['exercise-2', 2],
        ['exercise-3', 3],
        ['exercise-4', 4]
      ]);
      expect(days[1].exercises[0]).toEqual(jasmine.objectContaining({ exerciseId: 'run', sequence: 1, targetSets: null, targetDurationSeconds: 2100 }));
      expect(days[3]).toEqual(jasmine.objectContaining({ sportActivity: 'BADMINTON', exercises: [] }));
      expect(days[0].sportActivity).toBeNull();
    });

    it('trims the title and leaves out the id of a day that is new', () => {
      render([savedDay({ dayOfWeek: 2, planDayId: '', title: '  Push  ' })]);

      const days = buildWeekRequest(week);

      expect(days.length).toBe(1);
      expect(days[0].dayOfWeek).toBe(2);
      expect(days[0].title).toBe('Push');
      expect('planDayId' in days[0]).toBeFalse();
    });

    it('collects the moves of the days that have them, in day order, for a plain list', () => {
      render();

      expect(weekMoves(week).map((group) => group.controls.exerciseId.value)).toEqual([
        'exercise-1', 'exercise-2', 'exercise-3', 'exercise-4',
        'run', 'plank',
        'exercise-1', 'exercise-2', 'exercise-3', 'exercise-4'
      ]);
    });
  });
});
