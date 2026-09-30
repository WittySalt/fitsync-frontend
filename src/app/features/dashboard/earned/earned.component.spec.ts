import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../../core/analytics-api.service';
import {
  AnalyticsAchievement,
  AnalyticsAchievementsResponse,
  AnalyticsSummaryCompareResponse
} from '../../../core/analytics.models';
import { EarnedComponent } from './earned.component';

function achievement(code: string, title: string, progress: number, unlockedAt: string | null = null): AnalyticsAchievement {
  return { code, title, unlocked: unlockedAt !== null, unlockedAt, progress: unlockedAt ? 1 : progress };
}

// The server's order, with four earned badges so the ordering shows on the page.
const nineBadges: AnalyticsAchievement[] = [
  achievement('FIRST_WORKOUT', 'First workout', 1, '2026-08-01T03:00:00Z'),
  achievement('WORKOUTS_10', '10 workouts', 1, '2026-08-20T03:00:00Z'),
  achievement('WORKOUTS_50', '50 workouts', 0.66),
  achievement('WORKOUTS_100', '100 workouts', 0.33),
  achievement('STREAK_7', '7-day streak', 2 / 7),
  achievement('STREAK_30', '30-day streak', 0.1),
  achievement('FIRST_MEAL_LOGGED', 'First meal', 1, '2026-08-05T03:00:00Z'),
  achievement('FIRST_WEIGHT_LOGGED', 'First weigh-in', 1, '2026-08-10T03:00:00Z'),
  achievement('PR_FIRST', 'First record', 0)
];

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

  beforeEach(async () => {
    api = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getAchievements', 'getSummaryCompare']);
    api.getAchievements.and.returnValue(of({ achievements: nineBadges }));
    api.getSummaryCompare.and.returnValue(of(compare(170, 120)));

    await TestBed.configureTestingModule({
      imports: [EarnedComponent],
      providers: [{ provide: AnalyticsApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(EarnedComponent);
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return (root().querySelector<HTMLElement>(selector)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  }

  function cards(): HTMLElement[] {
    return Array.from(root().querySelectorAll<HTMLElement>('.result'));
  }

  function cardText(index: number): string {
    return cards()[index].innerText.replace(/\s+/g, ' ').trim();
  }

  function items(): HTMLElement[] {
    return Array.from(root().querySelectorAll<HTMLElement>('ul.badges > li'));
  }

  it('shows the eyebrow and the two result cards with their exact texts', () => {
    fixture.detectChanges();

    expect(root().querySelector('.eyebrow')?.textContent).toBe('Earned');
    expect(cardText(0)).toBe("This week's training 2 h 50 min 42% more than last week");
    expect(cardText(1)).toBe('Badges 4 of 9 earned 10 workouts · 20 Aug');
  });

  it('draws nine badges in a list, earned first and newest first, each with its accessible name', () => {
    fixture.detectChanges();

    expect(items().length).toBe(9);
    expect(items().map((item) => item.getAttribute('aria-label'))).toEqual([
      '10 workouts, earned 20 Aug',
      'First weigh-in, earned 10 Aug',
      'First meal, earned 5 Aug',
      'First workout, earned 1 Aug',
      '50 workouts, 33 of 50',
      '100 workouts, 33 of 100',
      '7-day streak, 2 of 7 days',
      '30-day streak, 3 of 30 days',
      'First record, not yet'
    ]);
    expect(root().querySelectorAll('ul.badges > li.earned').length).toBe(4);
  });

  it('writes the date under an earned title and the count under an unfinished one', () => {
    fixture.detectChanges();

    const [first, , , , inProgress, , , , record] = items();
    expect(first.querySelector('.badge-title')?.textContent).toBe('10 workouts');
    expect(first.querySelector('.badge-detail')?.textContent).toBe('20 Aug');
    expect(first.querySelector('.seal-fill')).toBeTruthy();
    expect(first.querySelector('.ring-arc')).toBeNull();

    expect(inProgress.querySelector('.badge-detail')?.textContent).toBe('33 of 50');
    expect(inProgress.querySelector('.ring-track')).toBeTruthy();
    expect(inProgress.querySelector('.ring-arc')).toBeTruthy();
    expect(inProgress.querySelector('.seal-fill')).toBeNull();

    expect(record.querySelector('.badge-detail')?.textContent).toBe('Not yet');
    // A ring with nothing in it draws no arc rather than a dot.
    expect(record.querySelector('.ring-arc')).toBeNull();
  });

  it('draws each ring from 12 o\'clock with an arc as long as the progress', () => {
    fixture.detectChanges();

    const arc = items()[4].querySelector('.ring-arc') as SVGCircleElement;
    expect(arc.getAttribute('transform')).toBe('rotate(-90 32 32)');
    const [length, circumference] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
    expect(length / circumference).toBeCloseTo(0.66, 5);
  });

  it('hides the seals from assistive technology and draws glyphs without markup strings', () => {
    fixture.detectChanges();

    for (const item of items()) {
      expect(item.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(item.querySelectorAll('svg .glyph > *').length).toBeGreaterThan(0);
    }
  });

  it('says Nothing yet this week, with no comparison, when there was no training', () => {
    api.getSummaryCompare.and.returnValue(of(compare(0, 120)));

    fixture.detectChanges();

    expect(cardText(0)).toBe("This week's training Nothing yet this week");
    expect(root().querySelector('.result-note')?.textContent).not.toContain('last week');
  });

  it('leaves out the comparison when last week was empty, and writes less and the same', () => {
    api.getSummaryCompare.and.returnValue(of(compare(60, 0)));
    fixture.detectChanges();
    expect(cardText(0)).toBe("This week's training 1 h");

    const second = TestBed.createComponent(EarnedComponent);
    api.getSummaryCompare.and.returnValue(of(compare(100, 120)));
    second.detectChanges();
    expect(second.nativeElement.textContent).toContain('1 h 40 min');
    expect(second.nativeElement.textContent).toContain('17% less than last week');

    const third = TestBed.createComponent(EarnedComponent);
    api.getSummaryCompare.and.returnValue(of(compare(120, 120)));
    third.detectChanges();
    expect(third.nativeElement.textContent).toContain('the same as last week');
  });

  it('shows 0 of 9 earned with no second line when nothing is earned', () => {
    api.getAchievements.and.returnValue(
      of({ achievements: nineBadges.map((entry) => ({ ...entry, unlocked: false, unlockedAt: null, progress: 0 })) })
    );

    fixture.detectChanges();

    expect(cardText(1)).toBe('Badges 0 of 9 earned');
    expect(cards()[1].querySelector('.result-note')).toBeNull();
  });

  it('shows a skeleton while loading and the final content after', () => {
    const achievements = new Subject<AnalyticsAchievementsResponse>();
    const week = new Subject<AnalyticsSummaryCompareResponse>();
    api.getAchievements.and.returnValue(achievements);
    api.getSummaryCompare.and.returnValue(week);

    fixture.detectChanges();

    expect(root().querySelector('.wall-skeleton')).toBeTruthy();
    expect(root().querySelectorAll('.result-skeleton').length).toBe(2);
    expect(items().length).toBe(0);

    achievements.next({ achievements: nineBadges });
    week.next(compare(170, 120));
    fixture.detectChanges();

    expect(root().querySelector('.wall-skeleton')).toBeNull();
    expect(root().querySelector('.result-skeleton')).toBeNull();
    expect(items().length).toBe(9);
  });

  it('replaces the wall with a retry when achievements fail, and the training card still shows', () => {
    api.getAchievements.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(text('.wall')).toBe('This could not be loaded. Try again');
    expect(items().length).toBe(0);
    expect(cardText(0)).toBe("This week's training 2 h 50 min 42% more than last week");
    expect(cardText(1)).not.toContain('0 of 9');
  });

  it('reloads the wall from Try again', () => {
    api.getAchievements.and.returnValue(throwError(() => new Error('down')));
    fixture.detectChanges();

    api.getAchievements.and.returnValue(of({ achievements: nineBadges }));
    root().querySelector<HTMLButtonElement>('.retry')?.click();
    fixture.detectChanges();

    expect(root().querySelector('.failed')).toBeNull();
    expect(items().length).toBe(9);
    expect(api.getAchievements).toHaveBeenCalledTimes(2);
    expect(api.getSummaryCompare).toHaveBeenCalledTimes(1);
  });

  it('shows Nothing yet this week and keeps the wall when only the training figure is missing', () => {
    api.getSummaryCompare.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(cardText(0)).toBe("This week's training Nothing yet this week");
    expect(items().length).toBe(9);
  });

  it('never prints null, undefined or NaN', () => {
    api.getAchievements.and.returnValue(
      of({ achievements: [{ code: 'NEW_ONE', title: 'Brand new', unlocked: true, unlockedAt: null, progress: 1 }] })
    );
    api.getSummaryCompare.and.returnValue(of(compare(null, null)));

    fixture.detectChanges();

    const all = root().textContent ?? '';
    expect(all).not.toMatch(/null|undefined|NaN/);
    expect(cardText(1)).toBe('Badges 1 of 1 earned Brand new');
  });
});
