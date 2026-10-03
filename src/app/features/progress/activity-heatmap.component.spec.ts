import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse } from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSession } from '../../core/fitsync.models';
import { ActivityHeatmapComponent } from './activity-heatmap.component';

const calendar: AnalyticsActivityCalendarResponse = {
  from: '2026-09-03',
  to: '2026-10-03',
  days: [
    { date: '2026-09-08', workoutCount: 1, workoutMinutes: 20 },
    { date: '2026-09-15', workoutCount: 1, workoutMinutes: 45 },
    { date: '2026-09-20', workoutCount: 2, workoutMinutes: 50 },
    { date: '2026-09-25', workoutCount: 3, workoutMinutes: 70 },
    { date: '2026-10-02', workoutCount: 4, workoutMinutes: 30 }
  ]
};

const session: WorkoutSession = {
  sessionId: 's-1',
  name: 'Upper body',
  workoutType: 'STRENGTH',
  status: 'COMPLETED',
  startedAt: '2026-09-25T00:30:00Z',
  completedAt: '2026-09-25T01:20:00Z',
  durationMinutes: 50,
  caloriesBurned: null,
  exerciseCount: 5
};

describe('ActivityHeatmapComponent', () => {
  let fixture: ComponentFixture<ActivityHeatmapComponent>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getActivityCalendar']);
    analyticsApi.getActivityCalendar.and.returnValue(of(calendar));
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutSessionsInRange',
      'getExerciseMetadata',
      'getExercises',
      'getSession'
    ]);
    // The session detail opens in its loading state; it has its own specs.
    dataService.getExerciseMetadata.and.returnValue(NEVER);
    dataService.getExercises.and.returnValue(NEVER);
    dataService.getSession.and.returnValue(NEVER);
    dataService.getWorkoutSessionsInRange.and.returnValue(of([session]));

    await TestBed.configureTestingModule({
      imports: [ActivityHeatmapComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AnalyticsApiService, useValue: analyticsApi },
        { provide: FitSyncDataService, useValue: dataService }
      ]
    }).compileComponents();

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-03T04:00:00Z'));

    fixture = TestBed.createComponent(ActivityHeatmapComponent);
    fixture.componentRef.setInput('range', { from: '2026-09-03', to: '2026-10-03' });
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function cell(date: string): HTMLElement | null {
    const label = root().querySelector<HTMLElement>(`li.cell[title^="${date}"]`);
    return label;
  }

  it('asks the activity service for the range the page chose', () => {
    fixture.detectChanges();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledOnceWith('2026-09-03', '2026-10-03');
  });

  it('loads again when the page changes the range', () => {
    fixture.detectChanges();

    fixture.componentRef.setInput('range', { from: '2025-10-03', to: '2026-10-03' });
    fixture.detectChanges();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith('2025-10-03', '2026-10-03');
    expect(root().querySelectorAll('.month').length).toBe(13);
  });

  it('draws one calendar for each month the range touches', () => {
    fixture.detectChanges();

    const titles = Array.from(root().querySelectorAll('.month h3')).map((node) => node.textContent?.trim());
    expect(titles).toEqual(['September 2026', 'October 2026']);
  });

  it('has no range controls of its own', () => {
    fixture.detectChanges();

    expect(root().querySelector('input[type="date"]')).toBeNull();
    expect(root().textContent).not.toContain('Previous');
    expect(root().textContent).not.toContain('Apply');
  });

  it('writes the dates in the short style, never as ISO dates', () => {
    fixture.detectChanges();

    expect(root().querySelector('.date-caption')?.textContent?.trim()).toBe('3 Sept to 3 Oct');
    expect(root().innerHTML).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const tooltip = root().querySelector("li.cell[title^=\"25 Sept\"] button")?.getAttribute("aria-label");
    expect(tooltip).toBe('25 Sept: 3 workouts, 70 min. Show the sessions.');
  });

  it('shades a day by what was trained and dims the days outside the range', () => {
    fixture.detectChanges();

    expect(cell('8 Sept')?.classList).toContain('intensity-1');
    expect(cell('20 Sept')?.classList).toContain('intensity-2');
    expect(cell('25 Sept')?.classList).toContain('intensity-3');
    expect(cell('2 Oct')?.classList).toContain('intensity-4');
    expect(cell('1 Sept')?.classList).toContain('muted');
    expect(cell('3 Sept')?.classList).not.toContain('muted');
  });

  it('marks today in the profile zone', () => {
    fixture.detectChanges();

    expect(cell('3 Oct')?.classList).toContain('today');
    expect(root().querySelectorAll('li.cell.today').length).toBe(1);
  });

  it('starts every month on its own weekday, with Monday first', () => {
    fixture.detectChanges();

    // 1 September 2026 is a Tuesday, so one blank comes before it.
    const first = root().querySelector('.month .grid');
    expect(first?.children[0].classList).toContain('blank');
    expect(first?.children[1].getAttribute('aria-label')).toContain('1 Sept');
  });

  it('shows an error panel with a retry', () => {
    analyticsApi.getActivityCalendar.and.returnValue(throwError(() => new Error('down')));
    fixture.detectChanges();

    expect(root().textContent).toContain('Activity unavailable');

    analyticsApi.getActivityCalendar.and.returnValue(of(calendar));
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutSessionsInRange',
      'getExerciseMetadata',
      'getExercises',
      'getSession'
    ]);
    // The session detail opens in its loading state; it has its own specs.
    dataService.getExerciseMetadata.and.returnValue(NEVER);
    dataService.getExercises.and.returnValue(NEVER);
    dataService.getSession.and.returnValue(NEVER);
    dataService.getWorkoutSessionsInRange.and.returnValue(of([session]));
    root().querySelector<HTMLButtonElement>('app-state-panel button')?.click();
    fixture.detectChanges();

    expect(root().querySelectorAll('.month').length).toBe(2);
  });

  it('opens the sessions of a day with training when it is clicked, in the profile zone', () => {
    fixture.detectChanges();

    root().querySelector<HTMLButtonElement>('li.cell[title^="25 Sept"] button')?.click();
    fixture.detectChanges();

    expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledWith('2026-09-24T16:00:00.000Z', '2026-09-25T15:59:59.999Z');
    const day = root().querySelector('.day');
    expect(day?.querySelector('h3')?.textContent).toBe('25 Sept');
    expect(day?.textContent).toContain('Upper body');
    expect(day?.textContent).toContain('08:30-09:20');
  });

  it('opens the session detail from a session of the day', () => {
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('li.cell[title^="25 Sept"] button')?.click();
    fixture.detectChanges();

    root().querySelector<HTMLButtonElement>('.day .session')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSessionId()).toBe('s-1');
    expect(root().querySelector('app-session-detail')).not.toBeNull();
  });

  it('leaves a day without training as a plain cell with nothing to open', () => {
    fixture.detectChanges();

    expect(cell('5 Sept')?.querySelector('button')).toBeNull();
  });

  it('says so when a day has no sessions to list, hides cancelled ones and can be closed', () => {
    dataService.getWorkoutSessionsInRange.and.returnValue(of([{ ...session, status: 'CANCELLED' }]));
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('li.cell[title^="25 Sept"] button')?.click();
    fixture.detectChanges();

    expect(root().querySelector('.day')?.textContent).toContain('No sessions logged for this day.');

    root().querySelector<HTMLButtonElement>('.day .button')?.click();
    fixture.detectChanges();
    expect(root().querySelector('.day')).toBeNull();
  });

  it('offers a retry when the sessions of a day cannot be loaded', () => {
    dataService.getWorkoutSessionsInRange.and.returnValue(throwError(() => new Error('down')));
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('li.cell[title^="25 Sept"] button')?.click();
    fixture.detectChanges();

    expect(root().querySelector('.day')?.textContent).toContain('Sessions unavailable');
  });

  it('shows an empty state instead of blank calendars when nothing was trained in the range', () => {
    analyticsApi.getActivityCalendar.and.returnValue(of({ ...calendar, days: [] }));
    fixture.detectChanges();

    expect(root().textContent).toContain('No workouts in this range');
    expect(root().querySelector('.month')).toBeNull();
  });

  describe('the Calendar / Month / Week switch', () => {
    function buttons(): HTMLButtonElement[] {
      return Array.from(root().querySelectorAll<HTMLButtonElement>('.view-switch button'));
    }

    it('offers Calendar, Month and Week, with Calendar selected and driven by the page range', () => {
      fixture.detectChanges();

      expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Calendar', 'Month', 'Week']);
      expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
      expect(root().querySelector('app-session-calendar')).toBeNull();
      expect(root().querySelector('.date-caption')?.textContent?.trim()).toBe('3 Sept to 3 Oct');
    });

    it('shows the week calendar, with its All day row, from Week', () => {
      fixture.detectChanges();

      buttons()[2].click();
      fixture.detectChanges();

      expect(buttons()[2].getAttribute('aria-pressed')).toBe('true');
      expect(root().querySelector('app-session-calendar .week-calendar')).not.toBeNull();
      expect(root().querySelector('app-session-calendar .all-day-row')).not.toBeNull();
      expect(root().querySelector('.month')).toBeNull();
      expect(root().querySelector('.date-caption')).toBeNull();
    });

    it('shows the month calendar with session chips from Month, browsing beyond the page range', () => {
      dataService.getWorkoutSessionsInRange.and.returnValue(of([{ ...session, startedAt: '2026-10-02T02:00:00Z', completedAt: '2026-10-02T03:00:00Z' }]));
      fixture.detectChanges();

      buttons()[1].click();
      fixture.detectChanges();

      expect(root().querySelector('app-session-calendar .month-calendar-grid')).not.toBeNull();
      expect(root().querySelector('.month-session-chip')?.textContent).toContain('Upper body');

      dataService.getWorkoutSessionsInRange.calls.reset();
      root().querySelector<HTMLButtonElement>('app-session-calendar .calendar-toolbar button')?.click();
      fixture.detectChanges();
      expect(dataService.getWorkoutSessionsInRange).toHaveBeenCalledTimes(1);
      // The page range starts on 3 September, and September is the month shown, so the previous one is August.
      expect(dataService.getWorkoutSessionsInRange.calls.mostRecent().args[0]).toContain('2026-08-31');
    });

    it('opens the session detail from a chip', () => {
      dataService.getWorkoutSessionsInRange.and.returnValue(of([{ ...session, startedAt: '2026-10-02T02:00:00Z', completedAt: '2026-10-02T03:00:00Z' }]));
      fixture.detectChanges();
      buttons()[1].click();
      fixture.detectChanges();

      root().querySelector<HTMLButtonElement>('.month-session-chip')?.click();
      fixture.detectChanges();

      expect(root().querySelector('app-session-calendar app-session-detail')).not.toBeNull();
    });

    it('returns to the calendar of the range, keeping the shared empty state', () => {
      analyticsApi.getActivityCalendar.and.returnValue(of({ ...calendar, days: [] }));
      fixture.detectChanges();
      buttons()[2].click();
      fixture.detectChanges();
      buttons()[0].click();
      fixture.detectChanges();

      expect(root().querySelector('app-session-calendar')).toBeNull();
      expect(root().textContent).toContain('No workouts in this range');
    });
  });
});
