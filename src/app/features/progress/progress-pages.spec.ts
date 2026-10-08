import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { CoachStore } from '../../core/coach/coach.store';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { AccountDataService } from '../../core/account-data.service';
import { overview } from '../nutrition/nutrients/nutrients-testing.spec';
import { NutrientsService } from '../nutrition/nutrients/nutrients.service';
import { FoodPage } from './food/food.page';
import { balanceHeadline, barsHeadline, changeWord, foodHeroStats, foodSentence, foodVerdict, macroSentence, macroWord, percentAgainst } from './food/food-figures';
import { clockTime } from './food/food-meals-section.component';
import { GoalPage } from './goal/goal.page';
import { bodySentence, daysEarly, goalHeroStats, goalSentence, goalSummaryLines, goalTitle, goalVerdict, paceSentence, rateWord, weightSentence } from './goal/goal-figures';
import { weightChartGeometry } from './goal/goal-weight-chart.component';
import { paceGeometry } from './goal/pace-chart.component';
import { mapFoodProgress, mapGoalProgress } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService, mergeFood } from './progress-api.service';
import { isSoFar } from './reviews/review-item.component';
import { FOOD_WIRE, GOAL_WIRE, TODAY, foodData, goalData, progressApi, timezoneStub } from './progress-testing.spec';
import { EnergyWeek } from './energy/energy.models';

