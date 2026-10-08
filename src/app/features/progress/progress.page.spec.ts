import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { CoachReading } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WeeklyTrainingInsight } from '../../core/fitsync.models';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { NutrientsService } from '../nutrition/nutrients/nutrients.service';
import { lossRoad } from './cards/goal-road.spec';
import { ProgressBack } from './cards/progress-back';
import { mapReviews } from './progress-api.mappers';
import { GoalProgress, GoalRoad } from './progress-api.models';
import { ProgressApiService } from './progress-api.service';
import { progressTabRedirect } from './progress-redirect.guard';
import { READING_POLL_MS, ProgressPage, stickyHeaderHeight } from './progress.page';
import { EnergyWeek } from './energy/energy.models';
import { TODAY, foodData, goalData, progressApi, timezoneStub } from './progress-testing.spec';
import { TrainingApiService } from './training/training-api.service';
import { trainingFixture } from './training/training-fixture.spec';

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
    { number: 2, key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'of 4', numericValue: 4, note: 'Steady', detail: 'Four sessions in the last 4 weeks, one more than before. Another sentence.', card: 'TRAINING' },
    { number: 3, key: 'CALORIES_PER_DAY', label: 'Calories', value: '2,123', unit: 'kcal', numericValue: 2123, note: '−3%', detail: 'Calories stayed under what you use.', card: 'FOOD' }
  ],
  reading: { headline: 'Down 0.41 kg a week, ahead of your date [1].', body: 'Body.', citations: [1], source: 'MODEL', generatedAt: null },
  lifts: []
};

const REVIEWS = mapReviews([
  {
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    current: true,
    status: 'READY',
    headline: 'Two sessions in.',
    body: 'Weight still moving down.',
    facts: [
      { key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'sessions', note: '', detail: 'same as last week' },
      { key: 'MINUTES', label: 'Minutes trained', value: '170', unit: 'min', note: '', detail: '35 fewer than last week' },
      { key: 'CALORIES_PER_DAY', label: 'Calories a day', value: '2,011', unit: 'kcal', note: '', detail: 'on 5 logged days' },
      { key: 'PROTEIN_PER_DAY', label: 'Protein a day', value: '131', unit: 'g', note: '', detail: 'on 5 logged days' }
    ]
  },
  { weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'READY', headline: 'All four planned days done.', body: 'Calories 7% under.', facts: [{ key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'sessions' }] },
  { weekStart: '2026-09-14', weekEnd: '2026-09-20', status: 'NONE' }
]);

const INSIGHT = {
  timezone: 'Asia/Singapore',
  referenceDate: TODAY,
  weekStart: '2026-09-28',
  weekEnd: '2026-10-04',
  completedSessions: 2,
  totalMinutes: 90,
  previousWeekCompletedSessions: 3,
  previousWeekTotalMinutes: 120,
  muscleGroups: [],
  volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
  days: null,
  today: null,
  nextTraining: null
} as WeeklyTrainingInsight;

class FakeCoachStore {
  availableReading = signal<CoachReading | null>(null);
  offerReading = jasmine.createSpy('offerReading');
  askAboutCard = jasmine.createSpy('askAboutCard');
}

