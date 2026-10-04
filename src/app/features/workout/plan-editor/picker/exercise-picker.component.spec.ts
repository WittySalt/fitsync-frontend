import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { Exercise, ExerciseDetail, ExerciseMetadata, OnboardingSeed, PagedExercises } from '../../../../core/fitsync.models';
import { PickedExercise } from '../moves/moves-model';
import { ExercisePickerComponent } from './exercise-picker.component';

const metadata = {
  exerciseTypes: ['STRENGTH'],
  muscleGroups: ['CHEST'],
  equipment: ['BODYWEIGHT', 'DUMBBELL', 'BARBELL', 'NONE'],
  difficulties: ['BEGINNER'],
  workoutTypes: [],
  goalFocuses: [],
  sportActivities: []
} as ExerciseMetadata;

const exercise = (id: string, name: string, overrides: Partial<Exercise> = {}): Exercise => ({
  exerciseId: id,
  code: id,
  name,
  description: 'Lie back. Press up. Lower slowly. Repeat.',
  exerciseType: 'STRENGTH',
  primaryMuscleGroup: 'CHEST',
  equipment: 'DUMBBELL',
  difficulty: 'BEGINNER',
  status: 'ACTIVE',
  custom: false,
  secondaryMuscleGroups: ['ARMS'],
  images: [{ position: 1, url: `/${id}.png` }],
  ...overrides
});

const page = (items: Exercise[], overrides: Partial<PagedExercises> = {}): PagedExercises => ({ items, page: 0, size: 20, totalPages: 1, totalElements: items.length, ...overrides });

