import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../../core/analytics-api.service';
import { AnalyticsSummaryCompareResponse } from '../../../core/analytics.models';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { BADGES } from '../../../core/me-fixtures.spec';
import { BadgesModel } from '../../../core/me.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { EarnedComponent } from './earned.component';

function compare(current: number | null, previous: number | null): AnalyticsSummaryCompareResponse {
  const empty = { current: null, previous: null, delta: null, deltaPct: null };
  return {
    period: 'WEEK',
    currentWindow: { from: '2026-09-28', to: '2026-10-04' },
    previousWindow: { from: '2026-09-21', to: '2026-09-27' },
    workout: {
      completedWorkoutCount: empty,
      totalWorkoutMinutes: { current, previous, delta: null, deltaPct: null },
      totalCaloriesBurned: empty,
      totalExerciseCount: empty
    },
    nutrition: { totalCaloriesConsumed: empty, totalProteinGrams: empty, totalCarbsGrams: empty, totalFatGrams: empty }
  };
}

describe('EarnedComponent', () => {
  let fixture: ComponentFixture<EarnedComponent>;
  let api: jasmine.SpyObj<AnalyticsApiService>;
  let data: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-06T04:00:00Z'));
    api = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getSummaryCompare']);
    api.getSummaryCompare.and.returnValue(of(compare(170, 120)));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getBadges']);
    data.getBadges.and.returnValue(of(BADGES));

    await TestBed.configureTestingModule({
      imports: [EarnedComponent],
      providers: [provideRouter([]), { provide: AnalyticsApiService, useValue: api }, { provide: FitSyncDataService, useValue: data }]
    }).compileComponents();

    fixture = TestBed.createComponent(EarnedComponent);
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
  });

  afterEach(() => jasmine.clock().uninstall());

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return (root().querySelector<HTMLElement>(selector)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  }

  it('shows the eyebrow, the training card and the strip', () => {
    fixture.detectChanges();

    expect(root().querySelector('.eyebrow')?.textContent).toBe('Earned');
    expect(text('.result')).toBe("This week's training 2 h 50 min 42% more than by this day last week");
    expect(text('.strip')).toBe('No new badges this week 7 of 17 earned See all ›');
  });

  it('draws no wall of badges any more', () => {
    fixture.detectChanges();

    expect(root().querySelector('ul.badges')).toBeNull();
    expect(root().querySelectorAll('app-badge-disc').length).toBe(0);
  });

  it('names the badge earned this week and opens the page of all of them', () => {
    const earnedToday: BadgesModel = { ...BADGES, latest: BADGES.latest };
    earnedToday.themes = BADGES.themes.map((theme) => ({
      ...theme,
      paths: theme.paths.map((path) => ({ nodes: path.nodes.map((entry) => (entry.code === 'FIRST_COOK' ? { ...entry, earnedOn: '2026-10-06' } : entry)) }))
    }));
    data.getBadges.and.returnValue(of(earnedToday));

    fixture.detectChanges();

    expect(text('.strip')).toBe('EARNED THIS WEEK First cook See all ›');
    expect(root().querySelectorAll('.strip app-badge-disc').length).toBe(1);
    expect(root().querySelector('.see-all')?.getAttribute('href')).toBe('/me/achievements');
  });

  it('says Nothing yet this week, with no comparison, when there was no training', () => {
    api.getSummaryCompare.and.returnValue(of(compare(0, 120)));

    fixture.detectChanges();

    expect(text('.result')).toBe("This week's training Nothing yet this week");
  });

  it('shows skeletons while loading and the final content after', () => {
    const badges = new Subject<BadgesModel>();
    const week = new Subject<AnalyticsSummaryCompareResponse>();
    data.getBadges.and.returnValue(badges);
    api.getSummaryCompare.and.returnValue(week);

    fixture.detectChanges();

    expect(root().querySelector('.strip-skeleton')).toBeTruthy();
    expect(root().querySelector('.result-skeleton')).toBeTruthy();

    badges.next(BADGES);
    week.next(compare(170, 120));
    fixture.detectChanges();

    expect(root().querySelector('.strip-skeleton')).toBeNull();
    expect(root().querySelector('.result-skeleton')).toBeNull();
  });

  it('replaces the strip with a retry when the badges fail, and the training card still shows', () => {
    data.getBadges.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(text('.strip')).toBe('Your badges could not be loaded. Try again');
    expect(text('.result')).toBe("This week's training 2 h 50 min 42% more than by this day last week");

    data.getBadges.and.returnValue(of(BADGES));
    root().querySelector<HTMLButtonElement>('.strip .retry')?.click();
    fixture.detectChanges();

    expect(text('.strip')).toContain('No new badges this week');
    expect(data.getBadges).toHaveBeenCalledTimes(2);
    expect(api.getSummaryCompare).toHaveBeenCalledTimes(1);
  });

  it('says Could not load, with a retry, when the training figure fails and keeps the strip', () => {
    api.getSummaryCompare.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(text('.result')).toContain('Could not load');
    expect(text('.strip')).toContain('No new badges this week');

    api.getSummaryCompare.and.returnValue(of(compare(170, 120)));
    root().querySelector<HTMLButtonElement>('.result .retry')?.click();
    fixture.detectChanges();

    expect(text('.result')).toContain('2 h 50 min');
  });

  it('uses the minutes of the dashboard for the headline and keeps the comparison of its own request', () => {
    fixture.componentRef.setInput('minutesThisWeek', 95);

    fixture.detectChanges();

    expect(text('.result')).toContain('1 h 35 min');
    expect(text('.result')).toContain('42% more than by this day last week');
  });

  it('keeps the dashboard minutes when the comparison fails', () => {
    fixture.componentRef.setInput('minutesThisWeek', 95);
    api.getSummaryCompare.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(text('.result')).toBe("This week's training 1 h 35 min");
  });

  it('writes the streak only from two days in a row', () => {
    fixture.componentRef.setInput('streakDays', 3);
    fixture.detectChanges();
    expect(text('.result')).toContain('3 days in a row');

    fixture.componentRef.setInput('streakDays', 1);
    fixture.detectChanges();
    expect(text('.result')).not.toContain('in a row');
  });

  it('never prints null, undefined or NaN', () => {
    api.getSummaryCompare.and.returnValue(of(compare(null, null)));

    fixture.detectChanges();

    expect(root().textContent ?? '').not.toMatch(/null|undefined|NaN/);
  });
});
