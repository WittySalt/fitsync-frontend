import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { MuscleGroupCode, UserGoal, WeeklyTrainingInsight, WorkoutPlan, WorkoutSession, WorkoutSessionDetail } from '../../../core/fitsync.models';
import { BRIEF_NOW } from './brief-time';
import { CoachBriefComponent } from './coach-brief.component';

const NOW = new Date('2026-09-27T00:10:00Z'); // Sunday 08:10 in Asia/Singapore

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    sessionId: 'session-1',
    planId: null,
    name: 'Session',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-09-21T09:00:00Z',
    durationMinutes: 50,
    caloriesBurned: 300,
    completedAt: '2026-09-21T10:00:00Z',
    exerciseCount: 5,
    ...overrides
  };
}

const fourCompletedSessions: WorkoutSession[] = [
  session({ sessionId: 's1', workoutType: 'STRENGTH', durationMinutes: 50, completedAt: '2026-09-21T10:00:00Z', startedAt: '2026-09-21T09:00:00Z' }),
  session({ sessionId: 's2', workoutType: 'CARDIO', durationMinutes: 35, completedAt: '2026-09-24T10:00:00Z', startedAt: '2026-09-24T09:00:00Z' }),
  session({ sessionId: 's3', workoutType: 'STRENGTH', durationMinutes: 50, completedAt: '2026-09-25T10:00:00Z', startedAt: '2026-09-25T09:00:00Z' }),
  session({ sessionId: 's4', workoutType: 'CARDIO', durationMinutes: 35, completedAt: '2026-09-26T10:00:00Z', startedAt: '2026-09-26T09:00:00Z' })
];

const weeklyFrequencyGoal: UserGoal = {
  goalId: 'goal-1',
  goalType: 'WORKOUT_FREQUENCY',
  targetValue: 4,
  targetUnit: 'sessions/week',
  targetDate: '2026-09-27',
  status: 'ACTIVE',
  notes: null
};

const activePlan: WorkoutPlan = {
  planId: 'plan-1',
  name: 'Chest, back and legs',
  description: '',
  goalFocus: 'STRENGTH',
  workoutType: 'STRENGTH',
  difficulty: 'INTERMEDIATE',
  estimatedDurationMinutes: 50,
  status: 'ACTIVE',
  exerciseCount: 6,
  exercises: []
};

function group(muscleGroup: MuscleGroupCode, sessionsThisWeek: number, inActivePlan: boolean, lastTrainedOn: string, consecutiveSessions = 0): WeeklyTrainingInsight['muscleGroups'][number] {
  return {
    muscleGroup,
    sessionsThisWeek,
    inActivePlan,
    trainedYesterday: lastTrainedOn === '2026-09-26',
    lastTrainedOn,
    consecutiveSessions,
    exerciseNames: muscleGroup === 'CORE' ? ['Plank'] : []
  };
}

const weeklyInsight: WeeklyTrainingInsight = {
  timezone: 'Asia/Singapore',
  referenceDate: '2026-09-27',
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  completedSessions: 4,
  totalMinutes: 170,
  previousWeekCompletedSessions: 3,
  previousWeekTotalMinutes: 120,
  muscleGroups: [
    group('CHEST', 2, true, '2026-09-25'),
    group('BACK', 2, true, '2026-09-25'),
    group('CORE', 4, true, '2026-09-26', 8),
    group('LEGS', 2, true, '2026-09-25'),
    group('CARDIO', 2, false, '2026-09-26', 1)
  ],
  volume: { thisWeekKg: 3846, previousWeekKg: 1716, weekBeforePreviousKg: 1716, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 1 }
};

