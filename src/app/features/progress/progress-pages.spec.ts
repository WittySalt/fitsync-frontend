import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { CoachStore } from '../../core/coach/coach.store';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { AccountDataService } from '../../core/account-data.service';
import { NutrientsService } from '../nutrition/nutrients/nutrients.service';
import { FoodPage } from './food/food.page';
import { balanceHeadline, changeWord, foodHeroStats, foodSentence, foodVerdict, macroSentence, macroWord, percentAgainst } from './food/food-figures';
import { clockTime } from './food/food-meals-section.component';
import { GoalPage } from './goal/goal.page';
import { bodySentence, daysEarly, goalHeroStats, goalSentence, goalSummaryLines, goalTitle, goalVerdict, paceSentence, rateWord, weightSentence } from './goal/goal-figures';
import { weightChartGeometry } from './goal/goal-weight-chart.component';
import { paceGeometry } from './goal/pace-chart.component';
import { mapFoodProgress, mapGoalProgress } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService, mergeFood } from './progress-api.service';
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

  it('gives the verdict from the goal and the weight, in the order of the rules', () => {
    const goal = goalData();
    expect(goalVerdict(goal, TODAY)).toEqual({ text: 'Ahead of schedule.', tone: 'good' });
    const onTime = { ...goal, hero: { ...goal.hero, projectedDate: { value: '2026-12-08', previous: null } } };
    expect(goalVerdict(onTime, TODAY).text).toBe('On course.');
    const late = { ...goal, hero: { ...goal.hero, projectedDate: { value: '2027-01-10', previous: null } } };
    expect(goalVerdict(late, TODAY)).toEqual({ text: 'Behind schedule.', tone: 'ink' });
    expect(goalVerdict(goal, '2026-12-20')).toEqual({ text: 'Past your date.', tone: 'ink' });
    const still = { ...goal, hero: { ...goal.hero, weeklyRate: { value: -0.02, previous: -0.3 } } };
    expect(goalVerdict(still, TODAY).text).toBe('Holding steady.');
    const reached = { ...goal, hero: { ...goal.hero, nowKg: 67.8 } };
    expect(goalVerdict(reached, TODAY)).toEqual({ text: 'Goal reached.', tone: 'good' });
    expect(goalVerdict({ ...goal, goal: null }, TODAY).text).toBe('No goal yet.');
    expect(goalVerdict(mapGoalProgress({}), TODAY).text).toBe('Start logging.');
  });

  it('writes the sentence and each section line from the figures of the page', () => {
    const goal = goalData();
    expect(goalSentence(goal)).toBe('71.2 kg now, down 1.6 kg in four weeks. At this pace you reach 68.0 kg on 25 Nov, 16 days before your date.');
    expect(weightSentence(goal)).toBe('Faster from 14 Sept. At this pace you reach 68.0 kg on 25 Nov, 16 days before your date.');
    expect(bodySentence(goal.body)).toBe('Waist fell 2.1 cm and body fat fell 1.1 points over the same weeks.');
    expect(paceSentence(goal)).toBe('The scale shows −2.7 kg since the start and your food log accounts for −0.7 kg. The date is worked out from the scale.');
    expect(goalSentence(mapGoalProgress({}))).toContain('Log your weight');
  });

  it('says there is no earlier data instead of showing a change from nothing', () => {
    const goal = goalData();
    const bare = { ...goal, hero: { ...goal.hero, changeKg: null, weeklyRate: { value: -0.41, previous: null }, projectedDate: { value: '2026-11-25', previous: null } } };
    expect(goalHeroStats(bare).map((s) => s.context)).toEqual(['No earlier data', 'No earlier data', 'No earlier data', 'to 11 Dec']);
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
    expect(page.labels.map((m) => m.text)).toContain('Oct');
    const card = weightChartGeometry(goal.weight, goal.goal, TODAY, 190, true, false)!;
    expect(card.dots).toEqual([]);
    expect(card.mark).toBeNull();
    expect(card.projection?.text).toBe('25 Nov');
    expect(weightChartGeometry({ ...goal.weight, weekly: [], daily: [] }, null, TODAY, 280, false, false)).toBeNull();
  });

  it('draws the pace from zero, skipping weeks without a figure', () => {
    const g = paceGeometry(goalData().pace.weeks, 200)!;
    expect(g.expected.end?.text).toBe('−0.7 kg');
    expect(g.actual.end?.text).toBe('−2.7 kg');
    expect(g.ticks.some((t) => t.zero)).toBeTrue();
    expect(paceGeometry([{ weekStart: '2026-09-07', expectedKg: null, actualKg: null }], 200)).toBeNull();
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

  it('gives the verdict: logging gaps first, then under or over what you use', () => {
    const food = foodData();
    expect(foodVerdict(food, 30)).toEqual({ text: 'Under what you use.', tone: 'good' });
    const over = { ...food, hero: { ...food.hero, balancePerDay: { value: 120, daysLogged: 5 } } };
    expect(foodVerdict(over, 30)).toEqual({ text: 'Over what you use.', tone: 'ink' });
    const gaps = { ...food, hero: { ...food.hero, daysLogged: { value: 12, previous: 24, days: 30 } } };
    expect(foodVerdict(gaps, 30)).toEqual({ text: 'Logging gaps.', tone: 'ink' });
    expect(foodVerdict(mergeFood(mapFoodProgress({}), null), 30).text).toBe('Start logging.');
  });

  it('writes the sentence and the macro line from the figures', () => {
    const food = foodData();
    expect(foodSentence(food, 30)).toBe('You ate 2,123 kcal a day and logged 26 of 30 days. This week you ate 279 kcal a day under what you used.');
    expect(macroSentence(food.macros)).toBe('Protein went from 150 to 136 g a day against a goal of 140 g.');
  });

  it('shows no change from a missing or zero earlier figure', () => {
    const food = foodData();
    const bare = { ...food, hero: { ...food.hero, eatenPerDay: { value: 2123, previous: 0 }, proteinPerDay: { value: 136, previous: null }, daysLogged: { value: 26, previous: null, days: 30 } } };
    const contexts = foodHeroStats(bare, 28, 'the 4 weeks before').map((s) => s.context);
    expect(contexts[0]).toBe('No earlier data');
    expect(contexts[1]).toBe('No earlier data');
    expect(contexts[3]).toBe('No earlier data');
    expect(percentAgainst(10, 0, 28)).toBe('');
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
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    query = new BehaviorSubject(convertToParamMap({}));
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
        { provide: ActivatedRoute, useValue: { queryParamMap: query, snapshot: { get fragment() { return fragment; }, queryParamMap: { get: () => null } } } }
      ]
    });
    // The address is a subject here: writing a period to it changes what the page reads.
    spyOn(TestBed.inject(Router), 'navigate').and.callFake(async (_commands, extras) => {
      const period = (extras?.queryParams as { period?: string | null } | undefined)?.period ?? null;
      query.next(convertToParamMap(period ? { period } : {}));
      return true;
    });
  });

  function render<T>(type: new (...args: never[]) => T): { fixture: ComponentFixture<T>; el: HTMLElement } {
    const fixture = TestBed.createComponent(type as never) as ComponentFixture<T>;
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('GoalPage', () => {
    it('shows the verdict, the four figures, highlights and every section with its sentence', () => {
      const { el } = render(GoalPage);
      expect(text(el.querySelector('app-detail-head h1'))).toBe('Ahead of schedule.');
      expect(text(el.querySelector('app-detail-head .eyebrow'))).toContain('GOAL · THE LAST 4 WEEKS');
      expect(text(el.querySelector('app-detail-head .sentence'))).toContain('71.2 kg now, down 1.6 kg in four weeks.');
      expect(texts(el, 'app-detail-head dt')).toEqual(['Now', 'A week', 'Projected', 'Days left']);
      expect(el.querySelector('app-detail-head .hero')).toBeNull();
      expect(el.querySelectorAll('app-highlights .card').length).toBe(1);
      expect(texts(el, 'app-detail-section h2')).toEqual(['Highlights', 'Weight', 'Body', 'Pace', 'Other goals']);
      expect(texts(el, 'app-contents-rail .item')).toEqual(['Highlights', 'Weight', 'Body', 'Pace', 'Other goals']);
      expect(text(el.querySelector('#weight .sentence'))).toContain('Faster from 14 Sept.');
      expect(el.querySelector('#weight app-goal-weight-chart svg')).not.toBeNull();
      expect(el.querySelector('#other-goals app-goal-other-goals, app-goal-other-goals #other-goals')).not.toBeNull();
      expect(el.querySelector('details')).toBeNull();
      expect(api.getGoal).toHaveBeenCalledOnceWith('2026-07-05', TODAY);
    });

    it('keeps what the old subtitles and notes said in the Ask text of the section', () => {
      const { el } = render(GoalPage);
      el.querySelector<HTMLButtonElement>('#weight .ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ kind: 'GOAL' }),
        jasmine.stringMatching(/It reaches 68\.0 kg on 25 Nov, 16 days before your date\..*weekly line/)
      );
      el.querySelector<HTMLButtonElement>('#pace .ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledWith(jasmine.anything(), jasmine.stringContaining('7,700 kcal a kilo'));
      expect(text(el.querySelector('#weight .ask'))).toBe('Ask about this');
    });

    it('shows body tiles with their change, and not enough data for a missing one', () => {
      const { el } = render(GoalPage);
      const tiles = el.querySelectorAll('app-goal-body-section .tile');
      expect(text(tiles[0].querySelector('.value'))).toBe('83.8 cm');
      expect(text(tiles[1].querySelector('.change'))).toBe('−1.1 points');
      expect(text(tiles[2])).toContain('Not enough data yet');
    });

    it('opens the measurements, with the same form as before, from Record a measurement', () => {
      const { fixture, el } = render(GoalPage);
      el.querySelector<HTMLButtonElement>('app-goal-body-section .link')!.click();
      fixture.detectChanges();
      expect(el.querySelector('app-body-page')).not.toBeNull();
    });

    it('lays each other goal out in three columns over the window the section names, dates at the ends only', () => {
      const { el } = render(GoalPage);
      const rows = el.querySelectorAll('app-goal-other-goals .row');
      expect(texts(rows[0] as HTMLElement, '.name > *')).toEqual(['Protein a day', '140 g · at least']);
      expect(text(rows[0].querySelector('.count'))).toBe('19 of 26 logged days');
      expect(rows[0].querySelector('app-dot-strip')).not.toBeNull();
      expect(rows[0].querySelectorAll('.strip .dot').length).toBe(30);
      expect(texts(rows[0] as HTMLElement, '.dates span')).toEqual(['4 Sept', '3 Oct']);
      expect(text(rows[1].querySelector('.count'))).toBe('1 of 2 weeks');
      expect(rows[1].querySelectorAll('.box.met').length).toBe(1);
      expect(texts(rows[1] as HTMLElement, '.ends span')).toEqual(['7 Sept', '28 Sept']);
      expect(el.querySelector('app-goal-other-goals a')?.getAttribute('href')).toBe('/me#goal-lifecycle');
      expect(text(el.querySelector('#other-goals .sentence'))).toContain('Protein a day was met on 19 of 26 logged days.');
    });

    it('asks again for a longer weight range, written as ink text', () => {
      const { fixture, el } = render(GoalPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('#weight app-ink-switch button');
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      buttons[2].click();
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
      expect(text(empty.querySelector('app-detail-head h1'))).toBe('Start logging.');
      expect(text(empty.querySelector('app-goal-weight-chart'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-pace-chart'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-highlights'))).toContain('Not enough data yet');
    });
  });

  describe('FoodPage', () => {
    it('shows the verdict, the four figures, highlights and every section', () => {
      const { el } = render(FoodPage);
      expect(text(el.querySelector('app-detail-head h1'))).toBe('Under what you use.');
      expect(text(el.querySelector('app-detail-head .eyebrow'))).toContain('FOOD · THE LAST 4 WEEKS');
      expect(text(el.querySelector('app-detail-head .sentence'))).toBe('You ate 2,123 kcal a day and logged 26 of 30 days. This week you ate 279 kcal a day under what you used.');
      expect(texts(el, 'app-detail-head dt')).toEqual(['Eaten a day', 'Protein a day', 'Under what you used', 'Days logged']);
      expect(texts(el, 'app-detail-section h2')).toEqual(['Highlights', 'Energy', 'Macros', 'Plate', 'Meals', 'Nutrients', 'Habits']);
      expect(texts(el, 'app-contents-rail .item')).toEqual(['Highlights', 'Energy', 'Macros', 'Plate', 'Meals', 'Nutrients', 'Habits']);
      expect(texts(el, 'app-highlights .kicker')).toEqual(['Protein', 'Nutrients']);
      expect(api.getFood).toHaveBeenCalledOnceWith('2026-09-06', TODAY);
    });

    it('draws the balance week by week and the macros against their targets', () => {
      const { el } = render(FoodPage);
      expect(texts(el, 'app-week-bars .value')).toEqual(['−180', '−279']);
      expect(text(el.querySelector('#energy .sentence'))).toBe('Under what you used on 2 of 2 weeks, logged days only.');
      expect(text(el.querySelector('app-week-bars .key'))).toBe('The lighter bar is this week so far.');
      const macros = el.querySelectorAll('.macro');
      expect(text(macros[0].querySelector('.target-text'))).toBe('target 140 g');
      expect(text(macros[2])).toContain('Not enough data yet');
      expect(text(el.querySelector('#macros .sentence'))).toBe('Protein went from 150 to 136 g a day against a goal of 140 g.');
      expect(el.querySelector('.summary')).toBeNull();
    });

    it('shows the plate, the meals and the habits from both services', () => {
      const { el } = render(FoodPage);
      expect(texts(el, 'app-food-plate-section .plate .title')).toEqual(['The 4 weeks before', 'The last 4 weeks']);
      expect(text(el.querySelector('app-food-plate-section .change .shares'))).toBe('25% → 40%');
      expect(text(el.querySelector('app-food-meals-section .time'))).toBe('19:20');
      expect(text(el.querySelector('#meals .sentence'))).toBe("Dinner is the biggest meal at 38% of the day's calories, usually around 19:20.");
      expect(text(el.querySelector('app-food-meals-section .food-name'))).toBe('Chicken breast, grilled');
      expect(text(el.querySelector('app-food-nutrients-section .chip'))).toBe('Vitamin D 34%');
      const habits = texts(el, 'app-food-nutrients-section .habit .figure');
      expect(habits).toEqual(['11 of 26', '3']);
      expect(text(el.querySelector('#habits .sentence'))).toContain('Fibre was met on 11 of 26 logged days.');
    });

    it('keeps the window of the nutrients in the Ask text of the section', () => {
      const { el } = render(FoodPage);
      el.querySelector<HTMLButtonElement>('#nutrients .ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'FOOD' }), jasmine.stringContaining('3 Sept to 3 Oct'));
    });

    it('asks again for a longer period and keeps it in the address', () => {
      const { fixture, el } = render(FoodPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button');
      expect(texts(el, 'app-detail-head app-ink-switch button')).toEqual(['4 weeks', '3 months', '1 year']);
      buttons[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getFood).toHaveBeenCalledWith('2026-07-05', TODAY);
      expect(text(el.querySelector('app-detail-head .eyebrow'))).toContain('THE LAST 3 MONTHS');
    });

    it('keeps the head on screen while the next period loads', () => {
      const { fixture, el } = render(FoodPage);
      api.getFood.and.returnValue(new Observable<FoodProgress>());
      el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button')[2].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(el.querySelector('app-detail-head')).not.toBeNull();
      expect(el.querySelector('.skeleton')).toBeNull();
    });

    it('shows a skeleton while loading, a retry after an error, and not enough data without food', () => {
      api.getFood.and.returnValue(new Observable<FoodProgress>());
      expect(render(FoodPage).el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
      api.getFood.and.returnValue(throwError(() => new Error('down')));
      expect(text(render(FoodPage).el.querySelector('app-state-panel'))).toContain('Your food could not be loaded');
      api.getFood.and.returnValue(of(mergeFood(mapFoodProgress({}), null)));
      const empty = render(FoodPage).el;
      expect(text(empty.querySelector('app-detail-head h1'))).toBe('Start logging.');
      expect(text(empty.querySelector('app-food-plate-section'))).toContain('Not enough data yet');
      expect(text(empty.querySelector('app-food-meals-section'))).toContain('Not enough data yet');
    });
  });

  describe('weekly reviews', () => {
    it('marks a week as so far from the server or from its end date', () => {
      const review: WeeklyReview = { weekStart: '2026-09-21', weekEnd: '2026-09-27', current: false, status: 'READY', headline: '', body: '', facts: [] };
      expect(isSoFar(review, TODAY)).toBeFalse();
      expect(isSoFar({ ...review, current: true }, TODAY)).toBeTrue();
      expect(isSoFar({ ...review, weekEnd: '2026-10-04' }, TODAY)).toBeTrue();
    });
  });
});