describe('ProgressPage', () => {
  let api: jasmine.SpyObj<ProgressApiService>;
  let store: FakeCoachStore;
  let getReading: jasmine.Spy;
  let nutrientsRead: jasmine.Spy;
  let harness: RouterTestingHarness;
  let fixture: ComponentFixture<unknown>;
  let el: HTMLElement;
  let scrolled: string[];

  function road(overrides: Partial<GoalRoad> = {}): GoalProgress {
    return { ...goalData(), road: lossRoad(overrides) };
  }

  async function open(url = '/progress'): Promise<void> {
    harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, ProgressPage);
    fixture = harness.fixture;
    el = harness.routeNativeElement as HTMLElement;
    expect(page).toBeInstanceOf(ProgressPage);
    TestBed.tick();
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = progressApi();
    api.getGoal.and.callFake(() => of(road()));
    api.getReviews.and.callFake(() => of(REVIEWS));
    store = new FakeCoachStore();
    nutrientsRead = jasmine.createSpy('getAll').and.callFake(() => throwError(() => new Error('off')));
    getReading = jasmine.createSpy('getReading').and.callFake(() => of(reading));
    scrolled = [];
    spyOn(Element.prototype, 'scrollIntoView').and.callFake(function (this: Element) {
      scrolled.push(this.id);
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'progress', component: ProgressPage }]),
        { provide: ProgressApiService, useValue: api },
        { provide: NutrientsService, useValue: { getAll: nutrientsRead } },
        { provide: CoachStore, useValue: store },
        { provide: CoachApiService, useValue: { getReading } },
        { provide: FitSyncDataService, useValue: { getWeeklyTrainingInsight: () => of(INSIGHT) } },
        { provide: TrainingApiService, useValue: { getTraining: () => of(trainingFixture()) } },
        { provide: UserTimezoneService, useValue: timezoneStub }
      ]
    });
  });

  it('opens with the answer: the eyebrow, the verdict, the coach sentence and no title, tabs or fact captions', async () => {
    await open();
    expect(text(el.querySelector('.eyebrow'))).toBe('Progress · The last 4 weeks · 6 Sept to 3 Oct');
    expect(text(el.querySelector('h1.verdict'))).toBe('Ahead of plan.');
    expect(el.querySelector('h1.verdict')?.classList.contains('green')).toBeTrue();
    expect(text(el.querySelector('.sentence'))).toBe('Down 0.41 kg a week, ahead of your date.');
    expect(el.textContent).not.toContain('Is it working?');
    expect(el.textContent).not.toMatch(/Fact \d/);
    expect(el.querySelector('[role="tablist"], app-jump-bar, app-insight-panel, .cite')).toBeNull();
    expect(getReading).toHaveBeenCalledWith('PROGRESS');
    expect(store.offerReading).toHaveBeenCalledWith(reading);
  });

  it('colours the verdict ink for a state that is not on its way', async () => {
    api.getGoal.and.callFake(() => of(road({ state: 'BEHIND' })));
    await open();
    expect(text(el.querySelector('h1.verdict'))).toBe('Behind plan.');
    expect(el.querySelector('h1.verdict')?.classList.contains('green')).toBeFalse();
  });

  it('writes the sentence from the road while the reading is not ready', async () => {
    getReading.and.callFake(() => of({ ...reading, status: 'RESTING', reading: null }));
    await open();
    expect(text(el.querySelector('.sentence'))).toBe('71.2 kg, losing 0.4 kg a week.');
  });

  it('polls a reading that is still being written and shows it when it arrives', fakeAsync(() => {
    getReading.and.returnValues(of({ ...reading, status: 'WRITING', reading: null }), of(reading));
    harness = undefined as never;
    const created = TestBed.createComponent(ProgressPage);
    created.detectChanges();
    expect(text(created.nativeElement.querySelector('.sentence'))).toBe('71.2 kg, losing 0.4 kg a week.');
    tick(READING_POLL_MS);
    created.detectChanges();
    expect(text(created.nativeElement.querySelector('.sentence'))).toBe('Down 0.41 kg a week, ahead of your date.');
    created.destroy();
  }));

  it('says so when the goal cannot be read and keeps the cards', async () => {
    api.getGoal.and.callFake(() => throwError(() => new Error('down')));
    await open();
    expect(el.querySelector('h1.verdict.placeholder')).not.toBeNull();
    expect(text(el.querySelector('.sentence'))).toContain('Your goal could not be loaded');
    expect(text(el.querySelector('app-goal-card app-state-panel'))).toContain('Try again');
    expect(el.querySelector('app-training-card')).not.toBeNull();
  });

  it('shows the four chips of this week and opens the earlier weeks as a dialog that Escape closes', async () => {
    await open();
    const chips = Array.from(el.querySelectorAll('app-week-chips .chip')).map((chip) => Array.from(chip.children).map((part) => text(part)).join(' '));
    expect(chips).toEqual(['Sessions 4 same as last week', 'Minutes 170 35 fewer than last week', 'Calories a day 2,011 on 5 logged days', 'Protein a day 131 g on 5 logged days']);
    expect(api.getReviews).toHaveBeenCalledOnceWith(8);
    expect(el.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    el.querySelector<HTMLButtonElement>('.earlier')!.click();
    fixture.detectChanges();
    const dialog = el.ownerDocument.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelectorAll('app-review-item').length).toBe(3);
    expect(text(dialog.querySelectorAll('ol > li')[1].querySelector('.chips'))).toBe('Sessions 4');

    el.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens the earlier weeks on arrival when the address says weeks=earlier', async () => {
    await open('/progress?weeks=earlier');
    expect(el.ownerDocument.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('keeps ?period= in the address and reads the other periods', async () => {
    await open();
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.periods a'));
    expect(links.map((link) => text(link))).toEqual(['4 weeks', '3 months', '1 year']);
    expect(links[0].getAttribute('aria-current')).toBe('true');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/progress', '/progress?period=3m', '/progress?period=1y']);

    links[1].click();
    await fixture.whenStable();
    TestBed.tick();
    fixture.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/progress?period=3m');
    expect(text(el.querySelector('.eyebrow'))).toBe('Progress · The last 3 months · 5 Jul to 3 Oct');
    expect(el.querySelector('.periods a[aria-current="true"]')?.textContent?.trim()).toBe('3 months');
  });

  it('reads the petals for the last 30 days whatever the period', async () => {
    await open('/progress?period=1y');
    expect(nutrientsRead).toHaveBeenCalledWith('2026-09-04', TODAY);
    expect(api.getFood).toHaveBeenCalledWith('2025-10-05', TODAY);
  });

  it('reads a 1 year period from the address with the year in the eyebrow', async () => {
    await open('/progress?period=1y');
    expect(text(el.querySelector('.eyebrow'))).toBe('Progress · The last year · 5 Oct 2025 to 3 Oct 2026');
    expect(api.getGoal).toHaveBeenCalledWith('2025-10-05', TODAY);
  });

  it('reads the goal for the period itself and each card for its own days', async () => {
    await open();
    expect(api.getGoal).toHaveBeenCalledWith('2026-09-06', TODAY);
    expect(api.getFood).toHaveBeenCalledWith('2026-09-04', TODAY);
  });

  it('has the contents row of three links that scroll to a card without touching the address', async () => {
    await open();
    const before = TestBed.inject(Location).path();
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.contents-row a'));
    expect(links.map((link) => text(link))).toEqual(['Goal', 'Training', 'Food']);
    expect(el.querySelector('aside[hidden]')).not.toBeNull();
    links[2].click();
    fixture.detectChanges();
    expect(scrolled).toContain('progress-food');
    expect(el.querySelector('.contents-row a[aria-current="location"]')?.textContent?.trim()).toBe('Food');
    expect(el.querySelector('aside app-contents-nav a[aria-current="location"]')?.textContent?.trim()).toBe('Food');
    expect(TestBed.inject(Location).path()).toBe(before);
    expect(TestBed.inject(Router).url).not.toContain('section');
  });

  it('has one coach line inside each card and none between the cards', async () => {
    await open();
    expect(el.querySelectorAll('.progress-page > app-coach-line').length).toBe(0);
    const lines = Array.from(el.querySelectorAll('.card .coach p')).map((line) => text(line));
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('4 kilos down since July. The next one falls around 8 Oct at this pace.');
    expect(lines[1]).toBe('Two sessions this week, 1 h 30 min in all. Last week had three sessions and 2 h.');
    expect(lines[2]).toBe('Protein is 4 g a day under the target this week. Dinner carries most of it.');
  });

  it('ends with the foot line and no reviews section', async () => {
    await open();
    expect(text(el.querySelector('.foot'))).toBe('Every figure is computed from what you logged. Open a card for the full picture.');
    expect(el.querySelector('app-reviews-card')).toBeNull();
  });

  describe('the Goal card', () => {
    it('is the road: the distance to the target, the state caption and a whole-card link', async () => {
      await open();
      const card = el.querySelector('app-goal-card')!;
      expect(text(card.querySelector('.figure'))).toBe('3.2 kg');
      expect(text(card.querySelector('.tail'))).toBe('to 68 kg');
      expect(text(card.querySelector('.caption'))).toBe('On course for 25 Nov, 16 days early');
      expect(card.querySelector('a.open')?.getAttribute('href')).toBe('/progress/goal');
      const svg = text(card.querySelector('app-road-chart svg'));
      expect(svg).toContain('Today');
      expect(svg).toContain('68 kg');
      expect(svg).toContain('54% of the way');
      expect(text(card.querySelector('.note'))).toBe('25 Nov at this pace, 16 days before your date.');
      expect(Array.from(card.querySelectorAll('.pill')).map((pill) => text(pill))).toEqual(['Protein · 19 of 26 days', 'Workouts · 1 of 2 weeks']);
    });

    it('builds its drawing at the pixel width of its box so its text is never scaled', async () => {
      await open();
      const host = el.querySelector('app-road-chart') as HTMLElement;
      const svg = host.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`);
      expect(svg.getAttribute('preserveAspectRatio')).toBeNull();
    });

    it('links the reached state to Me', async () => {
      api.getGoal.and.callFake(() => of(road({ state: 'REACHED', fractionWeight: 1, nowKg: 67.9, distanceKg: 0.1, ticks: [{ kg: 68, crossedOn: '2026-11-18', projectedOn: null }] })));
      await open();
      const card = el.querySelector('app-goal-card')!;
      expect(text(card.querySelector('.figure'))).toBe('68 kg');
      expect(text(card.querySelector('.tail'))).toBe('reached');
      expect(card.querySelector('.note-link')?.getAttribute('href')).toBe('/me#goal-lifecycle');
    });

    it('asks the coach with the card and the days, and does not open the page', async () => {
      await open();
      const url = TestBed.inject(Router).url;
      el.querySelector<HTMLButtonElement>('app-goal-card .ask')!.click();
      expect(text(el.querySelector('app-goal-card .ask'))).toBe('Ask');
      expect(store.askAboutCard).toHaveBeenCalledOnceWith({ kind: 'GOAL', from: '2026-09-06', to: TODAY }, 'Ask about your goal');
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(url);
    });

    it('shows a skeleton while loading', async () => {
      api.getGoal.and.returnValue(new Observable<GoalProgress>());
      await open();
      expect(el.querySelector('app-goal-card [aria-busy="true"]')).not.toBeNull();
    });
  });

  describe('the Training card', () => {
    it('shows the days trained, an activity block with a dot in its kind colour, and the figure as a picture only', async () => {
      await open();
      const card = el.querySelector('app-training-card')!;
      expect(text(card.querySelector('.figure'))).toBe('3 days');
      expect(text(card.querySelector('.caption'))).toBe('Trained in these 4 weeks, 4 new records');
      expect(Array.from(card.querySelectorAll('.activity-head strong')).map((name) => text(name))).toEqual(['Strength', 'Badminton']);
      expect(card.querySelector('.activity .dot')).not.toBeNull();
      expect(text(card.querySelector('app-summary-list'))).toContain('Deadlift 81.7 → 93.3 kg');
      expect(card.querySelector('app-log-strip svg')).not.toBeNull();
      expect(card.querySelector('app-muscle-figure')).not.toBeNull();
      expect(card.querySelector('app-muscle-figure button, app-muscle-figure [role="button"], app-muscle-figure [tabindex]')).toBeNull();
      expect(card.querySelector('.figure-pic')?.getAttribute('aria-hidden')).toBe('true');
      expect(text(card.querySelector('.figure-caption'))).toBe('Hard sets a week in each area. Open for the exercises.');
      expect(card.querySelector('a.open')?.getAttribute('href')).toBe('/progress/training');
    });

    it('asks the coach about training', async () => {
      await open();
      el.querySelector<HTMLButtonElement>('app-training-card .ask')!.click();
      expect(store.askAboutCard).toHaveBeenCalledOnceWith({ kind: 'TRAINING', from: '2026-09-06', to: TODAY }, 'Ask about your training');
    });
  });

  describe('the Food card', () => {
    /** An energy week with eaten minus used equal to the balance given. */
    const energyWeek = (weekStart: string, status: EnergyWeek['status'], daysLogged: number, balance: number): EnergyWeek => ({
      weekStart, weekEnd: weekStart, status, daysLogged, bmrKcal: 1700, bmrEstimated: false, restingFactor: 1.2,
      average: { eaten: 2200 + balance, resting: 2000, workouts: 200, used: 2200, balance },
      mealSplit: null, weeklyKgEquivalent: null, days: [], weeks: []
    });

    it('shows the balance as the headline and the three lines, and opens the Food page', async () => {
      api.getFood.and.callFake(() => of((() => {
        const food = foodData();
        return { ...food, energy: { ...food.energy, thisWeek: energyWeek('2026-09-28', 'OK', 5, -279) } };
      })()));
      await open();
      const card = el.querySelector('app-food-card')!;
      expect(text(card.querySelector('.figure'))).toBe('279 kcal');
      expect(text(card.querySelector('.caption'))).toBe('A day under what you used this week');
      expect(Array.from(card.querySelectorAll('app-summary-list .text')).map((line) => text(line))).toEqual([
        '2,123 kcal a day, logged 26 of 30 days',
        'Protein 136 g a day this week, 4 g under the 140 g target and down from 150 g a month ago',
        'Vitamin D at 34% of the daily amount is the furthest short'
      ]);
      expect(Array.from(card.querySelectorAll('app-summary-list .trend')).map((word) => text(word))).toEqual(['logged', 'under', '1 short']);
      expect(card.querySelector('a.open')?.getAttribute('href')).toBe('/progress/food');
    });

    it('names the earlier week everywhere when nothing was logged this week, with one figure for the gap', async () => {
      api.getFood.and.callFake(() => of((() => {
        const food = foodData();
        const protein = { ...food.macros.protein!, thisWeek: 180, series: [{ weekStart: '2026-08-10', value: 150 }, { weekStart: '2026-09-21', value: 180 }] };
        return {
          ...food,
          hero: { ...food.hero, balancePerDay: { value: 283, daysLogged: 1 } },
          energy: { ...food.energy, thisWeek: energyWeek('2026-09-28', 'TOO_FEW_DAYS', 1, 283) },
          macros: { ...food.macros, protein }
        };
      })()));
      api.getEnergyWeek.and.callFake((monday: string) => of(monday === '2026-09-21' ? energyWeek('2026-09-21', 'OK', 6, 7) : null));
      await open();
      TestBed.tick();
      fixture.detectChanges();
      const card = el.querySelector('app-food-card')!;
      expect(text(card.querySelector('.figure'))).toBe('7 kcal');
      expect(text(card.querySelector('.caption'))).toBe('A day over what you used in the week of 21 Sept');
      expect(text(card.querySelector('.bars-label'))).toBe('Week of 21 Sept');
      expect(card.querySelector('app-energy-pair svg')?.getAttribute('aria-label')).toContain('7 kcal over what you used');
      expect(text(card.querySelector('app-summary-list'))).toContain('Protein 180 g a day in the week of 21 Sept');
      expect(text(card)).not.toContain('283');
    });

    it('asks the coach about food', async () => {
      await open();
      el.querySelector<HTMLButtonElement>('app-food-card .ask')!.click();
      expect(store.askAboutCard).toHaveBeenCalledOnceWith({ kind: 'FOOD', from: '2026-09-04', to: TODAY }, 'Ask about your food');
    });

    it('offers a retry after an error', async () => {
      api.getFood.and.returnValue(throwError(() => new Error('down')));
      await open();
      expect(text(el.querySelector('app-food-card app-state-panel'))).toContain('Try again');
    });
  });
});

describe('the sticky offset of the contents row', () => {
  function shell(style: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = `<header class="topbar" style="height: 58px; ${style}"></header>`;
    document.body.appendChild(host);
    return host;
  }

  it('is the top bar height when the bar sticks, and 0 when it scrolls away or is absent', () => {
    let host = shell('position: sticky; top: 0');
    expect(stickyHeaderHeight(document)).toBe(58);
    host.remove();
    host = shell('position: static');
    expect(stickyHeaderHeight(document)).toBe(0);
    host.remove();
    expect(stickyHeaderHeight(document)).toBe(0);
  });
});

describe('Progress redirects', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'progress/goal', component: GoalStub },
          { path: 'progress/reviews', pathMatch: 'full', redirectTo: 'progress' },
          { path: 'progress', pathMatch: 'full', component: ProgressStub, canActivate: [progressTabRedirect] },
          { path: 'body', pathMatch: 'full', redirectTo: 'progress/goal' }
        ])
      ]
    });
  });

  it('sends the old reviews page to Progress', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/progress/reviews');
    expect(TestBed.inject(Router).url).toBe('/progress');
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

describe('the back link of a detail page', () => {
  let location: { getState: jasmine.Spy; back: jasmine.Spy };

  beforeEach(() => {
    location = { getState: jasmine.createSpy('getState'), back: jasmine.createSpy('back') };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Location, useValue: location }] });
  });

  it('steps back when the entry before is in this app, so Progress and a detail page never loop', () => {
    location.getState.and.returnValue({ navigationId: 3 });
    const back = TestBed.inject(ProgressBack);
    expect(back.hasEntryInApp()).toBeTrue();
    back.back();
    expect(location.back).toHaveBeenCalledTimes(1);
  });

  it('goes to Progress when the page was opened directly', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    for (const state of [{ navigationId: 1 }, null, {}]) {
      location.getState.and.returnValue(state);
      TestBed.inject(ProgressBack).back();
    }
    expect(location.back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(3);
    expect(navigate).toHaveBeenCalledWith('/progress');
  });
});
