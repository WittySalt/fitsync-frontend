import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { ExerciseDetail } from '../../../core/fitsync.models';
import { DraftMove, emptyWeek } from './plan-draft';
import { PlanFlowApi } from './plan-flow.api';

const bare = (id: string, name: string): DraftMove => ({
  exerciseId: id,
  name,
  meta: '',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: null,
  restSeconds: 75,
  tempoSeconds: null,
  notes: ''
});

const detail = (over: Partial<ExerciseDetail>): ExerciseDetail =>
  ({ exerciseId: 'x', code: 'x', name: 'x', description: '', exerciseType: 'STRENGTH', primaryMuscleGroup: 'CHEST', equipment: 'MACHINE', difficulty: 'BEGINNER', status: 'ACTIVE', custom: false, images: [], imageUrls: [], instructions: [], secondaryMuscleGroups: ['ARMS'], ...over }) as ExerciseDetail;

describe('PlanFlowApi.enrich', () => {
  let data: jasmine.SpyObj<FitSyncDataService>;
  let api: PlanFlowApi;

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getExercise']);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: FitSyncDataService, useValue: data }] });
    api = TestBed.inject(PlanFlowApi);
  });

  const week = (moves: DraftMove[]) => emptyWeek().map((day) => (day.dayOfWeek === 1 ? { ...day, kind: 'STRENGTH' as const, moves } : day));

  it('fills the muscle line, groups and the bodyweight flag from the catalogue, asking once per exercise', () => {
    data.getExercise.and.callFake((id) =>
      of(id === 'a' ? detail({ exerciseId: 'a', equipment: 'DUMBBELL' }) : detail({ exerciseId: 'b', equipment: 'NONE', primaryMuscleGroup: 'CORE', secondaryMuscleGroups: [] }))
    );
    let result: DraftMove[] = [];
    api.enrich(week([bare('a', 'Press'), bare('b', 'Plank'), bare('a', 'Press again')])).subscribe((days) => (result = days[0].moves));
    expect(data.getExercise).toHaveBeenCalledTimes(2);
    expect(result[0].meta).toBe('chest · arms · dumbbell');
    expect(result[0].bodyweight).toBeFalse();
    expect(result[0].primaryGroups).toEqual(['CHEST']);
    expect(result[1].bodyweight).toBeTrue();
    expect(result[2].meta).toBe('chest · arms · dumbbell');
  });

  it('leaves a move alone when the catalogue does not know it', () => {
    data.getExercise.and.returnValue(of(null));
    let result: DraftMove[] = [];
    api.enrich(week([bare('z', 'Mystery')])).subscribe((days) => (result = days[0].moves));
    expect(result[0].meta).toBe('');
    expect(result[0].bodyweight).toBeUndefined();
  });

  it('does not ask again for a move that is already known', () => {
    api.enrich(week([{ ...bare('a', 'Press'), bodyweight: false }])).subscribe();
    expect(data.getExercise).not.toHaveBeenCalled();
  });
});
