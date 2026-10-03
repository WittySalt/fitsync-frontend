import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { CoachCardContext, CoachReading } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { InsightReadState } from '../../shared/coach/insight/insight-read-state';
import { NutrientsService } from '../nutrition/nutrients/nutrients.service';
import { FoodCardComponent } from './cards/food-card.component';
import { GoalCardComponent } from './cards/goal-card.component';
import { ReviewsCardComponent } from './cards/reviews-card.component';
import { mapFoodProgress, mapGoalProgress } from './progress-api.mappers';
import { FoodProgress, GoalProgress, WeeklyReview } from './progress-api.models';
import { ProgressApiService, mergeFood } from './progress-api.service';
import { progressTabRedirect } from './progress-redirect.guard';
import { PROGRESS_SECTIONS, ProgressPage, RING_MS } from './progress.page';
import { TrainingApiService } from './training/training-api.service';
import { TODAY, goalData, progressApi, timezoneStub } from './progress-testing.spec';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const reading: CoachReading = {
  surface: 'PROGRESS',
  status: 'READY',
  readingId: 'r1',
  period: 'LAST_28_DAYS',
  periodStart: '2026-09-06',
  periodEnd: TODAY,
  facts: [
    { number: 1, key: 'WEEKLY_RATE', label: 'Weekly rate', value: '-0.41', unit: 'kg', numericValue: -0.41, note: '', detail: '', card: 'GOAL' },
    { number: 2, key: 'GOAL', label: 'Goal', value: '68', unit: 'kg', numericValue: 68, note: '', detail: '', card: 'GOAL' },
    { number: 3, key: 'CALORIES_PER_DAY', label: 'Calories per day', value: '2,123', unit: 'kcal', numericValue: 2123, note: '', detail: '', card: 'FOOD' },
    { number: 4, key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'of 4', numericValue: 4, note: '', detail: '' }
  ],
  reading: { headline: 'On course.', body: 'You are down 0.41 kg a week [1].', citations: [1], source: 'MODEL', generatedAt: null },
  lifts: []
};

class FakeCoachStore {
  availableReading = signal<CoachReading | null>(null);
  offerReading = jasmine.createSpy('offerReading').and.callFake((r: CoachReading | null) => this.availableReading.set(r));
  askAboutReading = jasmine.createSpy('askAboutReading');
  askAboutCard = jasmine.createSpy('askAboutCard');
}

