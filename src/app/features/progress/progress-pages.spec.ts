import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { CoachStore } from '../../core/coach/coach.store';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { AccountDataService } from '../../core/account-data.service';
import { NutrientsService } from '../nutrition/nutrients/nutrients.service';
import { FoodPage } from './food/food.page';
import { balanceHeadline, changeWord, foodHeroStats, macroWord, percentAgainst } from './food/food-figures';
import { clockTime } from './food/food-meals-section.component';
import { GoalPage } from './goal/goal.page';
import { daysEarly, goalHeroStats, goalSummaryLines, goalTitle, rateWord } from './goal/goal-figures';
import { weightChartGeometry } from './goal/goal-weight-chart.component';
import { paceGeometry } from './goal/pace-chart.component';
import { mapFoodProgress, mapGoalProgress } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService, mergeFood } from './progress-api.service';
import { ReviewsPage } from './reviews/reviews.page';
import { isSoFar } from './reviews/review-item.component';
import { TODAY, foodData, goalData, progressApi, timezoneStub } from './progress-testing.spec';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const texts = (el: HTMLElement, selector: string) => Array.from(el.querySelectorAll(selector)).map((node) => text(node));

describe('goal figures', () => {
  it('reads the rate in the direction of the goal', () => {
    expect(rateWord(-0.41, -0.28, true)).toBe('faster');
    expect(rateWord(-0.2, -0.28, true)).toBe('slower');
    expect(rateWord(-0.41, -0.4, true)).toBe('steady');
    expect(rateWord(0.3, 0.2, false)).toBe('faster');
    expect(rateWord(-0.3, null, true)).toBe('steady');
  });

  it('works out the title, days early and the hero figures', () => {
    const goal = goalData();
    expect(goalTitle(goal)).toBe('68.0 kg by 11 Dec');
    expect(daysEarly(goal)).toBe(16);
    expect(goalHeroStats(goal).map((s) => `${s.label}|${s.value}|${s.context}`)).toEqual([
      'Now|71.2|−1.6 kg on 4 weeks before',
      'A week|−0.41|was −0.28',
      'Projected|25 Nov|was 10 Jan 2027',
      'Days left|69|to 11 Dec'
    ]);
    expect(goalSummaryLines(goal).map((l) => `${l.figure} ${l.text}`)).toEqual([
      '−0.41 kg a week, the last 28 days',
      'On course for 25 Nov, 16 days early',
      'Waist −2.1 cm in 4 weeks'
    ]);
  });

  it('shows dashes for figures the server did not send', () => {
    const empty = mapGoalProgress({});
    expect(goalTitle(empty)).toBe('No weight goal yet');
    expect(goalHeroStats(empty).map((s) => s.value)).toEqual(['–', '–', '–', '–']);
    expect(goalSummaryLines(empty)).toEqual([]);
  });

  it('draws the weight chart from the weekly line with the goal and the projection', () => {
    const goal = goalData();
    const page = weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false)!;
    expect(page.goal?.text).toBe('Goal 68.0 kg by 11 Dec');
    expect(page.projection?.text).toBe('25 Nov at this pace');
    expect(page.mark?.text).toBe('Faster from 14 Sept');
    expect(page.dots.length).toBe(2);
    expect(page.months.map((m) => m.text)).toContain('1 Oct');
    const card = weightChartGeometry(goal.weight, goal.goal, TODAY, 190, true, false)!;
    expect(card.dots).toEqual([]);
    expect(card.mark).toBeNull();
    expect(card.projection?.text).toBe('25 Nov');
    expect(weightChartGeometry({ ...goal.weight, weekly: [], daily: [] }, null, TODAY, 280, false, false)).toBeNull();
  });

  it('draws the pace from zero, skipping weeks without a figure', () => {
    const g = paceGeometry(goalData().pace.weeks, 200, false)!;
    expect(g.expected.end?.text).toBe('−0.7 kg');
    expect(g.actual.end?.text).toBe('−2.7 kg');
    expect(g.ticks.some((t) => t.zero)).toBeTrue();
    expect(paceGeometry([{ weekStart: '2026-09-07', expectedKg: null, actualKg: null }], 200, false)).toBeNull();
  });
});

describe('food figures', () => {
  it('reads changes, macros and the balance in words', () => {
    expect(changeWord(2123, 2189)).toBe('steady');
    expect(changeWord(136, 150)).toBe('down');
    expect(macroWord(foodData().macros.protein)).toBe('down');
    expect(macroWord(null)).toBe('');
    expect(percentAgainst(136, 150, 30)).toBe('−9% on the 30 days before');
    expect(balanceHeadline(-279)).toEqual({ value: '279', words: 'kcal a day under what you used' });
    expect(balanceHeadline(120)?.words).toBe('kcal a day over what you used');
    expect(balanceHeadline(null)).toBeNull();
    expect(clockTime(1160)).toBe('19:20');
  });

  it('builds the hero figures against the period before', () => {
    expect(foodHeroStats(foodData(), 30).map((s) => `${s.label}|${s.value} ${s.unit}|${s.context}`)).toEqual([
      'Eaten a day|2,123 kcal|−3% on the 30 days before',
      'Protein a day|136 g|−9% on the 30 days before',
      'Under what you used|279 kcal|a day this week, 180 the week before',
      'Days logged|26 of 30|+2 on the 30 days before'
    ]);
  });
});