describe('CoachBriefComponent', () => {
  let fixture: ComponentFixture<CoachBriefComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let coachStore: jasmine.SpyObj<CoachStore>;
  let router: Router;

  function setup(): void {
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CoachBriefComponent);
    fixture.componentRef.setInput('firstName', 'Ruixian');
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
    fixture.componentRef.setInput('caloriesTarget', 2100);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutSessionsInRange',
      'getGoals',
      'getActivePlan',
      'getWeeklyTrainingInsight',
      'startWorkoutPlan'
    ]);
    dataService.getWorkoutSessionsInRange.and.returnValue(of(fourCompletedSessions));
    dataService.getGoals.and.returnValue(of([weeklyFrequencyGoal]));
    dataService.getActivePlan.and.returnValue(of(activePlan));
    dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight));
    dataService.startWorkoutPlan.and.returnValue(
      of({
        sessionId: 'started-session',
        planId: 'plan-1',
        name: 'Chest, back and legs',
        workoutType: 'STRENGTH',
        status: 'IN_PROGRESS',
        startedAt: '2026-09-27T00:20:00Z',
        durationMinutes: null,
        caloriesBurned: null,
        completedAt: '',
        exerciseCount: 0,
        perceivedExertion: null,
        notes: '',
        exercises: [],
        createdAt: '2026-09-27T00:20:00Z',
        updatedAt: '2026-09-27T00:20:00Z'
      } satisfies WorkoutSessionDetail)
    );

    coachStore = jasmine.createSpyObj<CoachStore>('CoachStore', ['open', 'ask']);

    await TestBed.configureTestingModule({
      imports: [CoachBriefComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: CoachStore, useValue: coachStore },
        { provide: BRIEF_NOW, useValue: () => NOW }
      ]
    }).compileComponents();
  });



  it('draws the wheel with one sector for each group in the plan or trained this week', () => {
    setup();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-muscle-wheel circle.badge').length).toBe(5);
    expect(element.querySelector('.panel-title')?.textContent?.trim()).toBe('Your plan this week');
    expect(dataService.getWeeklyTrainingInsight).toHaveBeenCalledWith('Asia/Singapore');
  });

  it('lists what the coach noticed under the week strip', () => {
    setup();
    const facts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.noticed-fact')).map((node) => node.textContent?.trim());
    expect(facts).toEqual([
      'Chest, back and legs have had two days off.',
      'Your core has worked eight sessions running.',
      "You lifted 2.2 times last week's weight."
    ]);
  });

  it('falls back to the week count and leaves the observations out when the insight request fails', () => {
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
    setup();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-muscle-wheel')).toBeNull();
    expect(element.querySelector('app-coach-noticed')).toBeNull();
    expect(element.querySelector('.panel-number')?.textContent?.replace(/\s+/g, '')).toBe('4/4');
    expect(element.querySelector('.headline')?.textContent).toContain('Four of four.');
  });

  it('names the panel after the training when no group belongs to a plan', () => {
    dataService.getWeeklyTrainingInsight.and.returnValue(
      of({ ...weeklyInsight, muscleGroups: weeklyInsight.muscleGroups.map((entry) => ({ ...entry, inActivePlan: false })) })
    );
    setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('.panel-title')?.textContent?.trim()).toBe('Your training this week');
  });
  it('updates the meal question when the calorie target arrives after the first render', () => {
    setup();
    fixture.componentRef.setInput('caloriesTarget', null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Plan my meals for today');

    fixture.componentRef.setInput('caloriesTarget', 2100);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Plan my meals for 2,100 kcal');
  });

  it('leaves days that have not happened out of the spoken week summary', () => {
    setup();
    const strip = (fixture.nativeElement as HTMLElement).querySelector('.week-strip');
    expect(strip?.getAttribute('aria-label')).toContain('today open');
    expect(strip?.getAttribute('aria-label')).toContain('Tue rest');
  });
  it('renders "Four of four." for 4 completed sessions against a target of 4', () => {
    setup();
    expect(pageText()).toContain('Four of four.');
  });

  it('renders seven day columns in the week strip', () => {
    setup();
    expect(fixture.nativeElement.querySelectorAll('.day-col').length).toBe(7);
  });

  it('hides the next-session row at NIGHT', () => {
    TestBed.overrideProvider(BRIEF_NOW, { useValue: () => new Date('2026-09-27T14:30:00Z') }); // 22:30 SGT
    setup();
    expect(fixture.nativeElement.querySelector('.next-session-row')).toBeNull();
  });

  it('hides the next-session row when there is no active plan', () => {
    dataService.getActivePlan.and.returnValue(of(null));
    setup();
    expect(fixture.nativeElement.querySelector('.next-session-row')).toBeNull();
  });

  it('shows the next-session row with the plan name when a plan is active in the daytime', () => {
    setup();
    const row = fixture.nativeElement.querySelector('.next-session-row');
    expect(row?.textContent).toContain('Chest, back and legs');
  });

  it('submits the ask form by opening the dock and asking the typed question', () => {
    setup();
    const component = fixture.componentInstance;
    component.askText.set('How is my week going?');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('.ask-box form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(coachStore.open).toHaveBeenCalled();
    expect(coachStore.ask).toHaveBeenCalledWith('How is my week going?');
    expect(component.askText()).toBe('');
  });

  it('does nothing when the ask form is submitted blank', () => {
    setup();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('.ask-box form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(coachStore.open).not.toHaveBeenCalled();
    expect(coachStore.ask).not.toHaveBeenCalled();
  });

  it('asks a quick question directly when its chip is clicked', () => {
    setup();
    const chip: HTMLButtonElement | null = fixture.nativeElement.querySelector('.chip');
    chip?.click();
    fixture.detectChanges();

    expect(coachStore.open).toHaveBeenCalled();
    expect(coachStore.ask).toHaveBeenCalled();
  });

  it('shows the retry panel when the sessions request fails', () => {
    dataService.getWorkoutSessionsInRange.and.returnValue(throwError(() => new Error('boom')));
    setup();

    expect(pageText()).toContain('Coach brief unavailable');
    const retryButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('.state-panel button');
    expect(retryButton).toBeTruthy();
  });

  it('degrades quietly when only the goals request fails: no target shown, week still renders', () => {
    dataService.getGoals.and.returnValue(throwError(() => new Error('boom')));
    setup();

    expect(fixture.nativeElement.querySelectorAll('.day-col').length).toBe(7);
    expect(pageText()).not.toContain('Coach brief unavailable');
  });

  it('navigates to workout history after starting the next session', () => {
    setup();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.start-session-button');
    button.click();
    fixture.detectChanges();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(router.navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
  });

  function pageText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});
