import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { Exercise, OnboardingSeed } from '../../../../core/fitsync.models';
import { PlanMovesTableComponent } from './plan-moves-table.component';
import { PickedExercise, PlanSetEntry, appendEntry } from './moves-model';

const pick = (id: string, name: string, timeBased = false): PickedExercise => ({ exerciseId: id, exerciseName: name, muscleLine: 'chest · arms · dumbbell', thumbnailUrl: null, timeBased, bodyweight: true });

@Component({
  imports: [PlanMovesTableComponent],
  template: `<app-plan-moves-table [entries]="entries()" [timeBasedDefault]="mobility()" (entriesChange)="entries.set($event)" />`
})
class HostComponent {
  readonly entries = signal<PlanSetEntry[]>([]);
  readonly mobility = signal(false);
}

describe('PlanMovesTableComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let table: PlanMovesTableComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('.row'));
  const names = () => rows().map((row) => row.querySelector('.name strong')!.textContent);
  const input = (row: number, label: string) => rows()[row].querySelector<HTMLInputElement>(`input[aria-label^="${label} for"]`)!;
  const type = (box: HTMLInputElement, value: string) => {
    box.value = value;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    const exercise = { exerciseId: 'x', code: 'x', name: 'X', description: '', exerciseType: 'STRENGTH', primaryMuscleGroup: 'CHEST', equipment: 'DUMBBELL', difficulty: 'BEGINNER', status: 'ACTIVE', custom: false } as Exercise;
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['searchExercisesPage', 'getExerciseMetadata', 'getOnboardingSeed', 'getExercise']);
    data.searchExercisesPage.and.returnValue(of({ items: [exercise, { ...exercise, exerciseId: 'y', code: 'y', name: 'Y Press' }], page: 0, size: 20, totalPages: 1, totalElements: 2 }));
    data.getExerciseMetadata.and.returnValue(of(null));
    data.getOnboardingSeed.and.returnValue(of({ value: {} } as unknown as OnboardingSeed));
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.entries.set(['Bench', 'Row', 'Squat'].reduce<PlanSetEntry[]>((all, name, i) => appendEntry(all, pick(`id${i}`, name), false), []));
    fixture.detectChanges();
    table = fixture.debugElement.children[0].componentInstance;
  });

  it('draws one row per move with its name, line and fields', () => {
    expect(names()).toEqual(['Bench', 'Row', 'Squat']);
    expect(rows()[0].querySelector('.name span')!.textContent).toBe('chest · arms · dumbbell');
    expect(input(0, 'Sets').value).toBe('3');
    expect(input(0, 'Reps').value).toBe('10');
    expect(input(0, 'Weight').value).toBe('');
    expect(input(0, 'Weight').placeholder).toBe('Body');
    host.entries.update((all) => all.map((entry, i) => (i === 1 ? { ...entry, bodyweight: false } : entry)));
    fixture.detectChanges();
    expect(input(1, 'Weight').placeholder).toBe('—');
    expect(input(0, 'Tempo').placeholder).toBe('None');
    expect(input(0, 'Rest').value).toBe('60');
  });

  it('shows the unit inside a field that has a value', () => {
    type(input(0, 'Weight'), '20');
    expect(rows()[0].querySelectorAll('.unit')[0].textContent).toBe('kg');
    expect(rows()[0].querySelectorAll('.box').length).toBe(5);
  });

  it('writes a typed value back through entriesChange', () => {
    type(input(1, 'Sets'), '5');
    expect(host.entries()[1].sets).toBe(5);
    type(input(1, 'Weight'), '22.5');
    expect(host.entries()[1].weightKg).toBe(22.5);
  });

  it('puts an unreadable value back as it was', () => {
    type(input(0, 'Sets'), 'lots');
    expect(host.entries()[0].sets).toBe(3);
    expect(input(0, 'Sets').value).toBe('3');
  });

  it('shows a timed move as Time in seconds', () => {
    host.entries.set(appendEntry([], pick('m1', 'Cat cow', true), false));
    fixture.detectChanges();
    expect(rows()[0].querySelectorAll('.lab')[1].textContent).toBe('Time');
    expect(input(0, 'Time').value).toBe('45');
    type(input(0, 'Time'), '60');
    expect(host.entries()[0].plannedSeconds).toBe(60);
  });

  it('removes a move with the red trash button, named for the move', () => {
    const trash = rows()[1].querySelector<HTMLButtonElement>('.trash')!;
    expect(trash.getAttribute('aria-label')).toBe('Remove Row');
    trash.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Bench', 'Squat']);
    expect(host.entries().map((e) => e.position)).toEqual([1, 2]);
  });

  it('reorders with the arrow keys on the handle', () => {
    const grip = rows()[0].querySelector<HTMLButtonElement>('.grip')!;
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(names()).toEqual(['Row', 'Bench', 'Squat']);
  });

  it('reorders by dropping a row on another', () => {
    const start = new Event('dragstart') as DragEvent;
    rows()[0].querySelector('.grip')!.dispatchEvent(start);
    rows()[2].dispatchEvent(new Event('dragover', { cancelable: true }));
    rows()[2].dispatchEvent(new Event('drop', { cancelable: true }));
    fixture.detectChanges();
    expect(names()).toEqual(['Row', 'Squat', 'Bench']);
  });

  describe('on touch', () => {
    beforeEach(() => {
      table.coarse.set(true);
      fixture.detectChanges();
    });

    it('has no drag handle and puts the arrows behind the row menu', () => {
      expect(el().querySelector('.grip')).toBeNull();
      expect(el().querySelector('.arrows')).toBeNull();
      rows()[0].querySelector<HTMLButtonElement>('.more')!.click();
      fixture.detectChanges();
      expect(rows()[0].querySelector('.arrows')).not.toBeNull();
    });

    it('moves a row down with its arrow and disables the arrows at the ends', () => {
      rows()[0].querySelector<HTMLButtonElement>('.more')!.click();
      fixture.detectChanges();
      const [up, down] = Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.arrows button'));
      expect(up.disabled).toBeTrue();
      down.click();
      fixture.detectChanges();
      expect(names()).toEqual(['Row', 'Bench', 'Squat']);
    });
  });

  describe('notes', () => {
    it('keeps the notes closed until the chevron opens them, and stores what is typed', () => {
      expect(el().querySelector('.notes')).toBeNull();
      rows()[0].querySelector<HTMLButtonElement>('.chev')!.click();
      fixture.detectChanges();
      type(rows()[0].querySelector<HTMLInputElement>('.notes input')!, 'pause one second');
      expect(host.entries()[0].notes).toBe('pause one second');
      fixture.detectChanges();
      expect(rows()[0].querySelector('.chev')!.classList).toContain('filled');
      expect(rows()[1].querySelector('.chev')!.classList).not.toContain('filled');
    });
  });

  describe('width bands', () => {
    const band = () => (fixture.debugElement.children[0].nativeElement as HTMLElement).getAttribute('data-band');

    it('sets the band on the host from the table width', () => {
      table.measure(1000);
      fixture.detectChanges();
      expect(band()).toBe('wide');
      table.measure(700);
      fixture.detectChanges();
      expect(band()).toBe('medium');
      table.measure(380);
      fixture.detectChanges();
      expect(band()).toBe('narrow');
    });

    it('draws the header row once, and only at the wide band', () => {
      table.measure(1000);
      fixture.detectChanges();
      expect(el().querySelectorAll('.head').length).toBe(1);
      expect(Array.from(el().querySelectorAll('.head .h-num')).map((n) => n.textContent)).toEqual(['Sets', 'Reps', 'Weight', 'Rest', 'Tempo']);
      table.measure(700);
      fixture.detectChanges();
      expect(el().querySelector('.head')).toBeNull();
    });

    it('ignores a zero width from a hidden table', () => {
      table.measure(700);
      table.measure(0);
      expect(table.band()).toBe('medium');
    });
  });

  describe('the picker', () => {
    it('opens from + Add move and appends the picked exercise at the end', () => {
      el().querySelector<HTMLButtonElement>('.add')!.click();
      fixture.detectChanges();
      expect(el().querySelector('app-exercise-picker h2')!.textContent).toBe('Add a move');
      el().querySelector<HTMLButtonElement>('app-exercise-picker .item .add')!.click();
      fixture.detectChanges();
      expect(names()).toEqual(['Bench', 'Row', 'Squat', 'X']);
      expect(host.entries()[3].position).toBe(4);
      expect(el().querySelector('app-exercise-picker')).toBeNull();
    });

    it('makes new moves time-based on a mobility day', () => {
      host.mobility.set(true);
      fixture.detectChanges();
      table.openAdd();
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('app-exercise-picker .item .add')!.click();
      expect(host.entries()[3].timeBased).toBeTrue();
    });

    it('swaps the exercise when a name is tapped, keeping sets, reps and weight', () => {
      type(input(1, 'Weight'), '30');
      rows()[1].querySelector<HTMLButtonElement>('.name')!.click();
      fixture.detectChanges();
      expect(el().querySelector('app-exercise-picker h2')!.textContent).toBe('Swap Row');
      el().querySelector<HTMLButtonElement>('app-exercise-picker .item .add')!.click();
      fixture.detectChanges();
      expect(names()).toEqual(['Bench', 'X', 'Squat']);
      expect(host.entries()[1]).toEqual(jasmine.objectContaining({ weightKg: 30, sets: 3, reps: 10, position: 2 }));
    });
  });
});
