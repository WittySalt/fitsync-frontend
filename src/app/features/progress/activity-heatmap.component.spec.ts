import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse } from '../../core/analytics.models';
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

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getActivityCalendar']);
    analyticsApi.getActivityCalendar.and.returnValue(of(activityCalendar));

    await TestBed.configureTestingModule({
      imports: [ActivityHeatmapComponent],
      providers: [{ provide: AnalyticsApiService, useValue: analyticsApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityHeatmapComponent);
    component = fixture.componentInstance;
  });

  it('loads the default activity calendar range', () => {
    fixture.detectChanges();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(String));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Workout activity');
    expect(component.days().length).toBe(3);
  });

  it('renders inactive days as zero-intensity cells with a tooltip', () => {
    fixture.detectChanges();

    const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.heatmap [role="listitem"]'));
    expect(cells.length).toBe(3);
    expect(cells[1].classList).toContain('intensity-0');
    expect(cells[1].getAttribute('title')).toBe('2026-06-21: No workouts');
    expect(cells[2].classList).toContain('intensity-3');
    expect(cells[2].getAttribute('aria-label')).toBe('2026-06-22: 3 workouts, 65 min');
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
    presetButtons[0].click();

    expect(analyticsApi.getActivityCalendar).toHaveBeenCalledTimes(2);
  });

  it('renders an error state when activity loading fails', () => {
    analyticsApi.getActivityCalendar.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Activity unavailable');
  });
});