describe('progress pages', () => {
  let api: jasmine.SpyObj<ProgressApiService>;
  let coach: { askAboutCard: jasmine.Spy };
  let fragment: string | null;

  beforeEach(() => {
    api = progressApi();
    coach = { askAboutCard: jasmine.createSpy('askAboutCard') };
    fragment = null;
    spyOn(Element.prototype, 'scrollIntoView');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProgressApiService, useValue: api },
        { provide: CoachStore, useValue: coach },
        { provide: UserTimezoneService, useValue: timezoneStub },
        { provide: NutrientsService, useValue: { getAll: () => throwError(() => new Error('off')) } },
        { provide: AccountDataService, useValue: { getAccountCenter: () => new Observable(), listBodyMetrics: () => new Observable() } },
        { provide: ActivatedRoute, useValue: { snapshot: { get fragment() { return fragment; }, queryParamMap: { get: () => null } } } }
      ]
    });
  });

  function render<T>(type: new (...args: never[]) => T): { fixture: ComponentFixture<T>; el: HTMLElement } {
    const fixture = TestBed.createComponent(type as never) as ComponentFixture<T>;
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('GoalPage', () => {
    it('shows the hero, highlights, weight, body, pace and other goals', () => {
      const { el } = render(GoalPage);
      expect(text(el.querySelector('app-progress-hero h1'))).toBe('68.0 kg by 11 Dec');
      expect(texts(el, 'app-progress-hero dt')).toEqual(['Now', 'A week', 'Projected', 'Days left']);
      expect(el.querySelectorAll('app-highlights .card').length).toBe(1);
      expect(texts(el, 'app-section-card h2')).toEqual(['Weight', 'Body', 'Pace', 'Other goals']);
      expect(el.querySelector('app-goal-weight-chart svg')).not.toBeNull();
      expect(text(el.querySelector('details p'))).toContain('It reaches 68.0 kg on 25 Nov, 16 days before your date.');
      expect(el.querySelector('#other-goals app-goal-other-goals')).not.toBeNull();
      expect(api.getGoal).toHaveBeenCalledOnceWith('2026-07-05', TODAY);
    });

    it('shows body tiles with their change, and not enough data for a missing one', () => {
      const { el } = render(GoalPage);
      const tiles = el.querySelectorAll('app-goal-body-section .tile');
      expect(text(tiles[0].querySelector('.change'))).toBe('−1.1 points');
      expect(text(tiles[1].querySelector('.value'))).toBe('83.8 cm');
      expect(text(tiles[2])).toContain('Not enough data yet');
    });

    it('opens the measurements, with the same form as before, from Record a measurement', () => {
      const { fixture, el } = render(GoalPage);
      el.querySelector<HTMLButtonElement>('app-goal-body-section .record')!.click();
      fixture.detectChanges();
      expect(el.querySelector('app-body-page')).not.toBeNull();
    });

    it('shows the other goals with dots, weeks and a link to change them in Me', () => {
      const { el } = render(GoalPage);
      const rows = el.querySelectorAll('app-goal-other-goals .row');
      expect(texts(rows[0] as HTMLElement, '.name > *')).toEqual(['Protein a day', '140 g · at least']);
      expect(text(rows[0].querySelector('.count'))).toBe('19 of 26 logged days');
      expect(rows[0].querySelector('app-dot-strip')).not.toBeNull();
      expect(text(rows[1].querySelector('.count'))).toBe('1 of 2 weeks');
      expect(rows[1].querySelectorAll('.box.met').length).toBe(1);
      expect(el.querySelector('app-goal-other-goals a')?.getAttribute('href')).toBe('/me#goal-lifecycle');
    });

    it('asks again for a longer weight range', () => {
      const { fixture, el } = render(GoalPage);
      el.querySelectorAll<HTMLButtonElement>('.ranges button')[2].click();
      fixture.detectChanges();
      expect(api.getGoal).toHaveBeenCalledWith('2025-10-04', TODAY);
    });

    it('scrolls to the other goals when the address asks for them', () => {
      fragment = 'other-goals';
      render(GoalPage);
      TestBed.tick();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('shows skeletons while loading, a retry after an error, and empty sections without data', () => {
      api.getGoal.and.returnValue(new Observable<GoalProgress>());
      expect(render(GoalPage).el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
      api.getGoal.and.returnValue(throwError(() => new Error('down')));
      const failed = render(GoalPage);
      expect(text(failed.el.querySelector('app-state-panel'))).toContain('Your goal could not be loaded');
      api.getGoal.and.returnValue(of(mapGoalProgress({})));
      const empty = render(GoalPage).el;
      expect(text(empty.querySelector('app-progress-hero h1'))).toBe('No weight goal yet');
      expect(text(empty.querySelector('app-goal-weight-chart'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-pace-chart'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-highlights'))).toContain('Not enough data yet');
    });
  });

  describe('FoodPage', () => {
    it('shows the hero, highlights and every section', () => {
      const { el } = render(FoodPage);
      expect(text(el.querySelector('app-progress-hero h1'))).toBe('26 of 30 days logged');
      expect(text(el.querySelector('app-progress-hero p'))).toBe('4 Sept to 3 Oct. Each change is compared with the 30 days before.');
      expect(texts(el, 'app-section-card h2')).toEqual(['Energy', 'Macros', 'Plate', 'Meals', 'Nutrients', 'Habits']);
      expect(texts(el, 'app-highlights .kicker')).toEqual(['Protein', 'Nutrients']);
      expect(api.getFood).toHaveBeenCalledOnceWith('2026-09-04', TODAY);
    });

    it('draws the balance week by week and the macros against their targets', () => {
      const { el } = render(FoodPage);
      expect(texts(el, 'app-week-bars .value')).toEqual(['−180', '−279']);
      expect(text(el.querySelector('.weekly .quiet'))).toBe('Under on 2 of 2 weeks. Logged days only.');
      const macros = el.querySelectorAll('.macro');
      expect(text(macros[0].querySelector('.target-text'))).toBe('target 140 g');
      expect(text(macros[2])).toContain('Not enough data yet');
    });

    it('shows the plate, the meals and the habits from both services', () => {
      const { el } = render(FoodPage);
      expect(texts(el, 'app-food-plate-section .plate .title')).toEqual(['The 30 days before', 'The last 30 days']);
      expect(text(el.querySelector('app-food-plate-section .change .shares'))).toBe('25% → 40%');
      expect(text(el.querySelector('app-food-meals-section .time'))).toBe('19:20');
      expect(text(el.querySelector('app-food-meals-section .food-name'))).toBe('Chicken breast, grilled');
      expect(text(el.querySelector('app-food-nutrients-section .chip'))).toBe('Vitamin D 34%');
      const habits = texts(el, 'app-food-nutrients-section .habit .figure');
      expect(habits).toEqual(['11 of 26', '3']);
      expect(text(el.querySelector('app-food-nutrients-section .sub'))).toContain('3 Sept to 3 Oct');
    });

    it('asks again for a longer period', () => {
      const { fixture, el } = render(FoodPage);
      el.querySelectorAll<HTMLButtonElement>('.periods button')[1].click();
      fixture.detectChanges();
      expect(api.getFood).toHaveBeenCalledWith('2026-07-06', TODAY);
    });

    it('shows a skeleton while loading, a retry after an error, and not enough data without food', () => {
      api.getFood.and.returnValue(new Observable<FoodProgress>());
      expect(render(FoodPage).el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
      api.getFood.and.returnValue(throwError(() => new Error('down')));
      expect(text(render(FoodPage).el.querySelector('app-state-panel'))).toContain('Your food could not be loaded');
      api.getFood.and.returnValue(of(mergeFood(mapFoodProgress({}), null)));
      const empty = render(FoodPage).el;
      expect(text(empty.querySelector('app-progress-hero h1'))).toBe('Your food');
      expect(text(empty.querySelector('app-food-plate-section'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-food-meals-section'))).toContain('Not enough data yet');
    });
  });

  describe('ReviewsPage', () => {
    it('lists the weekly reviews newest first with "so far" on the current week', () => {
      const { el } = render(ReviewsPage);
      const items = el.querySelectorAll('app-review-item');
      expect(items.length).toBe(3);
      expect(text(items[0].querySelector('.badge'))).toBe('so far');
      expect(items[1].querySelector('.badge')).toBeNull();
      expect(text(items[2])).toContain('Not enough happened this week for a review.');
      expect(api.getReviews).toHaveBeenCalledOnceWith(8);
    });

    it('shows a skeleton while loading, a retry after an error, and not enough data without reviews', () => {
      api.getReviews.and.returnValue(new Observable<WeeklyReview[]>());
      expect(render(ReviewsPage).el.querySelector('.skeleton')).not.toBeNull();
      api.getReviews.and.returnValue(throwError(() => new Error('down')));
      expect(text(render(ReviewsPage).el.querySelector('app-state-panel'))).toContain('Try again');
      api.getReviews.and.returnValue(of([]));
      expect(text(render(ReviewsPage).el.querySelector('app-state-panel'))).toContain('Not enough data yet');
    });

    it('marks a week as so far from the server or from its end date', () => {
      const review: WeeklyReview = { weekStart: '2026-09-21', weekEnd: '2026-09-27', current: false, status: 'READY', headline: '', body: '' };
      expect(isSoFar(review, TODAY)).toBeFalse();
      expect(isSoFar({ ...review, current: true }, TODAY)).toBeTrue();
      expect(isSoFar({ ...review, weekEnd: '2026-10-04' }, TODAY)).toBeTrue();
    });
  });
});
