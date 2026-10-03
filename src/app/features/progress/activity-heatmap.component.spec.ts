import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse } from '../../core/analytics.models';
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

describe('ActivityHeatmapComponent', () => {
  let fixture: ComponentFixture<ActivityHeatmapComponent>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getActivityCalendar']);
    analyticsApi.getActivityCalendar.and.returnValue(of(calendar));

    await TestBed.configureTestingModule({
      imports: [ActivityHeatmapComponent],
      providers: [{ provide: AnalyticsApiService, useValue: analyticsApi }]
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
    const label = root().querySelector<HTMLElement>(`li.cell[aria-label^="${date}"]`);
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
    expect(root().querySelector('button')).toBeNull();
    expect(root().textContent).not.toContain('Apply');
  });

  it('writes the dates in the short style, never as ISO dates', () => {
    fixture.detectChanges();

    expect(root().querySelector('.date-caption')?.textContent?.trim()).toBe('3 Sept to 3 Oct');
    expect(root().innerHTML).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const tooltip = root().querySelector('li.cell[aria-label^="25 Sept"]')?.getAttribute('aria-label');
    expect(tooltip).toBe('25 Sept: 3 workouts, 70 min');
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
    root().querySelector<HTMLButtonElement>('app-state-panel button')?.click();
    fixture.detectChanges();

    expect(root().querySelectorAll('.month').length).toBe(2);
  });
});
