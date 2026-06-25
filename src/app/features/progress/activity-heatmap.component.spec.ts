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

  it('renders compact weekday initials for quarter month grids', () => {
    fixture.detectChanges();

    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.month-heatmap:first-child .weekday-row span')).map((label) =>
      label.textContent?.trim()
    );

    expect(labels).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('pads quarter month heatmaps to six fixed week rows', () => {
    fixture.detectChanges();
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-06-30');
    component.data.set({ from: '2026-04-01', to: '2026-06-30', days: [] });
    fixture.detectChanges();

    const monthCellCounts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.month-heatmap')).map(
      (month) => month.querySelectorAll('.month-grid .heatmap-cell').length
    );

    expect(component.quarterMonths().map((month) => month.weeks.length)).toEqual([6, 6, 6]);
    expect(monthCellCounts).toEqual([42, 42, 42]);
  });

  it('shows the heatmap legend only for quarter and year views', () => {
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.legend')).not.toBeNull();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[0].click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.legend')).toBeNull();

    presetButtons[1].click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.legend')).toBeNull();

    presetButtons[3].click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.legend')).not.toBeNull();
  });

  it('computes year activity as twelve month heatmaps for the selected calendar year', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[3].click();
    fixture.detectChanges();

    const currentYear = new Date().getFullYear();
    expect(component.selectedPreset()).toBe('year');
    expect(component.startDate()).toBe(`${currentYear}-01-01`);
    expect(component.endDate()).toBe(`${currentYear}-12-31`);
    expect(component.yearMonths().map((month) => month.label)).toEqual([
      `January ${currentYear}`,
      `February ${currentYear}`,
      `March ${currentYear}`,
      `April ${currentYear}`,
      `May ${currentYear}`,
      `June ${currentYear}`,
      `July ${currentYear}`,
      `August ${currentYear}`,
      `September ${currentYear}`,
      `October ${currentYear}`,
      `November ${currentYear}`,
      `December ${currentYear}`
    ]);
    expect(component.yearMonths().every((month) => month.weeks.length === 6)).toBeTrue();
  });

  it('renders year activity as a twelve-month calendar heatmap matrix', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[3].click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const currentYear = new Date().getFullYear();
    expect(compiled.textContent).toContain(String(currentYear));
    expect(compiled.querySelectorAll('.year-months .month-heatmap').length).toBe(12);
    expect(compiled.querySelectorAll('.year-months .month-heatmap:first-child .weekday-row span').length).toBe(7);
    expect(compiled.querySelectorAll('.year-months .month-heatmap:first-child .month-grid .heatmap-cell').length).toBe(42);
  });

  it('moves year activity by natural calendar years with previous and next navigation', () => {
    fixture.detectChanges();

    const presetButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.range-presets button'));
    presetButtons[3].click();
    fixture.detectChanges();
    analyticsApi.getActivityCalendar.calls.reset();

    component.previousPeriod();
    expect(component.startDate()).toBe(`${new Date().getFullYear() - 1}-01-01`);
    expect(component.endDate()).toBe(`${new Date().getFullYear() - 1}-12-31`);
    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith(component.startDate(), component.endDate());

    analyticsApi.getActivityCalendar.calls.reset();
    component.nextPeriod();
    expect(component.startDate()).toBe(`${new Date().getFullYear()}-01-01`);
    expect(component.endDate()).toBe(`${new Date().getFullYear()}-12-31`);
    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith(component.startDate(), component.endDate());
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
    expect(blocks[0].startLabel).toBe('10:00');
    expect(blocks[0].timeLabel).toBe('10:00-11:00');
    expect(blocks[1].startLabel).toBe('10:30');
    expect(blocks.every((block) => block.height >= 22)).toBeTrue();
    expect(blocks[0].left).toBeCloseTo((1 / 7) * 100, 4);
    expect(blocks[0].width).toBeCloseTo((1 / 2 / 7) * 100, 4);
    expect(blocks[1].left).toBeCloseTo(((1 + 1 / 2) / 7) * 100, 4);
    expect(blocks[1].width).toBeCloseTo((1 / 2 / 7) * 100, 4);
    expect(component.allDaySessionsForDate('2026-06-16')[0].sessionId).toBe('untimed');
  });

  it('renders inline start times for short and long week blocks', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('week');
    component.startDate.set('2026-06-15');
    component.endDate.set('2026-06-21');
    dataService.getWorkoutSessionsInRange.and.returnValue(
      of([
        session({
          sessionId: 'short',
          name: 'Short strength with a title long enough to truncate',
          startedAt: '2026-06-16T02:00:00Z',
          completedAt: '2026-06-16T02:20:00Z',
          durationMinutes: 20
        }),
        session({
          sessionId: 'long',
          name: 'Long conditioning',
          startedAt: '2026-06-16T04:00:00Z',
          completedAt: '2026-06-16T05:30:00Z',
          durationMinutes: 90
        })
      ])
    );
    fixture.detectChanges();

    const blocks = component.weekBlocks();
    const renderedBlocks = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.session-block'));
    const shortBlock = renderedBlocks.find((block) => block.textContent?.includes('Short strength'));
    const longBlock = renderedBlocks.find((block) => block.textContent?.includes('Long conditioning'));
    const shortTitle = shortBlock?.querySelector<HTMLElement>('.block-title');

    expect(blocks.find((block) => block.session.sessionId === 'short')?.height).toBeLessThan(40);
    expect(blocks.find((block) => block.session.sessionId === 'long')?.height).toBeGreaterThanOrEqual(40);
    expect(blocks.find((block) => block.session.sessionId === 'short')?.startLabel).toBe('10:00');
    expect(blocks.find((block) => block.session.sessionId === 'long')?.startLabel).toBe('12:00');
    expect(renderedBlocks.every((block) => block.querySelector('.block-time') !== null)).toBeTrue();
    expect(shortBlock?.querySelector('.block-time')?.textContent?.trim()).toBe('10:00');
    expect(longBlock?.querySelector('.block-time')?.textContent?.trim()).toBe('12:00');
    expect(shortTitle?.textContent?.trim()).toBe('Short strength with a title long enough to truncate');
    expect(getComputedStyle(shortTitle!).textOverflow).toBe('ellipsis');
    expect(getComputedStyle(shortTitle!).whiteSpace).toBe('nowrap');
  });

  it('positions a single week session within its day slice without grid-column placement', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('week');
    component.startDate.set('2026-06-15');
    component.endDate.set('2026-06-21');
    dataService.getWorkoutSessionsInRange.and.returnValue(
      of([session({ sessionId: 'solo', startedAt: '2026-06-17T02:00:00Z', completedAt: '2026-06-17T03:00:00Z', durationMinutes: 60 })])
    );
    fixture.detectChanges();

    const block = component.weekBlocks()[0];
    const rendered = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.session-block');

    expect(block.dayIndex).toBe(2);
    expect(block.left).toBeCloseTo((2 / 7) * 100, 4);
    expect(block.width).toBeCloseTo((1 / 7) * 100, 4);
    expect(rendered?.style.gridColumn).toBe('');
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

  it('switches the expanded month detail when a second day overflow is opened', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('month');
    component.selectedDate.set(new Date(2026, 5, 1));
    dataService.getWorkoutSessionsInRange.and.returnValue(
      of([
        session({ sessionId: 'a-1', startedAt: '2026-06-10T00:00:00Z' }),
        session({ sessionId: 'a-2', startedAt: '2026-06-10T01:00:00Z' }),
        session({ sessionId: 'a-3', startedAt: '2026-06-10T02:00:00Z' }),
        session({ sessionId: 'b-1', startedAt: '2026-06-12T00:00:00Z' }),
        session({ sessionId: 'b-2', startedAt: '2026-06-12T01:00:00Z' }),
        session({ sessionId: 'b-3', startedAt: '2026-06-12T02:00:00Z' })
      ])
    );
    fixture.detectChanges();

    const moreButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.more-chip'));
    moreButtons[0].click();
    fixture.detectChanges();
    expect(component.expandedMonthDay()?.date).toBe('2026-06-10');
    expect((fixture.nativeElement as HTMLElement).querySelector('.expanded-day h3')?.textContent).toContain('2026-06-10');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.more-chip'))[1].click();
    fixture.detectChanges();
    expect(component.expandedMonthDay()?.date).toBe('2026-06-12');
    expect((fixture.nativeElement as HTMLElement).querySelector('.expanded-day h3')?.textContent).toContain('2026-06-12');
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

  it('renders the compact variant without weekday or month axis labels', () => {
    component.variant = 'compact';
    component.range = { from: '2026-06-01', to: '2026-06-30' };

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.compact-month-grid')).not.toBeNull();
    expect(compiled.querySelector('.weekday-row')).toBeNull();
    expect(compiled.querySelector('.month-heatmap h3')).toBeNull();
    expect(compiled.querySelectorAll('.compact-legend .heatmap-cell').length).toBe(5);
    expect(compiled.textContent).toContain('Less');
    expect(compiled.textContent).toContain('More');
  });

  it('aggregates compact monthly workout totals in the footer', () => {
    component.variant = 'compact';
    component.range = { from: '2026-06-01', to: '2026-06-30' };
    analyticsApi.getActivityCalendar.and.returnValue(
      of({
        from: '2026-06-01',
        to: '2026-06-30',
        days: [
          { date: '2026-06-01', workoutCount: 1, workoutMinutes: 40 },
          { date: '2026-06-10', workoutCount: 2, workoutMinutes: 75 }
        ]
      })
    );

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 workouts · 115 min');
  });

  it('renders a compact empty-month state without NaN', () => {
    component.variant = 'compact';
    component.range = { from: '2026-06-01', to: '2026-06-30' };
    analyticsApi.getActivityCalendar.and.returnValue(of({ from: '2026-06-01', to: '2026-06-30', days: [] }));

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('0 workouts · 0 min');
    expect(text).toContain('Log a workout to fill this in');
    expect(text).not.toContain('NaN');
  });

  it('highlights today in the compact month grid', () => {
    const today = localIsoDate(new Date());
    const monthRange = rangeForMonth(today);
    component.variant = 'compact';
    component.range = monthRange;
    analyticsApi.getActivityCalendar.and.returnValue(
      of({
        from: monthRange.from,
        to: monthRange.to,
        days: [{ date: today, workoutCount: 1, workoutMinutes: 30 }]
      })
    );

    fixture.detectChanges();

    const todayCell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`.heatmap-cell[title="${today}: 1 workout, 30 min"]`);
    expect(todayCell?.classList).toContain('is-today');
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

function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeForMonth(date: string): { from: string; to: string } {
  const [year, month] = date.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
}
