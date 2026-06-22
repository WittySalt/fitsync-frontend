import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse } from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSession, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ActivityHeatmapComponent } from './activity-heatmap.component';

const activityCalendar: AnalyticsActivityCalendarResponse = {
  from: '2026-06-20',
  to: '2026-06-22',
  days: [
    { date: '2026-06-20', workoutCount: 1, workoutMinutes: 20 },
    { date: '2026-06-21', workoutCount: 0, workoutMinutes: 0 },
    { date: '2026-06-22', workoutCount: 3, workoutMinutes: 65 }
  ]
};

describe('ActivityHeatmapComponent', () => {
  let fixture: ComponentFixture<ActivityHeatmapComponent>;
  let component: ActivityHeatmapComponent;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getActivityCalendar']);
    analyticsApi.getActivityCalendar.and.returnValue(of(activityCalendar));
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutSessionsInRange',
      'getSession',
      'updateSession',
      'deleteSession',
      'repeatSession'
    ]);
    dataService.getWorkoutSessionsInRange.and.returnValue(of([]));
    dataService.getSession.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [ActivityHeatmapComponent],
      providers: [
        { provide: AnalyticsApiService, useValue: analyticsApi },
        { provide: FitSyncDataService, useValue: dataService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityHeatmapComponent);
    component = fixture.componentInstance;
  });

  it('loads the default activity calendar range', () => {
    fixture.detectChanges();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Workout activity');
    expect(component.days().length).toBe(3);
    expect(component.selectedPreset()).toBe('quarter');
  });

  it('renders inactive days as zero-intensity cells with a tooltip', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inactive = compiled.querySelector<HTMLElement>('.heatmap-cell[title="2026-06-21: No workouts"]');
    const active = compiled.querySelector<HTMLElement>('.heatmap-cell[aria-label="2026-06-22: 3 workouts, 65 min"]');
    expect(inactive?.classList).toContain('intensity-0');
    expect(active?.classList).toContain('intensity-3');
  });

  it('fills missing response dates as inactive days', () => {
    analyticsApi.getActivityCalendar.and.returnValue(
      of({
        from: '2026-06-20',
        to: '2026-06-22',
        days: [{ date: '2026-06-20', workoutCount: 1, workoutMinutes: 20 }]
      })
    );

    fixture.detectChanges();

    expect(component.days()).toEqual([
      { date: '2026-06-20', workoutCount: 1, workoutMinutes: 20 },
      { date: '2026-06-21', workoutCount: 0, workoutMinutes: 0 },
      { date: '2026-06-22', workoutCount: 0, workoutMinutes: 0 }
    ]);
  });

  it('re-queries when the range preset changes', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[3].click();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledTimes(2);
  });

  it('loads sessions instead of activity buckets for the week preset', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[0].click();

    expect(component.selectedPreset()).toBe('week');
    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String));
  });

  it('renders quarter activity as three month heatmaps with one shared legend', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.month-heatmap').length).toBe(3);
    expect(compiled.querySelectorAll('.legend .heatmap-cell').length).toBe(5);
    expect(compiled.textContent).toContain('Less');
    expect(compiled.textContent).toContain('More');
  });

  it('renders year activity as a week-column heatmap with month labels', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[3].click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.selectedPreset()).toBe('year');
    expect(compiled.querySelectorAll('.year-week').length).toBeGreaterThan(50);
    expect(compiled.querySelectorAll('.year-month-labels span').length).toBeGreaterThan(6);
  });

  it('maps overlapping week sessions into split-width blocks in the profile timezone', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('week');
    component.startDate.set('2026-06-15');
    component.endDate.set('2026-06-21');
    component.sessions.set([
      session({ sessionId: 'first', startedAt: '2026-06-16T02:00:00Z', completedAt: '2026-06-16T03:00:00Z', durationMinutes: 60 }),
      session({ sessionId: 'second', startedAt: '2026-06-16T02:30:00Z', completedAt: '2026-06-16T03:10:00Z', durationMinutes: 40 }),
      session({ sessionId: 'untimed', startedAt: '2026-06-16T01:00:00Z', completedAt: '', durationMinutes: 0 })
    ]);

    const blocks = component.weekBlocks();
    expect(blocks.map((block) => block.session.sessionId)).toEqual(['first', 'second']);
    expect(blocks[0].dayIndex).toBe(1);
    expect(blocks[0].timeLabel).toBe('10:00-11:00');
    expect(blocks[0].width).toBe(50);
    expect(blocks[1].left).toBe(50);
    expect(component.allDaySessionsForDate('2026-06-16')[0].sessionId).toBe('untimed');
  });

  it('maps month sessions into time-sorted chips with overflow', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('month');
    component.selectedDate.set(new Date(2026, 5, 1));
    component.sessions.set([
      session({ sessionId: 'late', startedAt: '2026-06-10T12:00:00Z', completedAt: '2026-06-10T13:00:00Z', durationMinutes: 60 }),
      session({ sessionId: 'early', startedAt: '2026-06-10T00:00:00Z', completedAt: '2026-06-10T01:00:00Z', durationMinutes: 60 }),
      session({ sessionId: 'mid', startedAt: '2026-06-10T04:00:00Z', completedAt: '2026-06-10T05:00:00Z', durationMinutes: 60 })
    ]);

    const day = component.monthDays().find((item) => item.date === '2026-06-10');
    expect(day?.chips.map((chip) => chip.session.sessionId)).toEqual(['early', 'mid', 'late']);
    expect(day?.visibleChips.length).toBe(2);
    expect(day?.hiddenCount).toBe(1);
  });

  it('moves week and month event ranges with previous and next navigation', () => {
    fixture.detectChanges();

    component.selectedPreset.set('week');
    component.selectedDate.set(new Date(2026, 5, 17));
    dataService.getWorkoutSessionsInRange.calls.reset();
    component.previousPeriod();

    expect(component.startDate()).toBe('2026-06-08');
    expect(component.endDate()).toBe('2026-06-14');
    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledTimes(1);

    component.selectedPreset.set('month');
    component.selectedDate.set(new Date(2026, 5, 1));
    dataService.getWorkoutSessionsInRange.calls.reset();
    component.nextPeriod();

    expect(component.startDate()).toBe('2026-07-01');
    expect(component.endDate()).toBe('2026-07-31');
    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledTimes(1);
  });

  it('renders an error state when session loading fails', () => {
    dataService.getWorkoutSessionsInRange.and.returnValue(throwError(() => new Error('nope')));
    component.selectedPreset.set('week');

    component.load();
    fixture.detectChanges();

    expect(component.error()).toBe('Unable to load workout sessions. Please retry.');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Activity unavailable');
  });

  it('keeps session detail state in sync with session actions', () => {
    const original = session({ sessionId: 'first', name: 'Strength' });
    const sibling = session({ sessionId: 'second', name: 'Cardio' });
    component.sessions.set([original, sibling]);

    component.openSession(original);
    expect(component.selectedSessionId()).toBe('first');

    component.handleSessionUpdated(session({ sessionId: 'first', name: 'Updated' }) as WorkoutSessionDetail);
    expect(component.sessions()[0].name).toBe('Updated');

    component.handleSessionRepeated(session({ sessionId: 'repeat', name: 'Repeat' }) as WorkoutSessionDetail);
    expect(component.sessions()[0].sessionId).toBe('repeat');

    component.handleSessionDeleted();
    expect(component.selectedSessionId()).toBeNull();
    expect(component.sessions().some((item) => item.sessionId === 'first')).toBeFalse();

    component.openSession(session({ sessionId: '' }));
    expect(component.selectedSessionId()).toBeNull();
  });

  it('uses the default week time window and expands it for early or late sessions', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('week');
    component.startDate.set('2026-06-15');
    component.endDate.set('2026-06-21');

    expect(component.weekTimeWindow()).toEqual({ start: 360, end: 1320 });
    expect(component.weekTimeSlots()[0]).toBe(360);

    component.sessions.set([
      session({ sessionId: 'early', startedAt: '2026-06-15T19:30:00Z', completedAt: '2026-06-15T20:15:00Z', durationMinutes: 45 }),
      session({ sessionId: 'late', startedAt: '2026-06-16T14:30:00Z', completedAt: '2026-06-16T15:45:00Z', durationMinutes: 75 })
    ]);

    expect(component.weekTimeWindow()).toEqual({ start: 180, end: 1440 });
    expect(component.weekBlocks().map((block) => block.timeLabel)).toEqual(['03:30-04:15', '22:30-23:45']);
  });

  it('expands month days and renders the empty expanded-day state', () => {
    component.selectedPreset.set('month');
    component.selectedDate.set(new Date(2026, 5, 1));
    component.sessions.set([session({ sessionId: 'logged', startedAt: '2026-06-10T04:00:00Z' })]);

    const emptyDay = component.monthDays().find((day) => day.date === '2026-06-11');
    expect(emptyDay).toBeDefined();

    component.expandMonthDay(emptyDay!);
    fixture.detectChanges();

    expect(component.expandedMonthDay()?.date).toBe('2026-06-11');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No sessions logged for this day.');
  });

  it('marks heatmap cells outside the active range or month as muted', () => {
    component.startDate.set('2026-06-20');
    component.endDate.set('2026-06-22');
    component.data.set(activityCalendar);

    expect(component.cellClass({ date: '2026-06-19', workoutCount: 0, workoutMinutes: 0, inRange: false, inMonth: true })).toContain(
      'is-muted'
    );
    expect(component.cellClass({ date: '2026-06-20', workoutCount: 1, workoutMinutes: 20, inRange: true, inMonth: false })).toContain(
      'is-muted'
    );
    expect(component.cellClass({ date: '2026-06-22', workoutCount: 3, workoutMinutes: 65, inRange: true, inMonth: true })).not.toContain(
      'is-muted'
    );
  });

  it('updates manual date fields as a month-range request', () => {
    component.updateStartDate({ target: { value: '2026-02-01' } } as unknown as Event);
    component.updateEndDate({ target: { value: '2026-02-28' } } as unknown as Event);

    expect(component.selectedPreset()).toBe('month');
    expect(component.startDate()).toBe('2026-02-01');
    expect(component.endDate()).toBe('2026-02-28');
  });

  it('renders an error state when activity loading fails', () => {
    analyticsApi.getActivityCalendar.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Activity unavailable');
  });
});

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Strength',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-06-16T02:00:00Z',
    completedAt: '2026-06-16T03:00:00Z',
    durationMinutes: 60,
    caloriesBurned: 300,
    exerciseCount: 5,
    ...overrides
  };
}
