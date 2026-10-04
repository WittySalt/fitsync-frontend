import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayEditorComponent } from './day-editor.component';
import { DraftDay, DraftMove, emptyDay } from './plan-draft';

const bench: DraftMove = {
  exerciseId: 'bench',
  name: 'Dumbbell Bench Press',
  meta: 'chest · arms · dumbbell',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: null,
  restSeconds: 75,
  tempoSeconds: null,
  notes: '',
  primaryGroups: ['CHEST']
};

describe('DayEditorComponent moves table', () => {
  let fixture: ComponentFixture<DayEditorComponent>;
  let emitted: DraftMove[][];

  function render(day: DraftDay): void {
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['searchExercisesPage', 'getExerciseMetadata', 'getOnboardingSeed', 'getExercise']);
    data.searchExercisesPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 1, totalElements: 0 }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }] });
    fixture = TestBed.createComponent(DayEditorComponent);
    fixture.componentRef.setInput('day', day);
    emitted = [];
    fixture.componentInstance.movesChange.subscribe((moves) => emitted.push(moves));
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement;

  it('lists the draft moves in the real table, not a stub', () => {
    render({ ...emptyDay(1), kind: 'STRENGTH', title: 'Full body A', moves: [bench] });
    expect(root().querySelectorAll('app-plan-moves-table .row').length).toBe(1);
    expect(root().querySelector('app-plan-moves-table .name strong')?.textContent).toBe('Dumbbell Bench Press');
  });

  it('hands an edited row back as a draft move and keeps its muscle groups', () => {
    render({ ...emptyDay(1), kind: 'STRENGTH', title: 'Full body A', moves: [bench] });
    const sets = root().querySelector<HTMLInputElement>('input[aria-label^="Sets for"]')!;
    sets.value = '5';
    sets.dispatchEvent(new Event('change'));
    expect(emitted.length).toBe(1);
    expect(emitted[0][0].sets).toBe(5);
    expect(emitted[0][0].name).toBe('Dumbbell Bench Press');
    expect(emitted[0][0].primaryGroups).toEqual(['CHEST']);
  });

  it('removes a move through the table', () => {
    render({ ...emptyDay(1), kind: 'STRENGTH', title: 'A', moves: [bench] });
    root().querySelector<HTMLButtonElement>('button[aria-label="Remove Dumbbell Bench Press"]')!.click();
    expect(emitted[0]).toEqual([]);
  });
});
