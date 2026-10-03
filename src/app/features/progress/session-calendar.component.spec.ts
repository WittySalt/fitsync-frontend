import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSession, WorkoutSessionDetail } from '../../core/fitsync.models';
import { SessionCalendarComponent } from './session-calendar.component';

describe('SessionCalendarComponent', () => {
  let fixture: ComponentFixture<SessionCalendarComponent>;
  let component: SessionCalendarComponent;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
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
      imports: [SessionCalendarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: FitSyncDataService, useValue: dataService }]
    }).compileComponents();

    // The calendars start from today, so the clock is pinned to keep the fixtures' June 2026 days in view.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-22T12:00:00Z'));

    fixture = TestBed.createComponent(SessionCalendarComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('opens on the week of today and loads its sessions', () => {
    fixture.detectChanges();

    expect(component.selectedPreset()).toBe('week');
    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledTimes(1);
  });

  it('follows the mode it is given, and loads again when the mode changes', () => {
    fixture.componentRef.setInput('mode', 'month');
    fixture.detectChanges();
    expect(component.selectedPreset()).toBe('month');
    expect((fixture.nativeElement as HTMLElement).querySelector('.month-calendar-grid')).not.toBeNull();

    dataService.getWorkoutSessionsInRange.calls.reset();
    fixture.componentRef.setInput('mode', 'week');
    fixture.detectChanges();
    expect(component.selectedPreset()).toBe('week');
    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('.week-calendar')).not.toBeNull();
  });

  it('shows the untimed All day row in the week view', () => {
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.all-day-row')?.textContent).toContain('All day');
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

  it('drops cancelled sessions when loading the activity calendar', () => {
    component.timezone = 'Asia/Singapore';
    component.selectedPreset.set('week');
    component.startDate.set('2026-06-15');
    component.endDate.set('2026-06-21');
    dataService.getWorkoutSessionsInRange.and.returnValue(
      of([
        session({
          sessionId: 'done',
          startedAt: '2026-06-16T02:00:00Z',
          completedAt: '2026-06-16T02:30:00Z',
          durationMinutes: 30,
          status: 'COMPLETED'
        }),
        session({
          sessionId: 'gone',
          startedAt: '2026-06-16T05:00:00Z',
          completedAt: '',
          durationMinutes: 0,
          status: 'CANCELLED'
        })
      ])
    );

    component.loadSessions();

    expect(component.sessions().map((entry) => entry.sessionId)).toEqual(['done']);
    expect(component.allDaySessionsForDate('2026-06-16').length).toBe(0);
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
    expect((fixture.nativeElement as HTMLElement).querySelector('.expanded-day h3')?.textContent).toContain('10 Jun');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.more-chip'))[1].click();
    fixture.detectChanges();
    expect(component.expandedMonthDay()?.date).toBe('2026-06-12');
    expect((fixture.nativeElement as HTMLElement).querySelector('.expanded-day h3')?.textContent).toContain('12 Jun');
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