describe('ProgressPage', () => {
  let fixture: ComponentFixture<ProgressPage>;
  let el: HTMLElement;
  let api: jasmine.SpyObj<ProgressApiService>;
  let store: FakeCoachStore;
  let queryParams: Record<string, string>;
  let scrolled: string[];

  function configure(): void {
    api = progressApi();
    store = new FakeCoachStore();
    TestBed.configureTestingModule({
      imports: [ProgressPage],
      providers: [
        provideRouter([]),
        { provide: ProgressApiService, useValue: api },
        { provide: NutrientsService, useValue: { getAll: () => throwError(() => new Error('off')) } },
        { provide: CoachStore, useValue: store },
        { provide: CoachApiService, useValue: { getReading: () => of(reading) } },
        { provide: FitSyncDataService, useValue: { getProgressInsight: () => throwError(() => new Error('off')) } },
        { provide: TrainingApiService, useValue: { getTraining: () => throwError(() => new Error('off')) } },
        { provide: UserTimezoneService, useValue: timezoneStub },
        { provide: InsightReadState, useValue: { wasRead: () => false, markRead: () => undefined } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (key: string) => queryParams[key] ?? null } } } }
      ]
    });
  }

  function render(): void {
    fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    queryParams = {};
    scrolled = [];
    spyOn(Element.prototype, 'scrollIntoView').and.callFake(function (this: Element) {
      scrolled.push(this.id);
    });
    configure();
  });

  it('is one page: the reading, then Goal, Training, Food and Reviews, under a jump bar', () => {
    render();
    expect(text(el.querySelector('h1'))).toBe('Is it working?');
    expect(text(el.querySelector('.head p'))).toBe('The last 4 weeks · 6 Sept to 3 Oct');
    expect(Array.from(el.querySelectorAll('app-jump-bar .chip')).map((c) => text(c))).toEqual(['Summary', 'Goal', 'Training', 'Food', 'Reviews']);
    const order = Array.from(el.querySelectorAll('.anchor')).map((a) => a.id);
    expect(order).toEqual(PROGRESS_SECTIONS.map((s) => `progress-${s.id}`));
    expect(el.querySelector('app-insight-panel')).not.toBeNull();
    expect(el.querySelector('app-goal-card')).not.toBeNull();
    expect(el.querySelector('app-training-card')).not.toBeNull();
    expect(el.querySelector('app-food-card')).not.toBeNull();
    expect(el.querySelector('app-reviews-card')).not.toBeNull();
  });

  it('no longer shows the tabs, the trends, the comparison or the heatmap', () => {
    render();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(el.querySelector('app-analytics-trend-charts, app-analytics-comparison-card, app-activity-heatmap, app-body-page')).toBeNull();
  });

  it('asks each card for its own days, ending today in the person’s zone', () => {
    render();
    expect(api.getGoal).toHaveBeenCalledWith('2026-07-05', TODAY);
    expect(api.getFood).toHaveBeenCalledWith('2026-09-04', TODAY);
    expect(api.getReviews).toHaveBeenCalled();
  });

  it('scrolls to a section from the jump bar and keeps ?section= in step', () => {
    render();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    el.querySelectorAll<HTMLButtonElement>('app-jump-bar .chip')[3].click();
    fixture.detectChanges();
    expect(scrolled).toContain('progress-food');
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { section: 'food' }, replaceUrl: true }));
    expect(text(el.querySelector('app-jump-bar [aria-current="true"]'))).toBe('Food');
  });

  it('opens at the section the address names', () => {
    queryParams = { section: 'reviews' };
    render();
    TestBed.tick();
    expect(scrolled).toContain('progress-reviews');
    expect(fixture.componentInstance.active()).toBe('reviews');
  });

  it('numbers the Goal and Food cards with the first fact that cites them', () => {
    render();
    fixture.detectChanges();
    expect(text(el.querySelector('app-goal-card .cite'))).toBe('1');
    expect(text(el.querySelector('app-food-card .cite'))).toBe('3');
  });

  it('scrolls to and rings the card a chosen fact names, and lets the ring go', fakeAsync(() => {
    render();
    fixture.detectChanges();
    const facts = el.querySelectorAll<HTMLElement>('app-insight-panel .fact');
    facts[2].click();
    fixture.detectChanges();
    expect(scrolled).toContain('progress-food');
    expect(el.querySelector('app-food-card .card.ringed')).not.toBeNull();
    expect(el.querySelector('app-goal-card .card.ringed')).toBeNull();
    tick(RING_MS);
    fixture.detectChanges();
    expect(el.querySelector('app-food-card .card.ringed')).toBeNull();
  }));

  it('rings the Training slot for a Training fact and ignores a fact without a card', () => {
    render();
    fixture.componentInstance.showCard({ ...reading.facts[3], card: 'TRAINING' });
    fixture.detectChanges();
    expect(el.querySelector('#progress-training.ringed')).not.toBeNull();
    scrolled = [];
    fixture.componentInstance.showCard(reading.facts[3]);
    expect(scrolled).toEqual([]);
  });
});

