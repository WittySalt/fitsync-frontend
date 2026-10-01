import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { AccountDataService } from '../../../core/account-data.service';
import { AnalyticsApiService } from '../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayInsight, MuscleGroupCode, NextTraining, TodayInsight, UserGoal, WeeklyTrainingInsight, WorkoutPlan, WorkoutSession, WorkoutSessionDetail } from '../../../core/fitsync.models';
import { BRIEF_NOW } from './brief-time';
import { CoachBriefComponent } from './coach-brief.component';
import { analyticsStub, monthInsight, septemberInsight } from './month/month-fixtures.spec';
import { FIRST_SESSION_TEMPLATES } from './no-plan/first-sessions';

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
  volume: { thisWeekKg: 3846, previousWeekKg: 1716, weekBeforePreviousKg: 1716, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 1 },
  days: null,
  today: null,
  nextTraining: null
};

describe('CoachBriefComponent', () => {
  let fixture: ComponentFixture<CoachBriefComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let accountData: jasmine.SpyObj<AccountDataService>;
  let analytics: jasmine.SpyObj<AnalyticsApiService>;
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
      'getMonthlyTrainingInsight',
      'startWorkoutPlan'
    ]);
    dataService.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
    analytics = analyticsStub();
    accountData = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accountData.listBodyMetrics.and.returnValue(of([]));
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
        { provide: AccountDataService, useValue: accountData },
        { provide: AnalyticsApiService, useValue: analytics },
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

  describe('week and month switch', () => {
    function tab(label: string): HTMLButtonElement {
      const found = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.switch-tab')).find(
        (button) => button.textContent?.trim() === label
      );
      if (!found) {
        throw new Error(`No ${label} button`);
      }
      return found;
    }

    function press(label: string): void {
      tab(label).click();
      fixture.detectChanges();
    }

    it('shows the week title and a switch with Week pressed', () => {
      setup();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.week-title')?.textContent?.trim()).toBe('This week');
      expect(element.querySelectorAll('.switch-tab').length).toBe(2);
      expect(tab('Week').getAttribute('aria-pressed')).toBe('true');
      expect(tab('Month').getAttribute('aria-pressed')).toBe('false');
    });

    it('opens in the week view, without asking for a month', () => {
      setup();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.week-strip')).not.toBeNull();
      expect(element.querySelector('app-coach-noticed')).not.toBeNull();
      expect(element.querySelector('app-muscle-wheel')).not.toBeNull();
      expect(element.querySelector('app-month-calendar')).toBeNull();
      expect(dataService.getMonthlyTrainingInsight).not.toHaveBeenCalled();
    });

    it('replaces the strip, the observations and the wheel with the month view', () => {
      setup();
      press('Month');
      const element = fixture.nativeElement as HTMLElement;

      expect(dataService.getMonthlyTrainingInsight).toHaveBeenCalledOnceWith('2026-09', 'Asia/Singapore');
      expect(tab('Month').getAttribute('aria-pressed')).toBe('true');
      expect(tab('Week').getAttribute('aria-pressed')).toBe('false');
      expect(element.querySelector('.week-title')).toBeNull();
      expect(element.querySelector('app-month-nav .title')?.textContent?.trim()).toBe('September 2026');
      expect(element.querySelectorAll('app-month-calendar button.cell').length).toBe(30);
      expect(element.querySelector('.week-strip')).toBeNull();
      expect(element.querySelector('app-coach-noticed')).toBeNull();
      expect(element.querySelector('app-muscle-wheel')).toBeNull();
      expect(element.querySelector('.brief-panel app-month-panel .head .title')?.textContent?.trim()).toBe('September so far');
      expect(element.querySelector('.brief-panel .panel-title')).toBeNull();
    });

    it('gives the month panel the weekly goal, so it can count the weeks on goal, and asks for the badges once', () => {
      dataService.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight()));
      setup();
      press('Month');
      press('Week');
      press('Month');
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('[data-figure="weeks"]')?.getAttribute('aria-label')).toBe('3 of 3 full weeks on goal');
      expect(analytics.getAchievements).toHaveBeenCalledTimes(1);
    });

    it('keeps the headline and everything below the row while the month shows', () => {
      setup();
      press('Month');
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.headline')?.textContent).toContain('Four for four!');
      expect(element.querySelector('.ask-box')).not.toBeNull();
    });

    it('brings the strip, the observations and the wheel back when it switches to the week', () => {
      setup();
      press('Month');
      press('Week');
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.week-title')?.textContent?.trim()).toBe('This week');
      expect(element.querySelectorAll('.day-col').length).toBe(7);
      expect(element.querySelector('app-coach-noticed')).not.toBeNull();
      expect(element.querySelector('app-muscle-wheel')).not.toBeNull();
      expect(element.querySelector('app-month-calendar')).toBeNull();
      expect(element.querySelector('app-month-panel')).toBeNull();
    });

    it('loads the month again each time it is opened', () => {
      setup();
      press('Month');
      press('Week');
      press('Month');
      expect(dataService.getMonthlyTrainingInsight).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the pressed view is already shown', () => {
      setup();
      press('Week');
      expect(dataService.getMonthlyTrainingInsight).not.toHaveBeenCalled();
      press('Month');
      press('Month');
      expect(dataService.getMonthlyTrainingInsight).toHaveBeenCalledTimes(1);
    });

    it('does not remember the month view when the brief is created again', () => {
      setup();
      press('Month');
      fixture.destroy();

      fixture = TestBed.createComponent(CoachBriefComponent);
      fixture.componentRef.setInput('firstName', 'Ruixian');
      fixture.componentRef.setInput('timezone', 'Asia/Singapore');
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.week-title')).not.toBeNull();
      expect(element.querySelector('app-month-calendar')).toBeNull();
      expect(tab('Week').getAttribute('aria-pressed')).toBe('true');
    });

    it('keeps the switch usable when the month fails to load', () => {
      dataService.getMonthlyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
      setup();
      press('Month');
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('app-month-calendar .state-text')?.textContent?.trim()).toBe('This month could not be loaded.');
      press('Week');
      expect(element.querySelectorAll('.day-col').length).toBe(7);
    });
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
    expect(element.querySelector('.headline')?.textContent).toContain('Four for four!');
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
  it('renders "Four for four!" for 4 completed sessions against a target of 4', () => {
    setup();
    expect(pageText()).toContain('Four for four!');
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

  it('leaves completedToday false when today has not been trained yet', () => {
    setup();
    expect(fixture.componentInstance.completedToday()).toBe(false);
  });

  it('sets completedToday when today\'s week-strip entry shows real minutes', () => {
    dataService.getWorkoutSessionsInRange.and.returnValue(
      of([
        ...fourCompletedSessions,
        session({ sessionId: 's5', workoutType: 'STRENGTH', durationMinutes: 40, completedAt: '2026-09-27T00:05:00Z', startedAt: '2026-09-26T23:00:00Z' })
      ])
    );
    setup();
    expect(fixture.componentInstance.completedToday()).toBe(true);
  });

  it('reads trainedYesterday from the week strip when yesterday falls inside the current week', () => {
    setup();
    // NOW is Sunday; Saturday (yesterday) carries session s4 in fourCompletedSessions.
    expect(fixture.componentInstance.trainedYesterday()).toBe(true);
  });

  it('falls back to the weekly insight for trainedYesterday when yesterday is outside the current week', () => {
    TestBed.overrideProvider(BRIEF_NOW, { useValue: () => new Date('2026-09-28T00:10:00Z') }); // Monday 08:10 SGT
    dataService.getWeeklyTrainingInsight.and.returnValue(
      of({
        ...weeklyInsight,
        muscleGroups: weeklyInsight.muscleGroups.map((entry) => ({ ...entry, trainedYesterday: entry.muscleGroup === 'CORE' }))
      })
    );
    setup();
    expect(fixture.componentInstance.trainedYesterday()).toBe(true);
  });

  it('computes daysSinceLastSession from the latest lastTrainedOn across muscle groups', () => {
    setup();
    // The latest lastTrainedOn in weeklyInsight is 2026-09-26; NOW is 2026-09-27 in Singapore.
    expect(fixture.componentInstance.daysSinceLastSession()).toBe(1);
  });

  it('leaves daysSinceLastSession null when the weekly insight has not loaded', () => {
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
    setup();
    expect(fixture.componentInstance.daysSinceLastSession()).toBeNull();
  });

  function pageText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  describe('the line of the first days', () => {
    const STORAGE_KEY = 'fitsync.month-line.dismissed';

    function setupOn(now: Date): void {
      TestBed.overrideProvider(BRIEF_NOW, { useValue: () => now });
      dataService.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight()));
      setup();
    }

    function tab(label: string): HTMLButtonElement | undefined {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.switch-tab')).find(
        (button) => button.textContent?.trim() === label
      );
    }

    function seeTheMonth(): void {
      const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-month-line .link')).find(
        (button) => button.textContent?.trim() === 'See the month'
      );
      link?.click();
      fixture.detectChanges();
    }

    const lineOf = (): Element | null => (fixture.nativeElement as HTMLElement).querySelector('app-month-line .line');

    beforeEach(() => localStorage.removeItem(STORAGE_KEY));
    afterEach(() => localStorage.removeItem(STORAGE_KEY));

    it('offers last month on the second of the month and opens the month view on it', () => {
      setupOn(new Date('2026-10-02T02:00:00Z'));
      expect(dataService.getMonthlyTrainingInsight).toHaveBeenCalledOnceWith('2026-09', 'Asia/Singapore');
      expect(lineOf()?.querySelector('.text')?.textContent?.trim()).toBe('September is complete.');

      seeTheMonth();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('app-month-nav .title')?.textContent?.trim()).toBe('September 2026');
      expect(lineOf()).toBeNull();
      expect(dataService.getMonthlyTrainingInsight).toHaveBeenCalledTimes(2);
      expect(dataService.getMonthlyTrainingInsight.calls.mostRecent().args).toEqual(['2026-09', 'Asia/Singapore']);
    });

    it('does not bring the line back when the week view returns', () => {
      setupOn(new Date('2026-10-02T02:00:00Z'));
      seeTheMonth();
      tab('Week')?.click();
      fixture.detectChanges();
      expect(lineOf()).toBeNull();
    });

    it('shows no line while the month view is open', () => {
      setupOn(new Date('2026-10-02T02:00:00Z'));
      tab('Month')?.click();
      fixture.detectChanges();
      expect(lineOf()).toBeNull();
    });
  });
});

