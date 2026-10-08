import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../../../core/analytics.models';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight, NutritionSummary, WorkoutSession, WorkoutSessionDetail } from '../../../../core/fitsync.models';
import { analyticsStub, monthInsight, septemberInsight, weighIn } from './month-fixtures.spec';
import { MonthPanelComponent } from './month-panel.component';
import { MonthViewState } from './month-view.state';
import { UserTimezoneService } from '../../../../core/user-timezone.service';

function badge(code: string, unlockedAt: string | null): AnalyticsAchievement {
  return { code, title: code, unlocked: unlockedAt !== null, unlockedAt, progress: unlockedAt ? 1 : 0 };
}

function foodSummary(overrides: Partial<NutritionSummary> = {}): NutritionSummary {
  return {
    totalCalories: 2037,
    targetCalories: 2100,
    totalProteinGrams: 158,
    targetProteinGrams: null,
    totalCarbsGrams: 0,
    targetCarbsGrams: null,
    totalFatGrams: 0,
    targetFatGrams: null,
    mealCount: 5,
    totalFiberGrams: null,
    totalSugarGrams: null,
    totalSodiumMg: null,
    fiberTargetGrams: null,
    sugarLimitGrams: null,
    sodiumLimitMg: null,
    fiberTargetMet: null,
    sugarWithinLimit: null,
    sodiumWithinLimit: null,
    ...overrides
  };
}

function strengthSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Upper body',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-09-25T10:30:00Z',
    durationMinutes: 50,
    caloriesBurned: null,
    completedAt: '2026-09-25T11:20:00Z',
    exerciseCount: 4,
    kind: 'STRENGTH',
    ...overrides
  };
}