describe('Progress redirects', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'progress/goal', component: GoalStub },
          { path: 'progress', pathMatch: 'full', component: ProgressStub, canActivate: [progressTabRedirect] },
          { path: 'body', pathMatch: 'full', redirectTo: 'progress/goal' }
        ])
      ]
    });
  });

  it('sends ?tab=body to the Goal page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/progress?tab=body');
    expect(TestBed.inject(Router).url).toBe('/progress/goal');
  });

  it('sends ?tab=goals to the goals on the Goal page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/progress?tab=goals');
    expect(TestBed.inject(Router).url).toBe('/progress/goal#other-goals');
  });

  it('sends /body to the Goal page and leaves ?tab=overview on Progress', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/body');
    expect(TestBed.inject(Router).url).toBe('/progress/goal');
    await harness.navigateByUrl('/progress?tab=overview');
    expect(TestBed.inject(Router).url).toBe('/progress?tab=overview');
  });
});

@Component({ template: 'goal' })
class GoalStub {}
@Component({ template: 'progress' })
class ProgressStub {}

describe('Progress cards', () => {
  let api: jasmine.SpyObj<ProgressApiService>;
  let coach: { askAboutCard: jasmine.Spy };
  let nutrients: { getAll: jasmine.Spy };

  beforeEach(() => {
    api = progressApi();
    coach = { askAboutCard: jasmine.createSpy('askAboutCard') };
    nutrients = { getAll: jasmine.createSpy('getAll').and.returnValue(throwError(() => new Error('off'))) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProgressApiService, useValue: api },
        { provide: CoachStore, useValue: coach },
        { provide: NutrientsService, useValue: nutrients }
      ]
    });
  });

  function render<T>(type: new (...args: never[]) => T, inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(type as never) as ComponentFixture<T>;
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const goalInputs = { period: { from: '2026-07-05', to: TODAY }, askPeriod: { from: '2026-09-06', to: TODAY } };
  const foodInputs = { period: { from: '2026-09-04', to: TODAY } };

  describe('GoalCardComponent', () => {
    it('shows the weigh-in, the chart and the three lines, and the whole card opens the Goal page', () => {
      const { el } = render(GoalCardComponent, goalInputs);
      expect(text(el.querySelector('h2'))).toBe('Goal');
      expect(text(el.querySelector('.sub'))).toBe('68.0 kg by 11 Dec · 69 days left');
      expect(text(el.querySelector('.big'))).toBe('71.2 kg');
      expect(text(el.querySelector('.change'))).toBe('−1.6 kg in 4 weeks');
      expect(text(el.querySelector('.quiet'))).toBe('Your weigh-in on 1 Oct');
      expect(el.querySelector('app-goal-weight-chart svg')).not.toBeNull();
      expect(Array.from(el.querySelectorAll('app-summary-lines .trend')).map((t) => text(t))).toEqual(['faster', 'ahead', 'down']);
      expect(text(el.querySelector('app-summary-lines .context'))).toBe('Was −0.28 kg a week in the 4 weeks before');
      expect(el.querySelector('a.open')?.getAttribute('href')).toBe('/progress/goal');
    });

    it('asks about the Goal card with the four weeks', () => {
      const { el } = render(GoalCardComponent, goalInputs);
      el.querySelector<HTMLButtonElement>('.ask')!.click();
      const card: CoachCardContext = { kind: 'GOAL', from: '2026-09-06', to: TODAY };
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith(card);
    });

    it('shows a skeleton while loading', () => {
      api.getGoal.and.returnValue(new Observable<GoalProgress>());
      const { el } = render(GoalCardComponent, goalInputs);
      expect(el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
    });

    it('offers a retry after an error, and loads again', () => {
      api.getGoal.and.returnValue(throwError(() => new Error('down')));
      const { fixture, el } = render(GoalCardComponent, goalInputs);
      expect(text(el.querySelector('app-state-panel'))).toContain('Your goal could not be loaded');
      api.getGoal.and.callFake(() => of(goalData()));
      el.querySelector<HTMLButtonElement>('app-state-panel button')!.click();
      fixture.detectChanges();
      expect(text(el.querySelector('.big'))).toBe('71.2 kg');
    });

    it('says not enough data yet without weigh-ins, and points to Me without a goal', () => {
      api.getGoal.and.returnValue(of(mapGoalProgress({})));
      const { el } = render(GoalCardComponent, goalInputs);
      expect(text(el.querySelector('.empty'))).toContain('Not enough data yet');
      expect(el.querySelector('app-goal-weight-chart')).toBeNull();
      expect(text(el.querySelector('a.set'))).toBe('Set a weight goal in Me ›');
    });
  });

  describe('FoodCardComponent', () => {
    it('shows the balance, the three lines and opens the Food page', () => {
      const { el } = render(FoodCardComponent, foodInputs);
      expect(text(el.querySelector('.sub'))).toBe('Logged on 26 of the last 30 days');
      expect(text(el.querySelector('.big'))).toBe('279');
      expect(text(el.querySelector('.words'))).toBe('kcal a day under what you used');
      const lines = Array.from(el.querySelectorAll('app-summary-lines .text')).map((t) => text(t));
      expect(lines[0]).toBe('2,123 kcal a day, 26 of 30 days logged');
      expect(lines[1]).toBe('Protein 150 → 136 g a day since 10 Aug');
      expect(lines[2]).toBe('Vitamin D 34%, the furthest short');
      expect(Array.from(el.querySelectorAll('app-summary-lines .trend')).map((t) => text(t))).toEqual(['steady', 'down', 'low']);
      expect(text(el.querySelector('app-summary-lines .context'))).toBe('2,189 kcal a day in the 30 days before');
      expect(el.querySelector('a.open')?.getAttribute('href')).toBe('/progress/food');
      expect(el.querySelector('.petal-box')).toBeNull();
    });

    it('asks about the Food card with its 30 days', () => {
      const { el } = render(FoodCardComponent, foodInputs);
      el.querySelector<HTMLButtonElement>('.ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith({ kind: 'FOOD', from: '2026-09-04', to: TODAY });
    });

    it('shows a skeleton while loading and a retry after an error', () => {
      api.getFood.and.returnValue(new Observable<FoodProgress>());
      expect(render(FoodCardComponent, foodInputs).el.querySelector('.skeleton')).not.toBeNull();
      api.getFood.and.returnValue(throwError(() => new Error('down')));
      expect(text(render(FoodCardComponent, foodInputs).el.querySelector('app-state-panel'))).toContain('Try again');
    });

    it('says not enough data yet when nothing was logged', () => {
      api.getFood.and.returnValue(of(mergeFood(mapFoodProgress({}), null)));
      const { el } = render(FoodCardComponent, foodInputs);
      expect(text(el.querySelector('.empty'))).toContain('Not enough data yet');
    });
  });

  describe('ReviewsCardComponent', () => {
    it('shows the latest review with its "so far" badge and links to the earlier ones', () => {
      const { el } = render(ReviewsCardComponent, { today: TODAY });
      expect(text(el.querySelector('app-review-item strong'))).toBe('Two sessions in.');
      expect(text(el.querySelector('.badge'))).toBe('so far');
      expect(el.querySelectorAll('app-review-item').length).toBe(1);
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/progress/reviews');
    });

    it('says not enough data yet without reviews, and offers a retry after an error', () => {
      api.getReviews.and.returnValue(of([]));
      expect(text(render(ReviewsCardComponent, { today: TODAY }).el.querySelector('.empty'))).toContain('Not enough data yet');
      api.getReviews.and.returnValue(throwError(() => new Error('down')));
      expect(text(render(ReviewsCardComponent, { today: TODAY }).el.querySelector('app-state-panel'))).toContain('Try again');
    });

    it('shows a skeleton while loading', () => {
      api.getReviews.and.returnValue(new Observable<WeeklyReview[]>());
      expect(render(ReviewsCardComponent, { today: TODAY }).el.querySelector('.skeleton')).not.toBeNull();
    });
  });
});
