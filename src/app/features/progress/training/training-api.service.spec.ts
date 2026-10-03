import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { AccountDataService } from '../../../core/account-data.service';
import { BODY_WEIGHT_HEADER, TrainingApiService, validBodyWeight } from './training-api.service';
import { mapActivityProgress, mapExerciseProgress, mapTrainingProgress } from './training-mappers';

describe('TrainingApiService', () => {
  let http: HttpTestingController;
  let weight: unknown;
  let fails: boolean;

  beforeEach(() => {
    weight = 71.2;
    fails = false;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AccountDataService,
          useValue: {
            getCurrentUser: () => (fails ? throwError(() => new Error('down')) : of({ latestBodyMetrics: { weightKg: weight } }))
          }
        }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the period and the profile weight on the training read', () => {
    let result: unknown;
    TestBed.inject(TrainingApiService).getTraining('2026-09-06', '2026-10-03').subscribe((value) => (result = value));
    const request = http.expectOne((req) => req.url === '/api/v1/workouts/progress/training');
    expect(request.request.params.get('from')).toBe('2026-09-06');
    expect(request.request.params.get('to')).toBe('2026-10-03');
    expect(request.request.headers.get(BODY_WEIGHT_HEADER)).toBe('71.2');
    request.flush({});
    expect(result).toBeTruthy();
  });

  it('sends no weight when it is out of range or the profile cannot be read', () => {
    weight = 12;
    TestBed.inject(TrainingApiService).getActivity('SPORT:badminton', '2026-09-06', '2026-10-03').subscribe();
    const request = http.expectOne((req) => req.url === '/api/v1/workouts/progress/activities/SPORT%3Abadminton');
    expect(request.request.headers.has(BODY_WEIGHT_HEADER)).toBeFalse();
    request.flush({});

    fails = true;
    TestBed.inject(TrainingApiService).getExercise('ex/1', '2026-09-06', '2026-10-03').subscribe();
    const second = http.expectOne((req) => req.url === '/api/v1/workouts/progress/exercises/ex%2F1');
    expect(second.request.headers.has(BODY_WEIGHT_HEADER)).toBeFalse();
    second.flush({});
  });

  it('validates the header weight to 30 to 300 kg', () => {
    expect(validBodyWeight(29.9)).toBeNull();
    expect(validBodyWeight(300)).toBe(300);
    expect(validBodyWeight('71.24')).toBe(71.2);
    expect(validBodyWeight(null)).toBeNull();
  });
});

describe('training mappers', () => {
  it('turns an empty response into empty sections and keeps the asked period', () => {
    const progress = mapTrainingProgress(null, '2026-09-06', '2026-10-03');
    expect(progress.period).toEqual({ from: '2026-09-06', to: '2026-10-03' });
    expect(progress.hero.sessions).toEqual({ value: null, previous: null });
    expect(progress.lifts).toEqual([]);
    expect(progress.muscles.usualRange).toEqual({ low: 10, high: 20 });
    expect(progress.load.form).toBeNull();
  });

  it('reads the contract shape and drops malformed entries', () => {
    const progress = mapTrainingProgress(
      {
        hero: { sessions: { value: 15, previous: 13 }, load: { value: '4320', previous: 3960, estimatedShare: 0.2 }, records: { value: 4, exercises: ['Deadlift', 3] } },
        highlights: [{ code: 'LIFT_UP', title: 'Up', series: [{ label: 'a', value: 1 }, { label: 'b', value: 'x' }] }, { title: '' }, {}, {}, {}, { title: 'Fifth' }],
        activities: [{ key: 'SPORT:badminton', name: 'Badminton', sessions: 4, cumulativeMinutes: [{ date: '2026-09-06', minutes: 60 }, { date: 'bad' }] }, { name: 'no key' }],
        load: { weeks: [{ weekStart: '2026-09-28', byKind: { STRENGTH: 460, CARDIO: 260 } }], form: 'FRESH' },
        muscles: { groups: [{ group: 'legs', setsPerWeek: 22, exercises: [{ exerciseId: 'e', name: 'Squat', sets: 8 }] }] },
        lifts: [{ exerciseId: 'd', name: 'Deadlift', e1rm: [{ date: '2026-09-15', value: 87.5, isRecord: true }, { date: '2026-09-08', value: 81.7 }], bodyWeightKg: 500, relative: { ratio: 1.3, level: 'NOVICE', nextLevel: 'INTERMEDIATE', nextAtKg: 89 } }],
        calendar: [{ date: '2026-10-02', kind: 'STRENGTH', minutes: 50, record: true }, { kind: 'CARDIO' }],
        records: [{ date: '2026-09-15', name: 'Deadlift', value: 87.5, delta: 2.5 }, { date: '2026-10-02', name: 'Squat', value: 81 }]
      },
      '2026-09-06',
      '2026-10-03'
    );
    expect(progress.hero.load.value).toBe(4320);
    expect(progress.hero.records.exercises).toEqual(['Deadlift']);
    expect(progress.highlights.map((h) => h.title)).toEqual(['Up', 'Fifth']);
    expect(progress.highlights[0].series.length).toBe(1);
    expect(progress.activities.length).toBe(1);
    expect(progress.activities[0].kind).toBe('SPORT');
    expect(progress.activities[0].cumulative.length).toBe(1);
    expect(progress.load.weeks[0].total).toBe(720);
    expect(progress.load.weeks[0].byKind.SPORT).toBe(0);
    expect(progress.muscles.groups[0].group).toBe('LEGS');
    expect(progress.lifts[0].e1rm.map((p) => p.date)).toEqual(['2026-09-08', '2026-09-15']);
    expect(progress.lifts[0].bodyWeightKg).toBeNull();
    expect(progress.lifts[0].relative?.nextAtKg).toBe(89);
    expect(progress.calendar.length).toBe(1);
    expect(progress.records.map((r) => r.name)).toEqual(['Squat', 'Deadlift']);
    expect(progress.records[0].unit).toBe('kg');
  });

  it('reads an activity and an exercise defensively', () => {
    const activity = mapActivityProgress({ tiles: { longestSession: { minutes: 70, date: '2026-08-30' } }, sessions: [{ sessionId: 's1', minutes: 60, effort: 6 }, {}] }, 'SPORT:badminton');
    expect(activity.name).toBe('badminton');
    expect(activity.kind).toBe('SPORT');
    expect(activity.tiles.longestSession?.minutes).toBe(70);
    expect(activity.sessions.length).toBe(1);

    const exercise = mapExerciseProgress({ name: 'Deadlift', history: [{ date: '2026-09-22', sets: [{ weightKg: 75, reps: 5 }, { reps: 2 }] }, { date: '2026-10-02', sets: [], record: true }] }, 'd');
    expect(exercise.series.e1rm).toEqual([]);
    expect(exercise.history[0].date).toBe('2026-10-02');
    expect(exercise.history[1].sets.length).toBe(1);
    expect(exercise.tiles.e1rm).toBeNull();
  });
});