describe('MonthPanelComponent', () => {
  let fixture: ComponentFixture<MonthPanelComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let accounts: jasmine.SpyObj<AccountDataService>;
  let analytics: jasmine.SpyObj<AnalyticsApiService>;

  function open(target: number | null = 4): void {
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    TestBed.inject(MonthViewState).open('2026-09-27');
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.componentRef.setInput('weeklyTarget', target);
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function text(selector: string): string[] {
    return Array.from(root().querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function figures(): string[] {
    return Array.from(root().querySelectorAll('.figure')).map((figure) => figure.getAttribute('aria-label') ?? '');
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getMonthlyTrainingInsight',
      'getWorkoutSessionsInRange',
      'getSession',
      'getDailyNutritionSummary'
    ]);
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight()));
    data.getWorkoutSessionsInRange.and.returnValue(of([]));
    data.getSession.and.returnValue(of(null));
    data.getDailyNutritionSummary.and.returnValue(of(foodSummary({ mealCount: 0, totalCalories: 0 })));
    accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    analytics = analyticsStub([badge('A', '2026-09-02T03:00:00Z'), badge('B', '2026-08-20T03:00:00Z'), badge('C', null)]);
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analytics }
      ]
    });
  });

  it('shows the month so far, the compared month and the six figures', () => {
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(text('.head .since')).toEqual(['Arrows compare with August.']);
    expect(figures()).toEqual([
      '17 sessions, 15 last month',
      '13 h 35 min trained, 12 h 15 min last month',
      '3 of 3 full weeks on goal',
      '6 personal records',
      '1 badge earned',
      'Longest streak 3 days'
    ]);
  });

  it('shows the arrows of the figures that changed and none for the equal ones', () => {
    open();
    const arrows = Array.from(root().querySelectorAll('.figure')).map((figure) => figure.querySelector('.compare')?.textContent?.trim() ?? '');
    expect(arrows).toEqual(['2', '1 h 20 min', '', '', '', '']);
    expect(root().querySelectorAll('.compare.up').length).toBe(2);
    expect(root().querySelectorAll('.compare[aria-hidden="true"] svg').length).toBe(2);
  });

  it('shows the figures in the same grid with the first month and says since when', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ firstSessionDate: '2026-09-13', previousTotals: null })));
    open();
    expect(text('.head .since')).toEqual(['Since you joined on 13 September.']);
    expect(root().querySelectorAll('.compare').length).toBe(0);
  });

  it('shows nothing under the title when there is neither a first month nor a month before', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ firstSessionDate: null, previousTotals: null })));
    open();
    expect(text('.head .since')).toEqual([]);
  });

  it('draws the radar with a labelled axis for each group trained and the bars of the weeks', () => {
    open();
    const radar = root().querySelector('app-month-radar svg');
    expect(radar?.getAttribute('role')).toBe('group');
    expect(radar?.getAttribute('aria-label')).toBe('Sessions by muscle group: Chest 8, Back 8, Core 13, Legs 8, Cardio 5');
    expect(Array.from(root().querySelectorAll('app-month-radar [data-group]')).map((node) => node.getAttribute('data-group'))).toEqual([
      'CHEST',
      'CORE',
      'LEGS',
      'BACK',
      'CARDIO'
    ]);
    expect(text('app-month-radar .label .name')).toEqual(['Chest', 'Core', 'Legs', 'Back', 'Cardio']);
    expect(text('app-month-radar .label .count')).toEqual(['8', '13', '8', '8', '5']);

    const bars = root().querySelector('app-month-week-bars svg');
    expect(bars?.getAttribute('role')).toBe('img');
    expect(bars?.getAttribute('aria-label')).toContain('week of 7 September, 4 sessions');
    expect(text('app-month-week-bars .week .count')).toEqual(['3', '4', '4', '4', '2']);
    expect(text('app-month-week-bars .week .day')).toEqual(['1', '7', '14', '21', '28']);
    expect(root().querySelectorAll('app-month-week-bars .week.open').length).toBe(1);
    expect(text('.chart-title')).toEqual(['By muscle group', 'By week']);
  });

  it('draws bars in place of the radar for two groups', () => {
    data.getMonthlyTrainingInsight.and.returnValue(
      of(septemberInsight({ muscles: [{ group: 'CHEST', label: 'Chest', sessions: 8 }, { group: 'BACK', label: 'Back', sessions: 4 }] }))
    );
    open();
    expect(root().querySelectorAll('app-month-radar polygon').length).toBe(0);
    expect(root().querySelectorAll('app-month-radar rect.bar').length).toBe(2);
  });

  it('says what the coach noticed, and nothing about what is missing', () => {
    open();
    expect(text('.noticed .title')).toEqual(['What your coach noticed this month']);
    expect(text('.noticed .headline')).toEqual([
      'Every full week reached four sessions.',
      'Six personal records this month.',
      'Three days in a row was your longest run.'
    ]);
  });

  it('takes the weight from the weigh-ins inside the month', () => {
    accounts.listBodyMetrics.and.returnValue(
      of([
        { ...weighIn('2026-09-26T02:00:00Z'), weightKg: 71.1 },
        { ...weighIn('2026-08-30T20:00:00Z'), weightKg: 99 },
        { ...weighIn('2026-09-02T02:00:00Z'), weightKg: 72.5 }
      ])
    );
    open();
    // The weigh-in of 99 kg falls on 31 August in Singapore, so it is not part of September.
    expect(text('.noticed .headline')[2]).toBe('Your weight is down 1.4 kg.');
    expect(text('.noticed .note')[2]).toBe('From 72.5 to 71.1 kg this month.');
    expect(accounts.listBodyMetrics).toHaveBeenCalledTimes(1);
  });

  describe('a month without a session', () => {
    function openEmpty(reference: string, month = reference.slice(0, 7), first: string | null = '2026-08-03'): void {
      data.getMonthlyTrainingInsight.and.returnValue(
        of(
          monthInsight({
            month,
            referenceDate: reference,
            firstSessionDate: first,
            days: [],
            weeks: [],
            muscles: [],
            totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 },
            previousTotals: { sessions: 3, minutes: 100, records: 0, longestStreakDays: 1 }
          })
        )
      );
      TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
      TestBed.inject(MonthViewState).open(reference);
      fixture = TestBed.createComponent(MonthPanelComponent);
      fixture.detectChanges();
    }

    it('shows the title and one calm line, and no figure, chart or observation', () => {
      openEmpty('2026-10-01');
      expect(text('.head .title')).toEqual(['October so far']);
      expect(text('.head .since')).toEqual(['October is just beginning.']);
      expect(root().querySelector('.figure')).toBeNull();
      expect(root().querySelector('app-month-figures')).toBeNull();
      expect(root().querySelector('.charts')).toBeNull();
      expect(root().querySelector('app-month-noticed')).toBeNull();
    });

    it('says nothing is logged yet after the first week of the month', () => {
      openEmpty('2026-09-27');
      expect(text('.head .since')).toEqual(['Nothing logged in September yet.']);
    });

    it('says nothing is logged in a month that has passed, and never offers the arrows line', () => {
      openEmpty('2026-10-01', '2026-08', '2026-07-03');
      expect(text('.head .since')).toEqual(['Nothing logged in August.']);
    });

    it('keeps the line about the month of the first session next to the calm one', () => {
      openEmpty('2026-09-27', '2026-09', '2026-09-13');
      expect(text('.head .since')).toEqual(['Since you joined on 13 September.', 'Nothing logged in September yet.']);
    });

    it('still opens the block of a picked date, since a weigh-in or a meal can fall on any day', () => {
      data.getDailyNutritionSummary.and.returnValue(of(foodSummary()));
      openEmpty('2026-09-27');
      TestBed.inject(MonthViewState).selectDay('2026-09-20');
      fixture.detectChanges();
      expect(text('.head .since')).toEqual(['Nothing logged in September yet.']);
      expect(text('app-month-day .headline')).toEqual(['2,037 kcal and 158 g of protein.']);
      // The picked day's key itself, so no zone can move the summary to a neighbouring day.
      expect(data.getDailyNutritionSummary).toHaveBeenCalledWith('2026-09-20');
    });
  });

  it('keeps the charts out when there is nothing to chart but leaves the observations', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ muscles: [], weeks: [] })));
    open();
    expect(root().querySelector('.charts')).toBeNull();
    expect(text('.noticed .headline')[0]).toBe('Six personal records this month.');
  });

  it('shows blocks in the shape of the figures and the charts while the month loads', () => {
    data.getMonthlyTrainingInsight.and.returnValue(new Subject<MonthlyTrainingInsight>() as Observable<MonthlyTrainingInsight>);
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(root().querySelector('.loading')?.getAttribute('aria-busy')).toBe('true');
    expect(root().querySelectorAll('.block-figure').length).toBe(6);
    expect(root().querySelectorAll('.block-charts').length).toBe(1);
    expect(root().querySelector('.figure')).toBeNull();
  });

  it('keeps only the title when the month cannot be loaded', () => {
    data.getMonthlyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(root().querySelector('.loading')).toBeNull();
    expect(root().querySelector('.figure')).toBeNull();
    expect(root().querySelector('.charts')).toBeNull();
  });

  it('names a past month plainly', () => {
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    TestBed.inject(MonthViewState).open('2026-09-27');
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ month: '2026-08', monthStart: '2026-08-01', monthEnd: '2026-08-31', previousTotals: null })));
    TestBed.inject(MonthViewState).step(-1);
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.detectChanges();
    expect(text('.head .title')).toEqual(['August']);
  });

  describe('picking a date', () => {
    const state = (): MonthViewState => TestBed.inject(MonthViewState);

    function pick(date: string): void {
      state().selectDay(date);
      fixture.detectChanges();
    }

    beforeEach(() => {
      const days = [
        { date: '2026-09-25', kind: 'STRENGTH' as const, label: 'Strength', sessions: 1, minutes: 50, muscles: ['CHEST'], record: true },
        { date: '2026-09-21', kind: 'CARDIO' as const, label: 'Cardio', sessions: 1, minutes: 30, muscles: ['CARDIO'], record: false }
      ];
      data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ days })));
      data.getWorkoutSessionsInRange.and.returnValue(of([strengthSession()]));
      data.getSession.and.returnValue(
        of({
          ...strengthSession(),
          perceivedExertion: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
          exercises: ['Bench Press', 'Goblet Squat'].map((name, index) => ({
            exerciseLogId: String(index),
            exerciseId: String(index),
            exerciseNameSnapshot: name,
            sequence: index + 1,
            performedSets: 3,
            performedReps: 8,
            totalVolumeKg: null,
            distanceKm: null,
            durationSeconds: null,
            averageHeartRate: null,
            maxHeartRate: null,
            notes: '',
            sets: []
          }))
        } as WorkoutSessionDetail)
      );
      data.getDailyNutritionSummary.and.returnValue(of(foodSummary()));
      accounts.listBodyMetrics.and.returnValue(of([{ ...weighIn('2026-09-25T01:00:00Z'), weightKg: 71.2 }]));
    });

    it('shows the notices until a date is picked, then the date in words with three lines', () => {
      open();
      expect(root().querySelector('app-month-noticed')).not.toBeNull();
      pick('2026-09-25');
      expect(root().querySelector('app-month-noticed')).toBeNull();
      expect(text('app-month-day .title')).toEqual(['Friday 25 September']);
      expect(text('app-month-day .back')).toEqual(['Back to the month']);
      expect(text('app-month-day .headline')).toEqual(['Strength, 50 min at 18:30.', 'A record on this day.', '2,037 kcal and 158 g of protein.']);
      expect(text('app-month-day .note')).toEqual(['Bench press and goblet squat.', 'Five meals, inside the 2,100 kcal budget.']);
    });

    it('keeps the head, the six figures and the charts while a date is shown', () => {
      open();
      pick('2026-09-25');
      expect(text('.head .title')).toEqual(['September so far']);
      expect(root().querySelectorAll('.figure').length).toBe(6);
      expect(root().querySelectorAll('.charts section.chart').length).toBe(2);
    });

    it('asks for the sessions and the food once for each date picked', () => {
      open();
      pick('2026-09-25');
      pick('2026-09-21');
      pick('2026-09-25');
      expect(data.getWorkoutSessionsInRange).toHaveBeenCalledTimes(3);
      expect(data.getDailyNutritionSummary).toHaveBeenCalledTimes(3);
      fixture.detectChanges();
      expect(data.getDailyNutritionSummary).toHaveBeenCalledTimes(3);
    });

    it('goes back to the notices with the button and with the second tap on the same date', () => {
      open();
      pick('2026-09-25');
      (root().querySelector('app-month-day .back') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root().querySelector('app-month-day')).toBeNull();
      expect(root().querySelector('app-month-noticed')).not.toBeNull();
      expect(state().focusTarget()).toEqual({ kind: 'day', key: '2026-09-25' });

      pick('2026-09-25');
      pick('2026-09-25');
      expect(root().querySelector('app-month-day')).toBeNull();
    });

    it('shows skeleton rows of one height until the sessions and the food arrive', () => {
      const sessions = new Subject<WorkoutSession[]>();
      const meals = new Subject<NutritionSummary>();
      data.getWorkoutSessionsInRange.and.returnValue(sessions);
      data.getDailyNutritionSummary.and.returnValue(meals);
      open();
      pick('2026-09-25');
      expect(root().querySelectorAll('app-month-day .row.pending').length).toBe(2);
      expect(text('app-month-day .headline')).toEqual(['A record on this day.']);

      sessions.next([strengthSession()]);
      meals.next(foodSummary());
      fixture.detectChanges();
      expect(root().querySelectorAll('app-month-day .row.pending').length).toBe(0);
      expect(text('app-month-day .headline').length).toBe(3);
    });

    it('leaves out the line of a request that failed, without a message', () => {
      data.getDailyNutritionSummary.and.returnValue(throwError(() => new Error('offline')));
      open();
      pick('2026-09-25');
      expect(text('app-month-day .headline')).toEqual(['Strength, 50 min at 18:30.', 'A record on this day.', 'Weighed 71.2 kg.']);
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });

    it('shows one quiet line for a day with nothing, and does not ask for the food of a day to come', () => {
      data.getDailyNutritionSummary.and.returnValue(of(foodSummary({ mealCount: 0, totalCalories: 0 })));
      open();
      pick('2026-09-22');
      expect(text('app-month-day .quiet')).toEqual(['Nothing logged on this day.']);
      expect(data.getWorkoutSessionsInRange).not.toHaveBeenCalled();

      data.getDailyNutritionSummary.calls.reset();
      pick('2026-09-30');
      expect(text('app-month-day .quiet')).toEqual(['Still to come.']);
      expect(data.getDailyNutritionSummary).not.toHaveBeenCalled();
    });

    it('says before the first session for a date before it', () => {
      data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ firstSessionDate: '2026-09-13' })));
      data.getDailyNutritionSummary.and.returnValue(of(foodSummary({ mealCount: 0, totalCalories: 0 })));
      open();
      pick('2026-09-05');
      expect(text('app-month-day .quiet')).toEqual(['Before your first session.']);
    });
  });

  describe('picking a muscle group', () => {
    const state = (): MonthViewState => TestBed.inject(MonthViewState);
    const chest = (date: string, kind: 'STRENGTH' | 'CARDIO' = 'STRENGTH', record = false) => ({
      date,
      kind,
      label: kind,
      sessions: 1,
      minutes: 45,
      muscles: ['CHEST'],
      record
    });

    beforeEach(() => {
      data.getMonthlyTrainingInsight.and.returnValue(
        of(septemberInsight({ days: [chest('2026-09-03', 'STRENGTH', true), chest('2026-09-07'), chest('2026-09-10'), chest('2026-09-14')] }))
      );
    });

    it('turns the radar title into the group and its sessions, and back', () => {
      open();
      expect(text('#month-chart-muscles')).toEqual(['By muscle group']);
      state().selectMuscle('CHEST');
      fixture.detectChanges();
      expect(text('#month-chart-muscles')).toEqual(['Chest, 8 sessions']);
      state().selectMuscle('CHEST');
      fixture.detectChanges();
      expect(text('#month-chart-muscles')).toEqual(['By muscle group']);
    });

    it('shows the group in place of the notices, with up to three lines', () => {
      open();
      state().selectMuscle('CHEST');
      fixture.detectChanges();
      expect(root().querySelector('app-month-noticed')).toBeNull();
      expect(text('app-month-muscle .title')).toEqual(['Chest this month']);
      expect(text('app-month-muscle .back')).toEqual(['Show all muscles']);
      expect(text('app-month-muscle .headline')).toEqual(['Eight sessions, all on strength days.', 'Four days apart on average.', 'One of these days set a record.']);
    });

    it('goes back to the notices with the button, and the panel takes the focus request', () => {
      open();
      state().selectMuscle('CHEST');
      fixture.detectChanges();
      (root().querySelector('app-month-muscle .back') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root().querySelector('app-month-muscle')).toBeNull();
      expect(root().querySelector('app-month-noticed')).not.toBeNull();
      expect(state().focusTarget()).toBeNull();
    });

    it('presses a label of the radar to pick the group, and shows it as pressed', () => {
      open();
      const label = root().querySelector('[data-group="CHEST"]') as SVGGElement;
      expect(label.getAttribute('aria-pressed')).toBe('false');
      label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(state().selectedMuscle()).toBe('CHEST');
      expect((root().querySelector('[data-group="CHEST"]') as SVGGElement).getAttribute('aria-pressed')).toBe('true');
    });

    it('lets a picked date and a picked group replace each other', () => {
      open();
      state().selectDay('2026-09-03');
      fixture.detectChanges();
      state().selectMuscle('CHEST');
      fixture.detectChanges();
      expect(root().querySelector('app-month-day')).toBeNull();
      expect(root().querySelector('app-month-muscle')).not.toBeNull();
    });
  });

  describe('badges', () => {
    it('shows a dash while they load and the figure is back with a count once they have', () => {
      const pending = new Subject<{ achievements: AnalyticsAchievement[] }>();
      analytics.getAchievements.and.returnValue(pending);
      open();
      expect(text('[data-figure="badges"] .value')).toEqual(['–']);

      pending.next({ achievements: [badge('A', '2026-09-02T03:00:00Z')] });
      fixture.detectChanges();
      expect(text('[data-figure="badges"] .value')).toEqual(['1']);
    });

    it('leaves the figure out when the request failed, and the other five still fill the grid', () => {
      analytics.getAchievements.and.returnValue(throwError(() => new Error('offline')));
      open();
      expect(root().querySelector('[data-figure="badges"]')).toBeNull();
      expect(root().querySelectorAll('.figure').length).toBe(5);
    });
  });
});
