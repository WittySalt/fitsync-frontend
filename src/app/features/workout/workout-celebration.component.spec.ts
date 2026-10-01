import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { effortWord } from './effort-bars.component';
import {
  BADGE_DELAY_MS,
  WorkoutCelebrationComponent,
  badgeItems,
  recordItems
} from './workout-celebration.component';

function completed(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-1',
    name: 'Full Body Strength',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-10-01T13:13:00Z',
    completedAt: '2026-10-01T14:01:00Z',
    durationMinutes: 48,
    caloriesBurned: 290,
    caloriesEstimated: true,
    perceivedExertion: 6,
    effortEstimated: true,
    exerciseCount: 1,
    notes: '',
    exercises: [],
    createdAt: '',
    updatedAt: '',
    newRecords: [
      { exerciseName: 'Goblet Squat', recordType: 'MAX_WEIGHT_KG', value: 16 },
      { exerciseName: 'Goblet Squat', recordType: 'MAX_REPS', value: 12 }
    ],
    ...overrides
  };
}

describe('WorkoutCelebrationComponent', () => {
  let fixture: ComponentFixture<WorkoutCelebrationComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analytics: jasmine.SpyObj<AnalyticsApiService>;
  let toast: jasmine.SpyObj<ToastService>;
  let continued: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => root().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function mount(session: WorkoutSessionDetail): void {
    fixture = TestBed.createComponent(WorkoutCelebrationComponent);
    fixture.componentRef.setInput('summary', { completedSets: 9, totalSets: 12, elapsedSeconds: 2880, estimatedCalories: 250, session });
    fixture.componentRef.setInput('reducedMotion', true);
    continued = jasmine.createSpy('continue');
    fixture.componentInstance.continue.subscribe(continued);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['updateSessionEffort']);
    analytics = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getAchievements']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    analytics.getAchievements.and.returnValue(of({
      achievements: [
        { code: 'WORKOUTS_10', title: '10 workouts', unlocked: true, unlockedAt: '2026-10-01T14:01:02Z', progress: 1 },
        { code: 'FIRST_WORKOUT', title: 'First workout', unlocked: true, unlockedAt: '2026-06-01T08:00:00Z', progress: 1 },
        { code: 'STREAK_7', title: '7 day streak', unlocked: false, unlockedAt: null, progress: 0.4 }
      ]
    }));
    await TestBed.configureTestingModule({
      imports: [WorkoutCelebrationComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AnalyticsApiService, useValue: analytics },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('gives the result first: the minutes, the sets done of all and the calories the server saved', () => {
    mount(completed());

    expect(text('h2')).toBe('Workout complete');
    expect(text('.session-name')).toBe('Full Body Strength');
    expect(Array.from(root().querySelectorAll('.facts > div')).map((fact) => fact.textContent?.trim())).toEqual(['48 min', '9/12 sets', '290 kcal']);
  });

  it('lists the new bests at once and the badges of this workout a moment later', fakeAsync(() => {
    mount(completed());
    expect(root().querySelectorAll('.earned-item').length).toBe(1);
    expect(text('.earned-item strong')).toBe('New best');
    expect(text('.earned-text span')).toBe('Goblet Squat · 16 kg, 12 reps');

    tick(BADGE_DELAY_MS);
    fixture.detectChanges();

    expect(Array.from(root().querySelectorAll('.earned-item strong')).map((item) => item.textContent?.trim()))
      .toEqual(['New best', 'Badge · 10 workouts']);
  }));

  it('leaves Earned today out when nothing was earned', fakeAsync(() => {
    analytics.getAchievements.and.returnValue(of({ achievements: [] }));
    mount(completed({ newRecords: [] }));
    tick(BADGE_DELAY_MS);
    fixture.detectChanges();

    expect(root().querySelector('.earned')).toBeNull();
  }));

  it('opens on the estimated effort and saves nothing when it is left as it is', () => {
    mount(completed());

    expect(text('app-effort-bars .figure')).toBe('6');
    expect(text('app-effort-bars .word')).toBe('Moderate');
    expect(text('app-effort-bars .tag')).toBe('Estimated');

    root().querySelector<HTMLButtonElement>('.done')?.click();

    expect(dataService.updateSessionEffort).not.toHaveBeenCalled();
    expect(continued).toHaveBeenCalledTimes(1);
  });

  it('saves the effort the person picked on the way out, and still leaves when that fails', () => {
    dataService.updateSessionEffort.and.returnValue(of(completed({ perceivedExertion: 8, effortEstimated: false })));
    mount(completed());

    root().querySelectorAll<HTMLButtonElement>('app-effort-bars .bar')[7].click();
    fixture.detectChanges();
    expect(text('app-effort-bars .tag')).toBe('Yours');
    expect(text('app-effort-bars .word')).toBe('Hard');
    root().querySelector<HTMLButtonElement>('.done')?.click();

    expect(dataService.updateSessionEffort).toHaveBeenCalledWith('session-1', 8);
    expect(continued).toHaveBeenCalledTimes(1);

    dataService.updateSessionEffort.and.returnValue(throwError(() => new Error('down')));
    mount(completed());
    root().querySelectorAll<HTMLButtonElement>('app-effort-bars .bar')[2].click();
    root().querySelector<HTMLButtonElement>('.done')?.click();
    expect(toast.error).toHaveBeenCalled();
    expect(continued).toHaveBeenCalledTimes(1);
  });

  it('moves the effort with the arrow keys and asks nothing when the server gave no effort', () => {
    mount(completed());
    const bars = root().querySelectorAll<HTMLButtonElement>('app-effort-bars .bar');
    bars[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(text('app-effort-bars .figure')).toBe('7');
    expect(bars[6].getAttribute('aria-checked')).toBe('true');

    mount(completed({ perceivedExertion: null }));
    expect(root().querySelector('app-effort-bars')).toBeNull();
  });
});

describe('completion screen helpers', () => {
  it('names each effort with one word', () => {
    expect([1, 3, 5, 7, 9, 10].map(effortWord)).toEqual(['Very easy', 'Easy', 'Moderate', 'Hard', 'Very hard', 'All out']);
    expect(effortWord(null)).toBe('');
  });

  it('groups the records by exercise and keeps only badges unlocked since the start', () => {
    expect(recordItems([{ exerciseName: 'Row', recordType: 'MAX_SINGLE_SET_VOLUME_KG', value: 180 }]))
      .toEqual([{ kind: 'record', title: 'New best', line: 'Row · 180 kg in one set' }]);
    expect(recordItems([{ exerciseName: 'Row', recordType: 'UNKNOWN', value: 1 }])).toEqual([]);
    expect(badgeItems([
      { code: 'A', title: 'A', unlocked: true, unlockedAt: '2026-10-01T10:00:00Z', progress: 1 },
      { code: 'B', title: 'B', unlocked: true, unlockedAt: '2026-10-01T08:00:00Z', progress: 1 }
    ], '2026-10-01T09:00:00Z').map((item) => item.title)).toEqual(['Badge · A']);
  });
});
