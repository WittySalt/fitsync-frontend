import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  DayInsight,
  DayKind,
  NextTraining,
  TodayInsight,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutPlanExercise,
  WorkoutSession
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { PlanTemplatesComponent } from './plan-templates.component';
import { TodayOverviewComponent } from './today-overview.component';
import { UserTimezoneService } from '../../core/user-timezone.service';

function move(sequence: number, name: string, overrides: Partial<WorkoutPlanExercise> = {}): WorkoutPlanExercise {
  return {
    planExerciseId: `pe-${name}`,
    exerciseId: `exercise-${sequence}`,
    exerciseNameSnapshot: name,
    sequence,
    targetSets: 3,
    targetReps: 10,
    targetWeightKg: null,
    targetDurationSeconds: null,
    targetDistanceKm: null,
    restSeconds: 75,
    notes: '',
    setTargets: [],
    ...overrides
  };
}

function planDay(planDayId: string, kind: WorkoutPlanDay['kind'], exercises: WorkoutPlanExercise[], title = 'Day'): WorkoutPlanDay {
  return {
    planDayId,
    dayOfWeek: 1,
    kind,
    title,
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: 40,
    exercises
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Strength base',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 45,
    status: 'ACTIVE',
    exerciseCount: 2,
    exercises: [move(2, 'Back squat', { targetSets: 4, targetReps: 6, targetWeightKg: 80, restSeconds: 120 }), move(1, 'Push up')],
    days: [
      planDay('d-strength', 'STRENGTH', [
        move(2, 'Bent-over row', { targetWeightKg: 20 }),
        move(1, 'Dumbbell bench press', { targetWeightKg: 22.5 }),
        move(3, 'Goblet squat', { targetReps: 12, targetWeightKg: 18 }),
        move(4, 'Plank hold', { targetReps: null, targetDurationSeconds: 45, restSeconds: 45 })
      ]),
      planDay('d-cardio', 'CARDIO', [
        move(1, 'Treadmill run', { targetSets: null, targetReps: null, targetDurationSeconds: 2100, targetDistanceKm: 5, restSeconds: null }),
        move(2, 'Plank hold', { targetReps: null, targetDurationSeconds: 45, restSeconds: 45 })
      ]),
      planDay('d-mobility', 'MOBILITY', [
        move(1, 'Cat stretch'),
        move(2, "Child's pose"),
        move(3, 'Hamstring stretch'),
        move(4, 'Hip opener'),
        move(5, 'Neck roll')
      ]),
      planDay('d-mobility-short', 'MOBILITY', [move(1, 'Cat stretch'), move(2, "Child's pose")]),
      planDay('d-sport', 'SPORT', []),
      planDay('d-monday', 'STRENGTH', [move(1, 'Monday squat')], 'Full body')
    ],
    sessionsPerWeek: 4,
    ...overrides
  };
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Last lift',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-06-18T10:00:00Z',
    completedAt: '2026-06-18T11:00:00Z',
    durationMinutes: 60,
    caloriesBurned: 400,
    exerciseCount: 4,
    ...overrides
  };
}

function today(overrides: Partial<TodayInsight> = {}): TodayInsight {
  return {
    date: '2026-09-30',
    kind: 'STRENGTH',
    label: 'Strength',
    source: 'PLAN',
    planDayId: 'd-strength',
    title: 'Full body',
    estimatedMinutes: 50,
    moves: 4,
    lastOfKind: null,
    carriedOver: [],
    ...overrides
  };
}

function next(overrides: Partial<NextTraining> = {}): NextTraining {
  return { date: '2026-10-01', kind: 'CARDIO', label: 'Cardio', title: 'Treadmill run', estimatedMinutes: 35, ...overrides };
}

function dayEntry(overrides: Partial<DayInsight> = {}): DayInsight {
  return {
    date: '2026-09-30',
    dayOfWeek: 3,
    kind: 'STRENGTH',
    label: 'Strength',
    source: 'DONE',
    minutes: 50,
    sessions: [],
    planned: null,
    ...overrides
  };
}