/** An energy week with eaten minus used equal to the balance given. */
function energyWeek(weekStart: string, status: EnergyWeek['status'], daysLogged: number, balance: number): EnergyWeek {
  return {
    weekStart, weekEnd: weekStart, status, daysLogged, bmrKcal: 1700, bmrEstimated: false, restingFactor: 1.2,
    average: { eaten: 2200 + balance, resting: 2000, workouts: 200, used: 2200, balance },
    mealSplit: null, weeklyKgEquivalent: null, days: [], weeks: []
  };
}

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
      'Now|71.2|−1.6 kg in 4 weeks',
      'A week|−0.41|was −0.28 kg a week',
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
    expect(goalVerdict(goal, TODAY)).toEqual({ text: 'Ahead of plan.', tone: 'good' });
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
    const page = weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false, 700)!;
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

  it('starts the weight chart at the first day of the chosen range and leaves older weigh-ins out', () => {
    const goal = goalData();
    const draw = (since: string) => weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false, 700, since)!;
    const threeMonths = draw('2026-07-05');
    const sixMonths = draw('2026-04-05');
    const oneMonth = draw('2026-07-12');
    // A longer range puts the same weigh-ins further right, so the axis has been re-scaled.
    expect(sixMonths.first.x).toBeGreaterThan(threeMonths.first.x);
    expect(sixMonths.labels.map((m) => m.text)).not.toEqual(threeMonths.labels.map((m) => m.text));
    // A shorter range leaves the weigh-ins before it out of the line.
    expect(threeMonths.first.text).toBe('74.6');
    expect(oneMonth.first.text).toBe('71.4');
    expect(weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false, 700, '2026-10-02')).toBeNull();
  });

  it('shortens the goal label under 560 px of plot and keeps the goal above the line and the pace below it', () => {
    const goal = goalData();
    const narrow = weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false, 600)!;
    expect(narrow.goal?.text).toBe('Goal 68 kg · 11 Dec');
    const wide = weightChartGeometry(goal.weight, goal.goal, TODAY, 280, false, false, 700)!;
    expect(wide.goal?.text).toBe('Goal 68.0 kg by 11 Dec');
    for (const g of [narrow, wide]) {
      expect(g.goal!.labelY).toBeLessThan(g.goal!.y);
      expect(g.projection!.labelY).toBeGreaterThan(g.goal!.y);
      // The pace label stays clear of the axis row below it and inside the plot.
      expect(g.goal!.y + 22).toBeLessThanOrEqual(g.bottom);
      expect(g.projection!.labelX).toBeGreaterThanOrEqual(g.x0);
    }
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

  it('judges the four weeks against the calorie target: on target within 5 %, else under or over', () => {
    const food = foodData();
    expect(foodVerdict(food, 30, 2100)).toEqual({ text: 'On target.', tone: 'good' });
    expect(foodVerdict(food, 30, 2123)).toEqual({ text: 'On target.', tone: 'good' });
    expect(foodVerdict(food, 30, 2400)).toEqual({ text: 'Under target.', tone: 'ink' });
    expect(foodVerdict(food, 30, 1800)).toEqual({ text: 'Over target.', tone: 'ink' });
    const gaps = { ...food, hero: { ...food.hero, daysLogged: { value: 12, previous: 24, days: 30 } } };
    expect(foodVerdict(gaps, 30, 2100).text).toBe('Logging gaps.');
    const bare = { ...food, hero: { ...food.hero, balancePerDay: { value: null, daysLogged: null } } };
    expect(foodVerdict(bare, 30, null).text).toBe('Too early to judge.');
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
    expect(foodSentence(food, 30)).toBe('You ate 2,123 kcal a day and logged 26 of 30 days.');
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

  it('reads the balance figure from the bars week and names that week', () => {
    const fallback = { week: energyWeek('2026-09-21', 'OK', 6, 7), label: 'Week of 21 Sept', when: 'in the week of 21 Sept' };
    const stat = foodHeroStats(foodData(), 30, undefined, fallback)[2];
    expect(`${stat.label}|${stat.value} ${stat.unit}|${stat.context}`).toBe('Over what you used|7 kcal|a day in the week of 21 Sept');
    const now = { week: energyWeek('2026-09-28', 'OK', 5, -279), label: 'This week', when: 'this week' };
    expect(foodHeroStats(foodData(), 30, undefined, now)[2].context).toBe('a day this week, 180 the week before');
    expect(foodHeroStats(foodData(), 30, undefined, null)[2].value).toBe('–');
    expect(barsHeadline(fallback)).toEqual({ value: '7', words: 'kcal a day over what you used', when: 'in the week of 21 Sept' });
    expect(barsHeadline(null)).toBeNull();
  });
});

describe('progress pages', () => {
  let api: jasmine.SpyObj<ProgressApiService>;
  let coach: { askAboutCard: jasmine.Spy };
  let nutrientsRead: jasmine.Spy;
  let fragment: string | null;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    query = new BehaviorSubject(convertToParamMap({}));
    api = progressApi();
    coach = { askAboutCard: jasmine.createSpy('askAboutCard') };
    nutrientsRead = jasmine.createSpy('getAll').and.callFake(() => throwError(() => new Error('off')));
    fragment = null;
    spyOn(Element.prototype, 'scrollIntoView');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProgressApiService, useValue: api },
        { provide: CoachStore, useValue: coach },
        { provide: UserTimezoneService, useValue: timezoneStub },
        { provide: NutrientsService, useValue: { getAll: nutrientsRead } },
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

  /** The days a nutrients read covered, from its from and to. */
  const spanOf = (spy: jasmine.Spy): number => {
    const [from, to] = spy.calls.mostRecent().args as [string, string];
    return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  };

  function render<T>(type: new (...args: never[]) => T): { fixture: ComponentFixture<T>; el: HTMLElement } {
    const fixture = TestBed.createComponent(type as never) as ComponentFixture<T>;
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('GoalPage', () => {
    it('shows the verdict, the four figures, highlights and every section with its sentence', () => {
      const { el } = render(GoalPage);
      expect(text(el.querySelector('app-detail-head h1'))).toBe('Ahead of plan.');
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
      // Two reads: the page's own four weeks, and the weight chart's three months.
      expect(api.getGoal).toHaveBeenCalledTimes(2);
      expect(api.getGoal).toHaveBeenCalledWith('2026-09-06', TODAY);
      expect(api.getGoal).toHaveBeenCalledWith('2026-07-05', TODAY);
      expect(texts(el, 'app-detail-head app-ink-switch button')).toEqual(['4 weeks', '3 months', '1 year']);
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
      expect(text(el.querySelector('#weight .ask'))).toBe('Ask');
    });

    it('shows body tiles with their change, and not enough data for a missing one', () => {
      const { el } = render(GoalPage);
      const tiles = el.querySelectorAll('app-goal-body-section .tile');
      expect(text(tiles[0].querySelector('.value'))).toBe('83.8 cm');
      expect(text(tiles[1].querySelector('.change'))).toBe('−1.1 points');
      expect(text(tiles[2])).toContain('Not enough data yet');
    });

    it('lists every measurement as a table behind All measurements, and folds it with Fewer', () => {
      const { fixture, el } = render(GoalPage);
      const toggle = () => el.querySelectorAll<HTMLButtonElement>('app-goal-body-section .link')[1];
      expect(text(toggle())).toBe('All measurements ›');
      toggle().click();
      fixture.detectChanges();
      expect(el.querySelector('app-goal-measurements-table')).not.toBeNull();
      expect(el.querySelector('app-body-page')).toBeNull();
      expect(text(toggle())).toBe('Fewer ›');
      toggle().click();
      fixture.detectChanges();
      expect(el.querySelector('app-goal-measurements-table')).toBeNull();
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
      expect(rows[0].querySelectorAll('.strip .dot').length).toBe(28);
      expect(texts(rows[0] as HTMLElement, '.dates span')).toEqual(['6 Sept', '3 Oct']);
      // The week of 28 Sept holds today, so it is under way: in neither count and not met.
      expect(text(rows[1].querySelector('.count'))).toBe('0 of 1 weeks');
      expect(rows[1].querySelectorAll('.box.met').length).toBe(0);
      const current = rows[1].querySelectorAll('.box.current');
      expect(current.length).toBe(1);
      expect(current[0].getAttribute('title')).toBe('this week, in progress');
      expect(text(current[0])).toBe('4');
      expect(texts(rows[1] as HTMLElement, '.ends span')).toEqual(['7 Sept', '28 Sept']);
      expect(el.querySelector('app-goal-other-goals a')?.getAttribute('href')).toBe('/me#goal-lifecycle');
      expect(text(el.querySelector('#other-goals .sentence'))).toContain('Protein a day was met on 19 of 26 logged days.');
    });

    it('asks again for a longer weight range, written as ink text', () => {
      const { fixture, el } = render(GoalPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('#weight app-ink-switch button');
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      const before = texts(el, 'app-detail-head dd');
      const pageReads = api.getGoal.calls.allArgs().filter(([from]) => from === '2026-09-06').length;
      buttons[2].click();
      fixture.detectChanges();
      expect(api.getGoal).toHaveBeenCalledWith('2025-10-04', TODAY);
      // The chart range reads for the chart only: the figures and the page read stay as they were.
      expect(api.getGoal.calls.allArgs().filter(([from]) => from === '2026-09-06').length).toBe(pageReads);
      expect(texts(el, 'app-detail-head dd')).toEqual(before);
    });

    it('moves the chart window and the selected range together when 6 months is chosen', () => {
      const { fixture, el } = render(GoalPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('#weight app-ink-switch button');
      expect(texts(el, '#weight app-ink-switch button')).toEqual(['3 months', '6 months', '1 year', 'All']);
      const x = () => el.querySelector('#weight app-goal-weight-chart circle.start')!.getAttribute('cx');
      const before = x();
      buttons[1].click();
      fixture.detectChanges();
      TestBed.tick();
      fixture.detectChanges();
      expect(api.getGoal).toHaveBeenCalledWith('2026-04-05', TODAY);
      expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
      expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
      expect(x()).not.toBe(before);
    });

    it('reads the page again for a longer period, and the head figures follow it', () => {
      const { fixture, el } = render(GoalPage);
      el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button')[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getGoal).toHaveBeenCalledWith('2026-07-05', TODAY);
      expect(text(el.querySelector('app-detail-head .eyebrow'))).toContain('THE LAST 3 MONTHS');
      expect(text(el.querySelector('app-detail-head .sentence'))).toContain('in three months');
      expect(el.querySelector('app-detail-head')).not.toBeNull();
    });

    it('keeps the compared figures when the chart has a longer range than the page', () => {
      const { el } = render(GoalPage);
      expect(texts(el, 'app-detail-head .context')).toContain('−1.6 kg in 4 weeks');
      expect(texts(el, 'app-detail-head .context')).toContain('was −0.28 kg a week');
      expect(texts(el, 'app-detail-head .context')).not.toContain('No earlier data');
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
      expect(text(el.querySelector('app-detail-head .sentence'))).toBe('You ate 2,123 kcal a day and logged 26 of 30 days.');
      expect(texts(el, 'app-detail-head dt')).toEqual(['Eaten a day', 'Protein a day', 'Under what you used', 'Days logged']);
      expect(texts(el, 'app-detail-section h2')).toEqual(['Highlights', 'Energy', 'Macros', 'Plate', 'Meals', 'Nutrients', 'Habits']);
      expect(texts(el, 'app-contents-rail .item')).toEqual(['Highlights', 'Energy', 'Macros', 'Plate', 'Meals', 'Nutrients', 'Habits']);
      expect(texts(el, 'app-highlights .kicker')).toEqual(['Protein', 'Nutrients']);
      expect(api.getFood).toHaveBeenCalledOnceWith('2026-09-06', TODAY, 'week');
    });

    it('names the earlier week in the energy headline and the head figure when nothing was logged this week', () => {
      api.getFood.and.callFake(() => {
        const food = foodData();
        return of({ ...food, hero: { ...food.hero, balancePerDay: { value: 283, daysLogged: 1 } }, energy: { ...food.energy, thisWeek: energyWeek('2026-09-28', 'TOO_FEW_DAYS', 1, 283) } });
      });
      api.getEnergyWeek.and.callFake((monday: string) => of(monday === '2026-09-21' ? energyWeek('2026-09-21', 'OK', 6, 7) : null));
      const { fixture, el } = render(FoodPage);
      fixture.detectChanges();
      expect(text(el.querySelector('#energy .headline strong'))).toBe('7');
      expect(text(el.querySelector('#energy .headline span'))).toBe('kcal a day over what you used in the week of 21 Sept');
      expect(texts(el, 'app-detail-head dt')[2]).toBe('Over what you used');
      expect(text(el.querySelector('app-detail-head'))).toContain('a day in the week of 21 Sept');
      expect(text(el)).not.toContain('283');
    });

    it('heads the page with On target when the four weeks sit within 5 % of the calorie goal', () => {
      api.getGoal.and.callFake(() => of(mapGoalProgress({ ...GOAL_WIRE, otherGoals: [{ type: 'CALORIES', target: 2100, unit: 'kcal', metDays: 20, loggedDays: 26 }] })));
      const { el } = render(FoodPage);
      expect(text(el.querySelector('app-detail-head h1'))).toBe('On target.');
      expect(text(el.querySelector('app-detail-head .sentence'))).toBe('You ate 2,123 kcal a day and logged 26 of 30 days.');
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

    it('opens the Diary from the Macros and Meals sections', () => {
      const { el } = render(FoodPage);
      const door = (id: string) => el.querySelector<HTMLAnchorElement>(`#${id} a.door-link`);
      expect(text(door('macros'))).toBe("Today's budget ›");
      expect(door('macros')?.getAttribute('href')).toBe('/nutrition');
      expect(text(door('meals'))).toBe('Diary meals ›');
      expect(door('meals')?.getAttribute('href')).toBe('/nutrition');
    });

    it('asks again for a longer period and keeps it in the address', () => {
      const { fixture, el } = render(FoodPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button');
      expect(texts(el, 'app-detail-head app-ink-switch button')).toEqual(['4 weeks', '3 months', '1 year']);
      buttons[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getFood).toHaveBeenCalledWith('2026-07-05', TODAY, 'month');
      expect(text(el.querySelector('app-detail-head .eyebrow'))).toContain('THE LAST 3 MONTHS');
    });

    it('reads weeks at 4 weeks and calendar months at 3 months and 1 year', () => {
      const { fixture, el } = render(FoodPage);
      const buttons = el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button');
      expect(api.getFood.calls.mostRecent().args[2]).toBe('week');
      buttons[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getFood.calls.mostRecent().args).toEqual(['2026-07-05', TODAY, 'month']);
      buttons[2].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getFood.calls.mostRecent().args).toEqual(['2025-10-05', TODAY, 'month']);
      expect(text(el.querySelector('#energy .weekly strong'))).toBe('The daily balance, month by month');
      buttons[0].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(api.getFood.calls.mostRecent().args[2]).toBe('week');
      expect(text(el.querySelector('#energy .weekly strong'))).toBe('The daily balance, week by week');
    });

    it('draws month points with the current month so far and the months named on the axis', () => {
      api.getFood.and.callFake((_from: string, _to: string, granularity = 'week') =>
        of(
          mergeFood(
            mapFoodProgress(
              {
                ...FOOD_WIRE,
                energy: {
                  thisWeek: null,
                  weeklyBalance: [
                    { month: '2026-07', balance: -150, daysLogged: 22, current: false },
                    { month: '2026-08', balance: -90, daysLogged: 25, current: false },
                    { month: '2026-09', balance: null, daysLogged: 0, current: false },
                    { month: '2026-10', balance: -279, daysLogged: 3, partial: true }
                  ]
                },
                habits: { loggedDays: 26, loggedDaysPerMonth: [{ month: '2026-08', days: 25 }, { month: '2026-09', days: 0 }] }
              },
              granularity as 'week' | 'month'
            ),
            null
          )
        )
      );
      const { fixture, el } = render(FoodPage);
      el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button')[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      const axis = Array.from(el.querySelectorAll('#energy app-week-bars text.axis')).map((node) => (node.textContent ?? '').trim());
      expect(axis).toContain('Oct');
      expect(axis).not.toContain('Jul');
      expect(el.querySelectorAll('#energy app-week-bars rect').length).toBe(3);
      expect(text(el.querySelector('#energy app-week-bars .key'))).toContain('this month so far');
      expect(el.querySelectorAll('#habits app-week-bars rect').length).toBe(2);
    });

    it('lays out all 12 months of a year in every chart even when only two months have data', () => {
      api.getFood.and.callFake((_from: string, _to: string, granularity = 'week') =>
        of(
          mergeFood(
            mapFoodProgress(
              {
                ...FOOD_WIRE,
                energy: {
                  thisWeek: null,
                  weeklyBalance: [
                    { month: '2026-09', balance: -90, daysLogged: 25, current: false },
                    { month: '2026-10', balance: -279, daysLogged: 3, partial: true }
                  ]
                },
                macros: {
                  protein: { firstWeek: 150, thisWeek: 136, target: 140, series: [{ month: '2026-09', value: 150 }, { month: '2026-10', value: 136, partial: true }] },
                  carbs: null,
                  fat: null,
                  summary: []
                },
                habits: { loggedDays: 26, loggedDaysPerMonth: [] }
              },
              granularity as 'week' | 'month'
            ),
            null
          )
        )
      );
      const { fixture, el } = render(FoodPage);
      el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button')[2].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(el.querySelectorAll('#energy app-week-bars rect').length).toBe(12);
      const axis = Array.from(el.querySelectorAll('#energy app-week-bars text.axis')).map((node) => (node.textContent ?? '').trim());
      expect(axis).toContain('Nov');
      expect(axis).toContain('Oct');
      const trend = el.querySelector('#macros app-small-trend');
      expect(trend?.querySelectorAll('polyline').length).toBe(1);
      const dates = Array.from(trend?.querySelectorAll('.dates span') ?? []).map((node) => (node.textContent ?? '').trim());
      expect(dates).toEqual(['Nov', 'Oct']);
    });

    it('takes the page period for the nutrients: 30 days at 4 weeks, 90 at 3 months, 90 with a caption at 1 year', () => {
      nutrientsRead.and.callFake(() => of(overview()));
      const { fixture, el } = render(FoodPage);
      expect(spanOf(nutrientsRead)).toBe(30);
      const buttons = el.querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button');
      buttons[1].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(spanOf(nutrientsRead)).toBe(90);
      expect(el.querySelector('#nutrients .caption')).toBeNull();
      expect(el.querySelector<HTMLAnchorElement>('#nutrients .side a:last-child')?.getAttribute('href')).toBe('/nutrition/nutrients?range=90');
      buttons[2].click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(spanOf(nutrientsRead)).toBe(90);
      expect(text(el.querySelector('#nutrients .caption'))).toBe('Last 3 months');
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
