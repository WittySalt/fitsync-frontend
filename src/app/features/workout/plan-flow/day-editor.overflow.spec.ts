import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayEditorComponent } from './day-editor.component';
import { DraftDay, DraftMove, emptyDay } from './plan-draft';
import { repeatRow, sportSegments } from './segments/segment-list-math';
import { defaultSegments } from './segments/segment-math';

const move = (name: string): DraftMove => ({
  exerciseId: name,
  name,
  meta: 'chest · shoulders, triceps · dumbbell',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: 20,
  restSeconds: 75,
  tempoSeconds: 3,
  notes: '',
  bodyweight: false
});

const strength: DraftDay = { ...emptyDay(1), kind: 'STRENGTH', title: 'Full body A', minutes: 45, moves: [move('Dumbbell Bench Press'), move('Machine Chest Press')] };
const cardio: DraftDay = {
  ...emptyDay(2),
  kind: 'CARDIO',
  title: 'Easy run',
  minutes: 45,
  targetKind: 'PACE',
  targetValue: 6,
  location: 'TREADMILL',
  effort: 'EASY',
  segments: repeatRow(defaultSegments(45), 1, 4)
};
const sport: DraftDay = { ...emptyDay(6), kind: 'SPORT', title: 'Badminton', minutes: 60, sportActivity: 'BADMINTON', effort: 'MODERATE', segments: sportSegments(60) };
const rest: DraftDay = { ...emptyDay(3), kind: 'REST' };

describe('DayEditorComponent width', () => {
  let fixture: ComponentFixture<DayEditorComponent>;
  let wrap: HTMLElement;

  function render(day: DraftDay, width: number, kindsOpen = false): HTMLElement {
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['searchExercisesPage', 'getExerciseMetadata', 'getOnboardingSeed', 'getExercise']);
    data.searchExercisesPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 1, totalElements: 0 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }] });
    wrap = document.createElement('div');
    wrap.style.width = `${width}px`;
    wrap.style.display = 'block';
    document.body.appendChild(wrap);
    fixture = TestBed.createComponent(DayEditorComponent);
    wrap.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('kindsOpen', kindsOpen);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => wrap?.remove());

  /** Every element must end inside the editor, whatever its kind: that is what "never wider than its container" means. */
  function overflowing(host: HTMLElement): string[] {
    const limit = host.getBoundingClientRect().right + 0.5;
    return Array.from(host.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.right > limit && getComputedStyle(element).position !== 'absolute';
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
  }

  for (const width of [343, 540, 568, 600, 880]) {
    for (const [name, day, open] of [
      ['a strength day', strength, false],
      ['a cardio day', cardio, false],
      ['a sport day', sport, false],
      ['a rest day with the kind tiles', rest, true]
    ] as Array<[string, DraftDay, boolean]>) {
      it(`keeps ${name} inside a ${width} px container`, () => {
        const host = render(day, width, open);
        expect(host.scrollWidth).withContext('scrollWidth').toBeLessThanOrEqual(host.clientWidth);
        expect(host.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        expect(overflowing(host)).withContext('elements past the right edge').toEqual([]);
      });
    }
  }
});