describe('ExercisePickerComponent', () => {
  let data: jasmine.SpyObj<FitSyncDataService>;
  let fixture: ComponentFixture<ExercisePickerComponent>;
  let component: ExercisePickerComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const buttons = (selector: string) => Array.from(el().querySelectorAll<HTMLButtonElement>(selector));
  const chip = (text: string) => buttons('.chip').find((b) => b.textContent?.trim() === text)!;
  const lastQuery = () => data.searchExercisesPage.calls.mostRecent().args[0]!;

  function create(inventory: string[] | undefined = ['DUMBBELLS'], swapName: string | null = null): void {
    data.getOnboardingSeed.and.returnValue(of({ value: { equipmentInventory: inventory } } as unknown as OnboardingSeed));
    fixture = TestBed.createComponent(ExercisePickerComponent);
    fixture.componentRef.setInput('swapName', swapName);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['searchExercisesPage', 'getExerciseMetadata', 'getOnboardingSeed', 'getExercise']);
    data.getExerciseMetadata.and.returnValue(of(metadata));
    data.searchExercisesPage.and.callFake((options) => of(options?.size === 1 ? page([], { totalElements: 1720 }) : page([exercise('b1', 'Bench'), exercise('c1', 'Curl')])));
    TestBed.configureTestingModule({
      imports: [ExercisePickerComponent],
      providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }]
    });
  });

  it('turns "What I own" on from the profile and queries each owned equipment plus bodyweight', () => {
    create();
    const equipment = data.searchExercisesPage.calls.allArgs().map(([options]) => options?.equipment).filter(Boolean);
    expect(equipment.sort()).toEqual(['BODYWEIGHT', 'DUMBBELL', 'NONE']);
    expect(component.owned()).toBeTrue();
    expect(chip('What I own').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the catalogue size in the search field', () => {
    create();
    expect(el().querySelector<HTMLInputElement>('input[type=search]')!.placeholder).toBe('Search 1,720 exercises');
  });

  it('does not offer "What I own" when the profile lists no equipment', () => {
    create([]);
    expect(buttons('.chip').some((b) => b.textContent?.trim() === 'What I own')).toBeFalse();
    expect(component.owned()).toBeFalse();
  });

  it('lists rows with a thumbnail, name, muscle line and Add', () => {
    create();
    const row = el().querySelector('.item')!;
    expect(row.querySelector('strong')!.textContent).toBe('Bench');
    expect(row.querySelector('.text span')!.textContent).toBe('Chest · arms · Dumbbell · Beginner');
    expect(row.querySelector('img.thumb')!.getAttribute('src')).toBe('/b1.png');
    expect(row.querySelector('.add')!.textContent!.trim()).toBe('Add');
  });

  it('waits 300 ms after typing before it asks again', fakeAsync(() => {
    create();
    const before = data.searchExercisesPage.calls.count();
    component.setQuery('ben');
    tick(299);
    expect(data.searchExercisesPage.calls.count()).toBe(before);
    tick(1);
    expect(data.searchExercisesPage.calls.count()).toBeGreaterThan(before);
    expect(lastQuery().q).toBe('ben');
  }));

  it('filters by muscle group and lets the same chip go again', () => {
    create();
    chip('Chest').click();
    fixture.detectChanges();
    expect(lastQuery().primaryMuscleGroup).toBe('CHEST');
    chip('Chest').click();
    expect(lastQuery().primaryMuscleGroup).toBeUndefined();
  });

  it('asks for the cardio type on the Cardio chip', () => {
    create();
    chip('Cardio').click();
    expect(lastQuery().exerciseType).toBe('CARDIO');
  });

  it('filters by level', () => {
    create();
    chip('Advanced').click();
    expect(lastQuery().difficulty).toBe('ADVANCED');
    chip('Any').click();
    expect(lastQuery().difficulty).toBeUndefined();
  });

  it('a chosen equipment chip replaces "What I own"', () => {
    create();
    chip('Barbell').click();
    expect(component.owned()).toBeFalse();
    expect(lastQuery().equipment).toBe('BARBELL');
  });

  it('the muscle figure acts as the muscle filter on a wide screen', () => {
    create();
    component.wide.set(true);
    fixture.detectChanges();
    const region = el().querySelector<SVGPathElement>('app-muscle-figure path[data-group="BACK"]')!;
    region.dispatchEvent(new Event('click'));
    expect(component.muscle()).toBe('BACK');
    expect(lastQuery().primaryMuscleGroup).toBe('BACK');
  });

  it('leaves the figure out on a narrow screen', () => {
    create();
    component.wide.set(false);
    fixture.detectChanges();
    expect(el().querySelector('app-muscle-figure')).toBeNull();
  });

  describe('adding', () => {
    it('hands the exercise up and closes for a single add', () => {
      create();
      const picks: PickedExercise[] = [];
      let closed = 0;
      component.picked.subscribe((p) => picks.push(p));
      component.closed.subscribe(() => closed++);
      el().querySelector<HTMLButtonElement>('.item .add')!.click();
      expect(picks[0]).toEqual(jasmine.objectContaining({ exerciseId: 'b1', exerciseName: 'Bench', muscleLine: 'chest · arms · dumbbell', thumbnailUrl: '/b1.png' }));
      expect(closed).toBe(1);
    });

    it('stays open with "Keep adding" and counts what went in', () => {
      create();
      let closed = 0;
      component.closed.subscribe(() => closed++);
      el().querySelector<HTMLInputElement>('.keep input')!.click();
      const adds = buttons('.item .add');
      adds[0].click();
      adds[1].click();
      fixture.detectChanges();
      expect(closed).toBe(0);
      expect(el().querySelector('.count')!.textContent!.trim()).toBe('2 added');
    });

    it('swaps in swap mode: names the move, labels the button Swap, and closes', () => {
      create(['DUMBBELLS'], 'Dumbbell Bench Press');
      let closed = 0;
      component.closed.subscribe(() => closed++);
      expect(el().querySelector('h2')!.textContent).toBe('Swap Dumbbell Bench Press');
      expect(el().querySelector('.keep')).toBeNull();
      const swap = el().querySelector<HTMLButtonElement>('.item .add')!;
      expect(swap.textContent!.trim()).toBe('Swap');
      swap.click();
      expect(closed).toBe(1);
    });
  });

  describe('expanding a row', () => {
    const detail = { ...exercise('b1', 'Bench'), images: [{ position: 1, url: '/f1.png' }, { position: 2, url: '/f2.png' }, { position: 3, url: '/f3.png' }], imageUrls: [], instructions: [], secondaryMuscleGroups: [], shortSteps: ['Lie back', 'Press up', 'Lower slowly', 'Extra'] } as ExerciseDetail;

    it('shows two frames and three short steps on a wide screen', () => {
      data.getExercise.and.returnValue(of(detail));
      create();
      component.wide.set(true);
      el().querySelector<HTMLButtonElement>('.item .open-row')!.click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.frames img').length).toBe(2);
      expect(Array.from(el().querySelectorAll('.steps li')).map((li) => li.textContent)).toEqual(['Lie back', 'Press up', 'Lower slowly']);
      expect(el().querySelector('.primary')!.textContent!.trim()).toBe('Add to plan');
      expect(el().querySelector('.library')!.textContent).toContain('Open in Library');
    });

    it('shows one frame at narrow', () => {
      data.getExercise.and.returnValue(of(detail));
      create();
      component.wide.set(false);
      el().querySelector<HTMLButtonElement>('.item .open-row')!.click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.frames img').length).toBe(1);
    });

    it('falls back to the description sentences when the detail fails to load', () => {
      data.getExercise.and.returnValue(of(null));
      create();
      el().querySelector<HTMLButtonElement>('.item .open-row')!.click();
      fixture.detectChanges();
      expect(Array.from(el().querySelectorAll('.steps li')).map((li) => li.textContent)).toEqual(['Lie back.', 'Press up.', 'Lower slowly.']);
    });

    it('folds the row when it is tapped again, and adds from the expanded row', () => {
      data.getExercise.and.returnValue(of(detail));
      create();
      const picks: PickedExercise[] = [];
      component.picked.subscribe((p) => picks.push(p));
      const open = el().querySelector<HTMLButtonElement>('.item .open-row')!;
      open.click();
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.primary')!.click();
      expect(picks.length).toBe(1);
      open.click();
      fixture.detectChanges();
      expect(el().querySelector('.detail')).toBeNull();
    });
  });

  describe('paging and states', () => {
    it('shows 20 rows a page and appends the next page on Show more', () => {
      data.searchExercisesPage.and.callFake((options) => {
        if (options?.size === 1) {
          return of(page([], { totalElements: 3 }));
        }
        return of(options?.page === 0 ? page([exercise('b1', 'Bench')], { totalPages: 2 }) : page([exercise('c1', 'Curl')], { page: 1, totalPages: 2 }));
      });
      create([]);
      expect(lastQuery().size).toBe(20);
      expect(el().querySelectorAll('.item').length).toBe(1);
      el().querySelector<HTMLButtonElement>('.more')!.click();
      fixture.detectChanges();
      expect(lastQuery().page).toBe(1);
      expect(el().querySelectorAll('.item').length).toBe(2);
      expect(el().querySelector('.more')).toBeNull();
    });

    it('says so when nothing matches', () => {
      data.searchExercisesPage.and.callFake((options) => of(page([], { totalElements: options?.size === 1 ? 5 : 0 })));
      create([]);
      expect(el().textContent).toContain('No exercises match');
    });

    it('shows the error state and retries', () => {
      let fail = true;
      data.searchExercisesPage.and.callFake((options) => (options?.size === 1 ? of(page([])) : fail ? throwError(() => new Error('down')) : of(page([exercise('b1', 'Bench')]))));
      create([]);
      expect(el().textContent).toContain('could not be loaded');
      fail = false;
      el().querySelector<HTMLButtonElement>('app-state-panel button')!.click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.item').length).toBe(1);
    });

    it('closes on Escape and on the scrim', () => {
      create();
      let closed = 0;
      component.closed.subscribe(() => closed++);
      el().querySelector<HTMLButtonElement>('.scrim')!.click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closed).toBe(2);
    });
  });
});
