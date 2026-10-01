import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { SessionPage } from './session.page';
import { WorkoutLiveService } from './workout-live.service';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-1',
    planId: null,
    name: 'Full Body Strength',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-10-01T13:13:00Z',
    completedAt: '2026-10-01T14:01:00Z',
    endedAt: '2026-10-01T14:01:00Z',
    durationMinutes: 48,
    caloriesBurned: 290,
    caloriesEstimated: true,
    effortEstimated: true,
    perceivedExertion: 6,
    exerciseCount: 0,
    notes: '',
    exercises: [],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

describe('SessionPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let live: jasmine.SpyObj<WorkoutLiveService>;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getSession',
      'getExerciseMetadata',
      'getExercises',
      'deleteSession',
      'countSession'
    ]);
    dataService.getSession.and.returnValue(of(detail()));
    dataService.getExerciseMetadata.and.returnValue(of({ workoutTypes: [] } as never));
    dataService.getExercises.and.returnValue(of([]));
    live = jasmine.createSpyObj<WorkoutLiveService>('WorkoutLiveService', ['open', 'sessionRemoved', 'repeatSession']);

    await TestBed.configureTestingModule({
      imports: [SessionPage],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: WorkoutLiveService, useValue: live },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info']) },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ sessionId: 'session-1' })), snapshot: { paramMap: convertToParamMap({ sessionId: 'session-1' }) } }
        }
      ]
    }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('opens the session named in the address', () => {
    const fixture = TestBed.createComponent(SessionPage);
    fixture.detectChanges();

    expect(dataService.getSession).toHaveBeenCalledWith('session-1');
    expect((fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent).toContain('Full Body Strength');
  });

  it('goes back to History, and to History after a delete with the workout forgotten', () => {
    const fixture = TestBed.createComponent(SessionPage);
    fixture.detectChanges();

    fixture.componentInstance.backToHistory();
    expect(navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'history' } });

    fixture.componentInstance.deleted('session-1');
    expect(live.sessionRemoved).toHaveBeenCalledWith('session-1');
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('opens the exercise screen on the Workout page after a repeat', () => {
    const fixture = TestBed.createComponent(SessionPage);
    fixture.detectChanges();

    fixture.componentInstance.repeated();

    expect(live.open).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/workout']);
  });
});