describe('TodayOverviewComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let fixture: ComponentFixture<TodayOverviewComponent>;
  let component: TodayOverviewComponent;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    const defaults: Record<string, unknown> = { activePlan: plan(), sessions: [] };
    const { timezone, ...rest } = inputs;
    if (typeof timezone === 'string') {
      TestBed.inject(UserTimezoneService).setProfileZone(timezone);
    }
    for (const [name, value] of Object.entries({ ...defaults, ...rest })) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string) => root.querySelector(selector)?.textContent?.trim() ?? null;
  const all = (root: HTMLElement, selector: string) => [...root.querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? '');
  const rows = (root: HTMLElement) => all(root, '.move-copy strong');
  const chips = (root: HTMLElement) => (root.querySelector('.info')?.textContent?.trim() ?? '').split(' · ').filter(Boolean);

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getExercises', 'getExercise', 'createWorkoutPlan', 'activateWorkoutPlan']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    dataService.getExercises.and.returnValue(of([]));
    dataService.getExercise.and.returnValue(of(null));
    dataService.createWorkoutPlan.and.returnValue(of(plan()));
    dataService.activateWorkoutPlan.and.returnValue(of(plan({ status: 'ACTIVE' })));

    await TestBed.configureTestingModule({
      imports: [TodayOverviewComponent],
      providers: [provideHttpClient(), { provide: FitSyncDataService, useValue: dataService }, { provide: ToastService, useValue: toast }]
    }).compileComponents();

    fixture = TestBed.createComponent(TodayOverviewComponent);
    component = fixture.componentInstance;
  });

  describe('target formatting', () => {
    it('formats sets, reps, weight and rest with the design separators', () => {
      expect(component.exerciseTarget(move(1, 'Bench', { targetWeightKg: 22.5 }))).toBe('3 × 10 · 22.5 kg · 75 s rest');
    });

    it('formats a duration-only target without a dangling dash', () => {
      const summary = component.exerciseTarget(move(1, 'Plank', { targetReps: null, targetDurationSeconds: 45, restSeconds: 45 }));
      expect(summary).toBe('3 × 45 s · 45 s rest');
      expect(summary).not.toContain('-');
    });

    it('formats reps with a duration, a distance and sets only', () => {
      expect(component.exerciseTarget(move(1, 'A', { targetDurationSeconds: 30, restSeconds: 0 }))).toBe('3 × 10 · 30 s');
      expect(component.exerciseTarget(move(1, 'B', { targetSets: 4, targetReps: null, restSeconds: 0 }))).toBe('4 sets');
      expect(component.exerciseTarget(move(1, 'C', { targetSets: null, targetReps: null, targetDistanceKm: 5.75, restSeconds: null }))).toBe('5.75 km');
    });

    it('names a movement without targets', () => {
      expect(component.exerciseTarget(move(1, 'D', { targetSets: null, targetReps: null, restSeconds: null }))).toBe('Guided movement');
    });
  });

  describe('forms by the kind of day', () => {
    it('shows a strength day with its moves, chips and both actions', () => {
      const root = render({ today: today() });

      expect(text(root, '.eyebrow')).toBe('Today · Strength');
      expect(text(root, 'h2')).toBe('Full body');
      expect(chips(root)).toEqual(['4 moves', '50 min', 'Beginner']);
      expect(rows(root)).toEqual(['Dumbbell bench press', 'Bent-over row', 'Goblet squat', 'Plank hold']);
      expect(all(root, '.move-copy small')[0]).toBe('3 × 10 · 22.5 kg · 75 s rest');
      expect(text(root, '.action-primary')).toBe('Start session');
      expect(text(root, 'a.action-secondary')).toBe('Train something else');
      expect(root.querySelector('button.action-secondary')).toBeNull();
      expect(root.querySelector('.action-primary')?.classList).not.toContain('quiet');
      expect(root.querySelector('.action-primary svg')).toBeNull();
    });

    it('shows a cardio day with last time distance and pace', () => {
      const root = render({
        today: today({
          kind: 'CARDIO',
          label: 'Cardio',
          planDayId: 'd-cardio',
          title: 'Treadmill run',
          estimatedMinutes: 35,
          lastOfKind: { date: '2026-09-27', minutes: 35, distanceKm: 5.75, paceSecondsPerKm: 365 }
        })
      });

      expect(text(root, '.eyebrow')).toBe('Today · Cardio');
      expect(text(root, 'h2')).toBe('Treadmill run');
      expect(chips(root)).toEqual(['35 min', '5.75 km last time', '6:05 per km']);
      expect(rows(root)).toEqual(['Treadmill run', 'Plank hold']);
      expect(all(root, '.move-copy small')[0]).toBe('5 km · 35 min');
      expect(text(root, 'a.action-secondary')).toBe('Train something else');
    });

    it('shows a mobility day with three moves and a quiet line for the rest', () => {
      const root = render({
        today: today({ kind: 'MOBILITY', label: 'Mobility', planDayId: 'd-mobility', title: 'Morning stretch', estimatedMinutes: 20, moves: 5 })
      });

      expect(text(root, '.eyebrow')).toBe('Today · Mobility');
      expect(chips(root)).toEqual(['5 moves', '20 min']);
      expect(rows(root)).toEqual(['Cat stretch', "Child's pose", 'Hamstring stretch']);
      expect(text(root, '.more')).toBe('and 2 more');
    });

    it('leaves the quiet line out when a mobility day has three moves or fewer', () => {
      const root = render({
        today: today({ kind: 'MOBILITY', label: 'Mobility', planDayId: 'd-mobility-short', title: 'Short stretch', moves: 2 })
      });

      expect(rows(root).length).toBe(2);
      expect(root.querySelector('.more')).toBeNull();
    });

    it('shows a sport day by the sport name, with a log-afterwards button and no moves', () => {
      const root = render({
        today: today({
          kind: 'SPORT',
          label: 'Badminton',
          planDayId: 'd-sport',
          title: 'Saturday game',
          estimatedMinutes: 90,
          moves: null,
          lastOfKind: { date: '2026-09-26', minutes: 60, distanceKm: null, paceSecondsPerKm: null }
        })
      });

      expect(text(root, '.eyebrow')).toBe('Today · Sport');
      expect(text(root, 'h2')).toBe('Badminton');
      expect(chips(root)).toEqual(['1 h last time']);
      expect(root.querySelector('.moves')).toBeNull();
      expect(text(root, '.action-primary')).toBe('Start session');
      expect(text(root, '.action-secondary')).toBe('Log it afterwards');
      expect(root.querySelector('a.action-secondary')).toBeNull();
    });

    it('shows the planned length on a sport day nobody has played yet', () => {
      const root = render({
        today: today({ kind: 'SPORT', label: 'Badminton', planDayId: 'd-sport', estimatedMinutes: 90, moves: null })
      });

      expect(chips(root)).toEqual(['1 h 30 min']);
    });

    it('shows a habit day as the usual kind, from the last time', () => {
      const root = render({
        activePlan: null,
        today: today({
          kind: 'CARDIO',
          label: 'Cardio',
          source: 'HABIT',
          planDayId: null,
          title: null,
          estimatedMinutes: null,
          moves: null,
          lastOfKind: { date: '2026-09-27', minutes: 35, distanceKm: 5.75, paceSecondsPerKm: 365 }
        })
      });

      expect(text(root, '.eyebrow')).toBe('Your usual · Cardio');
      expect(text(root, 'h2')).toBe('Cardio');
      // The recommendation is the habit start's, and the plain actions are not shown.
      expect(root.querySelector('app-habit-day-start')).not.toBeNull();
      expect(all(root, 'app-habit-day-start .facts li')).toEqual(['35 min last time', '5.75 km last time']);
      expect(root.querySelector('.moves')).toBeNull();
      expect(root.querySelector('.action-primary')).toBeNull();
      expect(root.querySelector('a.action-secondary')).toBeNull();
      expect(text(root, 'app-habit-day-start .start')).toBe('Start this');
    });

    it('keeps the plain Start session on a habit day that has a plan day', () => {
      const root = render({ today: today({ kind: 'STRENGTH', source: 'HABIT', planDayId: 'd-strength' }) });

      expect(root.querySelector('app-habit-day-start')).toBeNull();
      expect(text(root, '.action-primary')).toBe('Start session');
    });

    it('shows a session in progress with only Continue', () => {
      const root = render({ today: today({ source: 'IN_PROGRESS' }) });

      expect(text(root, '.eyebrow')).toBe('In progress');
      expect(text(root, 'h2')).toBe('Full body');
      expect(root.querySelector('.info')).toBeNull();
      expect(root.querySelector('.moves')).toBeNull();
      expect(text(root, '.action-primary')).toBe('Continue');
      expect(root.querySelector('a.action-secondary')).toBeNull();
    });

    it('shows a finished strength day with its minutes and a link to the session', () => {
      const root = render({ today: today({ source: 'DONE' }), todayDay: dayEntry({ minutes: 50 }) });

      expect(text(root, '.eyebrow')).toBe('Done today');
      expect(chips(root)).toEqual(['50 min']);
      expect(root.querySelector('.action-primary')).toBeNull();
      expect(text(root, 'a.action-secondary')).toBe('See the session');
    });

    it('adds distance and pace to a finished cardio day when the day entry has them', () => {
      const root = render({
        today: today({ kind: 'CARDIO', label: 'Cardio', source: 'DONE', title: null }),
        todayDay: dayEntry({
          kind: 'CARDIO',
          minutes: 35,
          sessions: [
            { sessionId: 's-1', kind: 'CARDIO', label: 'Cardio', sportActivity: null, status: 'COMPLETED', minutes: 35, distanceKm: 6, planDayId: null }
          ]
        })
      });

      expect(text(root, 'h2')).toBe('Cardio');
      expect(chips(root)).toEqual(['35 min', '6 km', '5:50 per km']);
    });

    it('keeps a finished cardio day to its minutes when the day entry has no distance', () => {
      const root = render({
        today: today({ kind: 'CARDIO', label: 'Cardio', source: 'DONE' }),
        todayDay: dayEntry({ kind: 'CARDIO', minutes: 35 })
      });

      expect(chips(root)).toEqual(['35 min']);
    });

    it('shows a rest day with the next training day and no start button', () => {
      const root = render({
        today: today({ kind: 'REST', label: 'Rest', planDayId: null, title: null, estimatedMinutes: null, moves: null }),
        nextTraining: next()
      });

      expect(text(root, '.eyebrow')).toBe('Today · Rest');
      expect(text(root, 'h2')).toBe('Rest day');
      expect(chips(root)).toEqual(['Next: Thursday', 'Treadmill run', '35 min']);
      expect(root.querySelector('.action-primary')).toBeNull();
      expect(root.querySelector('button.action-secondary')).toBeNull();
      expect(text(root, 'a.action-secondary')).toBe('Train today');
    });

    it('names a sport by its name in the next-training line', () => {
      const root = render({
        today: today({ kind: 'REST', label: 'Rest', planDayId: null }),
        nextTraining: next({ date: '2026-10-03', kind: 'SPORT', label: 'Badminton' })
      });

      expect(chips(root)).toEqual(['Next: Saturday', 'Badminton', '35 min']);
    });

    it('offers the earlier open day on a rest day', () => {
      const root = render({
        today: today({
          kind: 'REST',
          label: 'Rest',
          planDayId: null,
          carriedOver: [{ planDayId: 'd-monday', dayOfWeek: 1, kind: 'STRENGTH', title: 'Full body', estimatedMinutes: 50 }]
        })
      });

      expect(text(root, '.eyebrow')).toBe('Still open from Monday');
      expect(text(root, 'h2')).toBe('Full body');
      expect(chips(root)).toEqual(['50 min']);
      expect(rows(root)).toEqual(['Monday squat']);
      expect(text(root, '.action-primary')).toBe('Start session');
      expect(text(root, 'a.action-secondary')).toBe('Train something else');
    });

    it('offers the earlier open day on an open day too, and leaves the rows out when the plan lacks it', () => {
      const root = render({
        today: today({
          kind: 'OPEN',
          label: 'Today',
          planDayId: null,
          carriedOver: [{ planDayId: 'd-gone', dayOfWeek: 2, kind: 'CARDIO', title: 'Treadmill run', estimatedMinutes: null }]
        })
      });

      expect(text(root, '.eyebrow')).toBe('Still open from Tuesday');
      expect(root.querySelector('.info')).toBeNull();
      expect(root.querySelector('.moves')).toBeNull();
    });

    it('guides an open day without an active plan to the templates', () => {
      const root = render({ activePlan: null, today: today({ kind: 'OPEN', label: 'Today', source: 'NONE', planDayId: null }) });

      expect(text(root, '.eyebrow')).toBe('No plan yet');
      expect(text(root, 'h2')).toBe('Pick a plan for today');
      expect(text(root, '.lede')).toBe('A plan says what each day of the week is for.');
      expect(text(root, '.action-primary')).toBe('Browse plans');
      expect(root.querySelector('app-plan-templates')).not.toBeNull();
    });

    it('shows the plain plan on an open day with an active plan', () => {
      const root = render({ today: today({ kind: 'OPEN', label: 'Today', source: 'NONE', planDayId: null }) });

      expect(text(root, '.eyebrow')).toBe('Today');
      expect(text(root, 'h2')).toBe('Strength base');
      expect(rows(root)).toEqual(['Push up', 'Back squat']);
      expect(text(root, '.action-primary')).toBe('Start session');
      expect(root.querySelector('app-plan-templates')).toBeNull();
    });
  });

  describe('without the weekly insight', () => {
    it('falls back to the plan, its moves and Start session', () => {
      const root = render({ today: null });

      expect(text(root, '.eyebrow')).toBe('Today');
      expect(text(root, 'h2')).toBe('Strength base');
      expect(chips(root)).toEqual(['2 moves', '45 min', 'Beginner']);
      expect(rows(root)).toEqual(['Push up', 'Back squat']);
      expect(text(root, '.action-primary')).toBe('Start session');
    });

    it('guides to the templates when there is no plan either', () => {
      const root = render({ activePlan: null, today: null });

      expect(text(root, '.eyebrow')).toBe('No plan yet');
      expect(root.querySelector('app-plan-templates')).not.toBeNull();
    });

    it('is never blank when the plan has no exercises', () => {
      const root = render({ activePlan: plan({ exercises: [], days: [] }), today: null });

      expect(text(root, 'h2')).toBe('Strength base');
      expect(chips(root)).toEqual(['45 min', 'Beginner']);
      expect(root.querySelector('.moves')).toBeNull();
    });
  });

  describe('missing parts', () => {
    it('leaves out the rows when the plan has no day with the insight id', () => {
      const root = render({ today: today({ planDayId: 'd-unknown' }) });

      expect(root.querySelector('.moves')).toBeNull();
      expect(text(root, 'h2')).toBe('Full body');
    });

    it('drops chips whose values are missing, with no separators left behind', () => {
      const root = render({
        activePlan: plan({ difficulty: '' }),
        today: today({ estimatedMinutes: null, moves: null, planDayId: 'd-unknown' })
      });

      expect(root.querySelector('.info')).toBeNull();
    });

    it('never prints null, undefined or NaN', () => {
      const bare = today({
        kind: 'CARDIO',
        title: null,
        estimatedMinutes: null,
        moves: null,
        planDayId: null,
        lastOfKind: { date: '2026-09-27', minutes: null, distanceKm: null, paceSecondsPerKm: null }
      });
      for (const insight of [bare, today({ source: 'DONE', title: null }), today({ kind: 'REST', planDayId: null })]) {
        const content = render({ today: insight, nextTraining: next({ date: 'nonsense' }), todayDay: null, sessions: [session({ startedAt: '', completedAt: '', durationMinutes: 0 })] }).textContent ?? '';
        expect(content).not.toMatch(/null|undefined|NaN/);
      }
    });

    it('skips the next-training chip when its date cannot be read', () => {
      const root = render({ today: today({ kind: 'REST', planDayId: null }), nextTraining: next({ date: 'nonsense' }) });

      expect(root.querySelector('.info')).toBeNull();
    });
  });

  describe('last session footer', () => {
    it('shows the latest completed session with its day and length', () => {
      const root = render({
        today: today(),
        timezone: 'Asia/Singapore',
        sessions: [
          session({ name: 'Older', completedAt: '2026-09-27T11:00:00Z', startedAt: '2026-09-27T10:00:00Z' }),
          session({ sessionId: 's-2', name: 'Cardio, treadmill', startedAt: '2026-10-01T10:00:00Z', completedAt: '2026-10-01T10:35:00Z', durationMinutes: 35 }),
          session({ sessionId: 's-3', name: 'Cancelled draft', status: 'CANCELLED', startedAt: '2026-10-02T10:00:00Z', completedAt: '2026-10-02T11:00:00Z' }),
          session({ sessionId: 's-4', name: 'Still running', status: 'IN_PROGRESS', startedAt: '2026-10-03T10:00:00Z', completedAt: '' })
        ]
      });

      expect(text(root, '.last-label')).toBe('Last session');
      expect(text(root, '.last-session strong')).toBe('Cardio, treadmill');
      expect(text(root, '.last-session span:last-child')).toMatch(/^Thursday 1 Oct · 35 min$/);
      expect(root.textContent).not.toContain('Cancelled draft');
      expect(root.textContent).not.toContain('Still running');
    });

    it('reads the day in the given timezone', () => {
      const late = session({ startedAt: '2026-09-30T22:00:00Z', completedAt: '2026-09-30T23:00:00Z' });

      expect(text(render({ today: today(), timezone: 'Asia/Singapore', sessions: [late] }), '.last-session span:last-child')).toContain('Thursday 1 Oct');
      expect(text(render({ today: today(), timezone: 'UTC', sessions: [late] }), '.last-session span:last-child')).toMatch(/Wednesday 30 Sep/);
    });

    it('still renders with an unknown timezone name', () => {
      const root = render({ today: today(), timezone: 'Not/AZone', sessions: [session()] });

      expect(text(root, '.last-session strong')).toBe('Last lift');
    });

    it('shows the latest completed session it is given, when the rows it holds are cancelled or running', () => {
      const root = render({
        today: today(),
        timezone: 'Asia/Singapore',
        sessions: [
          session({ sessionId: 's-3', name: 'Cancelled draft', status: 'CANCELLED' }),
          session({ sessionId: 's-4', name: 'Still running', status: 'IN_PROGRESS', completedAt: '' })
        ],
        lastCompleted: session({ sessionId: 's-9', name: 'Pull day', startedAt: '2026-09-29T10:00:00Z', completedAt: '2026-09-29T10:50:00Z', durationMinutes: 50 })
      });

      expect(text(root, '.last-session strong')).toBe('Pull day');
      expect(text(root, '.last-session span:last-child')).toMatch(/^Tuesday 29 Sep.* · 50 min$/);
    });

    it('says none yet when there is no completed session', () => {
      const root = render({ today: today(), sessions: [] });

      expect(text(root, '.last-session strong')).toBe('None yet');
      expect(text(root, '.last-session span:last-child')).toBe('Your first session will show here');
    });
  });

  describe('outputs', () => {
    it('starts the plan with the plan day of a planned day', () => {
      const emit = spyOn(component.startPlan, 'emit');
      const active = plan();
      const root = render({ activePlan: active, today: today() });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ plan: active, planDayId: 'd-strength' });
    });

    it('starts the carried-over day', () => {
      const emit = spyOn(component.startPlan, 'emit');
      const active = plan();
      const root = render({
        activePlan: active,
        today: today({
          kind: 'REST',
          planDayId: null,
          carriedOver: [{ planDayId: 'd-monday', dayOfWeek: 1, kind: 'STRENGTH', title: 'Full body', estimatedMinutes: 50 }]
        })
      });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ plan: active, planDayId: 'd-monday' });
    });

    it('starts the plain plan without a plan day', () => {
      const emit = spyOn(component.startPlan, 'emit');
      const active = plan();
      const root = render({ activePlan: active, today: null });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ plan: active, planDayId: null });
    });

    it('does not start a plan that has no id, and disables the button while starting', () => {
      const emit = spyOn(component.startPlan, 'emit');
      const root = render({ activePlan: plan({ planId: null }), today: null });
      expect(root.querySelector<HTMLButtonElement>('.action-primary')?.disabled).toBeTrue();
      component.run('start');
      expect(emit).not.toHaveBeenCalled();

      const busy = render({ activePlan: plan(), today: null, starting: true });
      const button = busy.querySelector<HTMLButtonElement>('.action-primary');
      expect(button?.disabled).toBeTrue();
      expect(button?.textContent).toContain('Starting…');
    });

    it('starts the plan day on a habit day that has one, and never opens the manual log', () => {
      const emit = spyOn(component.logManually, 'emit');
      const startPlan = spyOn(component.startPlan, 'emit');
      const root = render({ today: today({ kind: 'STRENGTH', source: 'HABIT', planDayId: 'd-strength' }) });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(startPlan).toHaveBeenCalledOnceWith({ plan: plan(), planDayId: 'd-strength' });
      expect(emit).not.toHaveBeenCalled();
    });

    it('starts a plan day chosen in the habit start through the same start event', () => {
      const startPlan = spyOn(component.startPlan, 'emit');
      const root = render({ today: today({ kind: 'CARDIO', source: 'HABIT', planDayId: null }) });

      root.querySelector<HTMLButtonElement>('app-habit-day-start .more')?.click();
      fixture.detectChanges();
      root.querySelector<HTMLButtonElement>('app-habit-day-start .plan-row button')?.click();

      expect(startPlan).toHaveBeenCalledOnceWith({ plan: plan(), planDayId: 'd-strength' });
    });

    it('asks for a manual log with the kind when a sport is logged afterwards', () => {
      const emit = spyOn(component.logManually, 'emit');
      const root = render({ today: today({ kind: 'SPORT', label: 'Badminton', planDayId: 'd-sport' }) });

      root.querySelector<HTMLButtonElement>('.action-secondary')?.click();

      expect(emit).toHaveBeenCalledOnceWith('SPORT');
    });

    it('browses plans from the links and from the no-plan button', () => {
      const emit = spyOn(component.browsePlans, 'emit');
      const kinds: TodayInsight[] = [today(), today({ kind: 'REST', planDayId: null })];
      for (const insight of kinds) {
        render({ today: insight }).querySelector<HTMLAnchorElement>('a.action-secondary')?.click();
      }
      render({ activePlan: null, today: null }).querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledTimes(3);
    });

    it('does not follow the fallback href of a link', () => {
      const root = render({ today: today() });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });

      root.querySelector('a.action-secondary')?.dispatchEvent(event);

      expect(event.defaultPrevented).toBeTrue();
    });

    it('opens the running session with Continue', () => {
      const emit = spyOn(component.openSession, 'emit');
      const root = render({
        today: today({ source: 'IN_PROGRESS' }),
        todayDay: dayEntry({
          source: 'IN_PROGRESS',
          sessions: [
            { sessionId: 's-run', kind: 'STRENGTH', label: 'Strength', sportActivity: null, status: 'IN_PROGRESS', minutes: null, distanceKm: null, planDayId: null }
          ]
        })
      });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ sessionId: 's-run', status: 'IN_PROGRESS' });
    });

    it('opens the longest finished session with See the session', () => {
      const emit = spyOn(component.openSession, 'emit');
      const finished = (sessionId: string, minutes: number) => ({
        sessionId,
        kind: 'STRENGTH' as const,
        label: 'Strength',
        sportActivity: null,
        status: 'COMPLETED',
        minutes,
        distanceKm: null,
        planDayId: null
      });
      const root = render({
        today: today({ source: 'DONE' }),
        todayDay: dayEntry({ sessions: [finished('short', 10), finished('long', 50)] })
      });

      root.querySelector<HTMLAnchorElement>('a.action-secondary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ sessionId: 'long', status: 'COMPLETED' });
    });

    it('opens without a session id when the insight names none', () => {
      const emit = spyOn(component.openSession, 'emit');
      const root = render({ today: today({ source: 'IN_PROGRESS' }), todayDay: null });

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(emit).toHaveBeenCalledOnceWith({ sessionId: null, status: 'IN_PROGRESS' });
    });

    it('emits the exercise when a move row is pressed', () => {
      const emit = spyOn(component.startExercise, 'emit');
      const active = plan();
      const root = render({ activePlan: active, today: today() });

      root.querySelector<HTMLButtonElement>('.move')?.click();

      expect(emit).toHaveBeenCalledOnceWith(active.days![0].exercises[1]);
    });

    it('forwards the plan a template activates', () => {
      const emit = spyOn(component.templateActivated, 'emit');
      render({ activePlan: null, today: null });
      const activated = plan();

      fixture.debugElement.query(By.directive(PlanTemplatesComponent)).componentInstance.planActivated.emit(activated);

      expect(emit).toHaveBeenCalledWith(activated);
    });
  });

  describe('accessibility', () => {
    const kinds: Array<[DayKind, string]> = [
      ['STRENGTH', "Today's workout, Strength"],
      ['CARDIO', "Today's workout, Cardio"],
      ['MOBILITY', "Today's workout, Mobility"],
      ['SPORT', "Today's workout, Sport"]
    ];

    for (const [kind, label] of kinds) {
      it(`names the ${kind} card`, () => {
        const root = render({ today: today({ kind, planDayId: 'd-strength' }) });

        expect(root.querySelector('.today-card')?.getAttribute('aria-label')).toBe(label);
      });
    }

    it('uses real buttons and links, and hides the decorative glyph', () => {
      const root = render({ today: today() });

      expect(root.querySelector('.action-primary')?.tagName).toBe('BUTTON');
      expect(root.querySelector('.action-primary')?.getAttribute('type')).toBe('button');
      expect(root.querySelector('a.action-secondary')?.tagName).toBe('A');
      expect(root.querySelector('.kind-tile')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('a rest day with a next session in the plan', () => {
    const thursday = () => ({ ...planDay('d-thu', 'CARDIO', [move(1, 'Treadmill run')], 'Treadmill run'), dayOfWeek: 4 });

    it('offers the next planned session today as a quiet choice, and names it once in the line above', () => {
      const root = render({
        activePlan: plan({ days: [thursday()] }),
        today: today({ kind: 'REST', label: 'Rest', planDayId: null, title: null, estimatedMinutes: null, moves: null }),
        nextTraining: next()
      });

      expect(text(root, '.action-primary')).toBe("Do Thursday's session today");
      expect(root.querySelector('.action-primary')?.classList).toContain('quiet');
      expect(root.querySelector('.actions')?.classList).toContain('equal');
      expect(root.querySelector('.action-primary svg')).toBeNull();
      expect(text(root, 'a.action-secondary')).toBe('Train something else');
      expect(chips(root)).toEqual(['Next: Thursday', 'Treadmill run', '35 min']);
    });

    it('starts the plan day that falls on the weekday of the next training', () => {
      const active = plan({ days: [thursday(), { ...planDay('d-fri', 'STRENGTH', [move(1, 'Squat')]), dayOfWeek: 5 }] });
      const root = render({
        activePlan: active,
        today: today({ kind: 'REST', label: 'Rest', planDayId: null, title: null, estimatedMinutes: null, moves: null }),
        nextTraining: next()
      });
      const started: Array<{ planDayId: string | null }> = [];
      component.startPlan.subscribe((event) => started.push(event));

      root.querySelector<HTMLButtonElement>('.action-primary')?.click();

      expect(started.length).toBe(1);
      expect(started[0].planDayId).toBe('d-thu');
    });

    it('names the weekday of the next training in the label', () => {
      const friday = { ...planDay('d-fri', 'STRENGTH', [move(1, 'Squat')], 'Legs'), dayOfWeek: 5 };
      const root = render({
        activePlan: plan({ days: [friday] }),
        today: today({ kind: 'REST', label: 'Rest', planDayId: null }),
        nextTraining: next({ date: '2026-10-02', kind: 'STRENGTH', label: 'Strength', title: 'Legs' })
      });

      expect(text(root, '.action-primary')).toBe("Do Friday's session today");
      expect(chips(root)).toEqual(['Next: Friday', 'Legs', '35 min']);
    });

    it('stays as it was when the plan has no day on that weekday, or no days', () => {
      for (const days of [[{ ...planDay('d-mon', 'STRENGTH', []), dayOfWeek: 1 }], []]) {
        const root = render({
          activePlan: plan({ days }),
          today: today({ kind: 'REST', label: 'Rest', planDayId: null }),
          nextTraining: next()
        });

        expect(root.querySelector('.action-primary')).toBeNull();
        expect(text(root, 'a.action-secondary')).toBe('Train today');
      }
    });

    it('stays as it was without a plan or without a next training', () => {
      const withoutPlan = render({ activePlan: null, today: today({ kind: 'REST', label: 'Rest', planDayId: null }), nextTraining: next() });
      expect(withoutPlan.querySelector('.action-primary')).toBeNull();

      const withoutNext = render({
        activePlan: plan({ days: [thursday()] }),
        today: today({ kind: 'REST', label: 'Rest', planDayId: null }),
        nextTraining: null
      });
      expect(withoutNext.querySelector('.action-primary')).toBeNull();
      expect(text(withoutNext, 'a.action-secondary')).toBe('Train today');
    });

    it('disables the start while the plan is starting', () => {
      const root = render({
        activePlan: plan({ days: [thursday()] }),
        today: today({ kind: 'REST', label: 'Rest', planDayId: null }),
        nextTraining: next(),
        starting: true
      });

      expect(root.querySelector<HTMLButtonElement>('.action-primary')?.disabled).toBeTrue();
      expect(text(root, '.action-primary')).toBe('Starting…');
    });
  });
});