describe('CoachBriefComponent - day-kinds fields', () => {
  let fixture: ComponentFixture<CoachBriefComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let coachStore: jasmine.SpyObj<CoachStore>;

  const WEEK_KEYS = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

  function dayInsight(date: string, overrides: Partial<DayInsight> = {}): DayInsight {
    return {
      date,
      dayOfWeek: WEEK_KEYS.indexOf(date) + 1,
      kind: 'OPEN',
      label: '',
      source: 'NONE',
      minutes: null,
      sessions: [],
      planned: null,
      ...overrides
    };
  }

  function setup(insight: WeeklyTrainingInsight, target: number | null): void {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CoachBriefComponent);
    fixture.componentRef.setInput('firstName', 'Ruixian');
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
    fixture.componentRef.setInput('caloriesTarget', null);
    dataService.getGoals.and.returnValue(
      of(target != null ? [{ goalId: 'goal-1', goalType: 'WORKOUT_FREQUENCY', targetValue: target, targetUnit: 'sessions/week', targetDate: '2026-09-27', status: 'ACTIVE', notes: null }] : [])
    );
    dataService.getWeeklyTrainingInsight.and.returnValue(of(insight));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutSessionsInRange',
      'getGoals',
      'getActivePlan',
      'getWeeklyTrainingInsight',
      'startWorkoutPlan',
      'getOnboardingSeed'
    ]);
    dataService.getOnboardingSeed.and.returnValue(of({ value: {}, hasExistingBodyBaseline: false, hasExistingTrainingBaseline: false, hasExistingNutritionBaseline: false }));
    dataService.getWorkoutSessionsInRange.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
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

  function baseInsight(days: DayInsight[] | null, today: TodayInsight | null, nextTraining: NextTraining | null = null): WeeklyTrainingInsight {
    return {
      timezone: 'Asia/Singapore',
      referenceDate: '2026-09-27',
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 0,
      previousWeekTotalMinutes: 0,
      muscleGroups: [],
      volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
      days,
      today,
      nextTraining
    };
  }

  it('keeps every existing behaviour when the insight has no day-kinds fields', () => {
    setup(baseInsight(null, null, null), 4);

    expect(fixture.componentInstance.showTodayRow()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-today-row')).toBeNull();
  });

  it('draws the row for today and the week strip from the insight once it carries day-kinds fields', () => {
    const days = WEEK_KEYS.map((key) => dayInsight(key, key === '2026-09-27' ? { kind: 'REST', label: 'Rest', source: 'PLAN' } : {}));
    const today: TodayInsight = {
      date: '2026-09-27',
      kind: 'REST',
      label: 'Rest',
      source: 'PLAN',
      planDayId: null,
      title: null,
      estimatedMinutes: null,
      moves: null,
      lastOfKind: null,
      carriedOver: []
    };
    setup(baseInsight(days, today), 6);

    expect(fixture.componentInstance.showTodayRow()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-today-row')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.next-session-row')).toBeNull();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Rest today');
    const captions = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.day-caption')).map((el) => el.textContent?.trim());
    expect(captions[6]).toBe('rest');
  });

  it('passes restToday through to the headline for a rest day that has not met its goal', () => {
    const days = WEEK_KEYS.map((key) => dayInsight(key, key === '2026-09-27' ? { kind: 'REST', label: 'Rest', source: 'PLAN' } : {}));
    const today: TodayInsight = {
      date: '2026-09-27',
      kind: 'REST',
      label: 'Rest',
      source: 'PLAN',
      planDayId: null,
      title: null,
      estimatedMinutes: null,
      moves: null,
      lastOfKind: null,
      carriedOver: []
    };
    setup(baseInsight(days, today), 6);

    expect(fixture.componentInstance.headline().lines[0]).toBe('Rest day.');
  });

  describe('without a plan', () => {
    const openToday: TodayInsight = {
      date: '2026-09-27',
      kind: 'OPEN',
      label: '',
      source: 'NONE',
      planDayId: null,
      title: null,
      estimatedMinutes: null,
      moves: null,
      lastOfKind: null,
      carriedOver: []
    };

    function openInsight(): WeeklyTrainingInsight {
      return baseInsight(WEEK_KEYS.map((key) => dayInsight(key)), openToday);
    }

    it('offers three first sessions in place of the row that said to pick a plan', () => {
      setup(openInsight(), null);

      const element = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.showFirstSessions()).toBe(true);
      expect(element.querySelector('app-first-sessions')).toBeTruthy();
      expect(element.querySelectorAll('app-first-sessions li.card').length).toBe(3);
      expect(element.querySelector('app-today-row')).toBeNull();
      expect(element.textContent).not.toContain('Pick a plan');
    });

    it('does not offer them to a person with a plan', () => {
      dataService.getActivePlan.and.returnValue(of(activePlan));
      setup(openInsight(), null);

      const element = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.showFirstSessions()).toBe(false);
      expect(element.querySelector('app-first-sessions')).toBeNull();
    });

    it('does not offer them when today is a rest day', () => {
      setup(baseInsight(WEEK_KEYS.map((key) => dayInsight(key)), { ...openToday, kind: 'REST', label: 'Rest', source: 'PLAN' }), null);
      expect(fixture.nativeElement.querySelector('app-first-sessions')).toBeNull();
    });

    it('keeps the old row when there are too few templates to offer', () => {
      TestBed.overrideProvider(FIRST_SESSION_TEMPLATES, { useValue: [] });
      setup(openInsight(), null);

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('app-first-sessions')).toBeNull();
      expect(element.querySelector('app-today-row')).toBeTruthy();
      expect(element.textContent).toContain('Pick a plan');
      expect(element.textContent).toContain('Browse plans');
    });

    it('reads the plan and the day again once a first session has started', () => {
      setup(openInsight(), null);
      dataService.getWeeklyTrainingInsight.calls.reset();
      dataService.getActivePlan.calls.reset();

      fixture.componentInstance.onPlanStarted();

      expect(dataService.getWeeklyTrainingInsight).toHaveBeenCalledOnceWith('Asia/Singapore');
      expect(dataService.getActivePlan).toHaveBeenCalledTimes(1);
    });
  });

});
