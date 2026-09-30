import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CoachApiService } from '../../../core/coach/coach-api.service';
import { CoachReading, ReadingSurface } from '../../../core/coach/coach.models';
import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { NutritionInsightsPage, ProgressInsight } from '../../../core/fitsync.models';
import { INSIGHT_NOW, InsightPanelComponent, READING_POLL_LIMIT, READING_POLL_MS, ageLabel } from './insight-panel.component';
import { InsightReadState } from './insight-read-state';

const ready: CoachReading = {
  surface: 'WORKOUT',
  status: 'READY',
  readingId: '9f2c4e1ab03d77aa',
  period: 'PREVIOUS_WEEK',
  periodStart: '2026-09-21',
  periodEnd: '2026-09-27',
  facts: [
    { number: 1, key: 'VOLUME_PER_SESSION', label: 'Weight moved per session', value: '1,923', unit: 'kg', numericValue: 1923, note: 'Up 12%', detail: '1,716 kg the week before' },
    { number: 2, key: 'SESSION_LENGTH', label: 'Session length', value: '50', unit: 'min', numericValue: 50, note: 'Unchanged', detail: '50 min the week before' },
    { number: 3, key: 'RECORD', label: 'Dumbbell Bench Press record', value: '22.5', unit: 'kg', numericValue: 22.5, note: 'Monday', detail: '20 kg before' },
    { number: 4, key: 'MOST_TRAINED', label: 'Sessions with core work', value: '4', unit: 'of 4', numericValue: 4, note: 'Every one', detail: 'Plank Hold' }
  ],
  reading: {
    headline: 'Your lifts grew while your sessions stayed the same length.',
    body: 'You moved 1,923 kg a session [1], up from 1,716 kg, and each one still took 50 min [2].',
    citations: [1, 2],
    source: 'MODEL',
    generatedAt: '2026-09-28T15:20:00Z'
  },
  lifts: [{ exerciseName: 'Dumbbell Bench Press', fromKg: 20, fromDate: '2026-09-13', toKg: 22.5, toDate: '2026-09-25' }]
};

const nutritionReady: CoachReading = {
  ...ready,
  surface: 'NUTRITION',
  readingId: 'b7d1e0c455aa1290',
  period: 'PREVIOUS_WEEK',
  facts: [
    { number: 1, key: 'PROTEIN_PER_DAY', label: 'Protein per day', value: '159', unit: 'g', numericValue: 159, note: 'Target 155 g', detail: '' },
    { number: 2, key: 'PROTEIN_BREAKFAST', label: 'Protein at breakfast', value: '27', unit: 'g', numericValue: 27, note: '17%', detail: '' },
    { number: 3, key: 'PROTEIN_LUNCH_DINNER', label: 'Protein at lunch and dinner', value: '99', unit: 'g', numericValue: 99, note: '62%', detail: '' },
    { number: 4, key: 'CALORIES_PER_DAY', label: 'Calories per day', value: '2,240', unit: 'kcal', numericValue: 2240, note: '', detail: '' }
  ],
  reading: { ...ready.reading!, headline: 'Most of your protein comes after midday.' },
  lifts: []
};

const progressReady: CoachReading = {
  ...ready,
  surface: 'PROGRESS',
  readingId: 'c3a9f0d211bb7745',
  period: 'LAST_28_DAYS',
  periodStart: '2026-09-04',
  periodEnd: '2026-10-01',
  facts: [
    { number: 1, key: 'WEIGHT', label: 'Weight', value: '71.1', unit: 'kg', numericValue: 71.1, note: '', detail: '' },
    { number: 2, key: 'WEEKLY_RATE', label: 'Weekly rate', value: '-0.4', unit: 'kg', numericValue: -0.4, note: '', detail: '' },
    { number: 3, key: 'GOAL', label: 'Goal', value: '68', unit: 'kg', numericValue: 68, note: '', detail: '' },
    { number: 4, key: 'CALORIES_PER_DAY', label: 'Calories per day', value: '2,240', unit: 'kcal', numericValue: 2240, note: '', detail: '' }
  ],
  reading: { ...ready.reading!, headline: 'At this pace you reach 68 kg early.' },
  lifts: []
};

const mealPage: NutritionInsightsPage = {
  period: 'PREVIOUS_WEEK',
  periodStart: '2026-09-21',
  periodEnd: '2026-09-27',
  daysLogged: 6,
  proteinPerDayGrams: 159,
  proteinTargetGrams: 155,
  proteinByMeal: [
    { mealType: 'BREAKFAST', label: 'Breakfast', gramsPerDay: 27 },
    { mealType: 'LUNCH', label: 'Lunch', gramsPerDay: 54 },
    { mealType: 'DINNER', label: 'Dinner', gramsPerDay: 45 }
  ]
};

const weightInsight: ProgressInsight = {
  referenceDate: '2026-10-01',
  weightKg: 71.1,
  measuredOn: '2026-10-01',
  weeklyRateKg: -0.4,
  goalWeightKg: 68,
  goalDate: '2026-11-25',
  projectedDate: '2026-10-25',
  series: [
    { date: '2026-09-13', weightKg: 72.5 },
    { date: '2026-10-01', weightKg: 71.1 }
  ]
};

const resting: CoachReading = { ...ready, status: 'RESTING', reading: null };
const writing: CoachReading = { ...ready, status: 'WRITING', reading: null };
const empty: CoachReading = { ...ready, status: 'EMPTY', readingId: null, facts: [], reading: null, lifts: [] };

describe('InsightPanelComponent', () => {
  let fixture: ComponentFixture<InsightPanelComponent>;
  let element: HTMLElement;
  let api: jasmine.SpyObj<CoachApiService>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let store: { askAboutReading: jasmine.Spy; offerReading: jasmine.Spy };
  let readState: jasmine.SpyObj<InsightReadState>;

  function render(surface: ReadingSurface = 'WORKOUT'): void {
    fixture = TestBed.createComponent(InsightPanelComponent);
    fixture.componentRef.setInput('surface', surface);
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', ['getReading']);
    api.getReading.and.returnValue(of(ready));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getNutritionInsightsPage', 'getProgressInsight']);
    data.getNutritionInsightsPage.and.returnValue(of(mealPage));
    data.getProgressInsight.and.returnValue(of(weightInsight));
    store = { askAboutReading: jasmine.createSpy('askAboutReading'), offerReading: jasmine.createSpy('offerReading') };
    readState = jasmine.createSpyObj<InsightReadState>('InsightReadState', ['wasRead', 'markRead']);
    readState.wasRead.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [InsightPanelComponent],
      providers: [
        { provide: CoachApiService, useValue: api },
        { provide: FitSyncDataService, useValue: data },
        { provide: CoachStore, useValue: store },
        { provide: InsightReadState, useValue: readState },
        { provide: INSIGHT_NOW, useValue: () => new Date('2026-09-28T15:22:00Z') }
      ]
    }).compileComponents();
  });

  it('asks for the reading of its page in the given timezone', () => {
    render();
    expect(api.getReading).toHaveBeenCalledOnceWith('WORKOUT', 'Asia/Singapore');
  });

  it('shows the reading with its headline, its body and when it was written', () => {
    render();
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
    expect(text('.reading-body')).toContain('You moved 1,923 kg a session');
    expect(text('.written')).toBe('Coach model · 2 min ago');
  });

  it('says so when the reading was written by fixed rules, and leaves the time out', () => {
    api.getReading.and.returnValue(of({ ...ready, reading: { ...ready.reading!, source: 'RULES' } }));
    render();
    expect(text('.written')).toBe('Fixed rules');
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
  });

  it('remembers a rule-written and a model-written reading of the same facts separately', () => {
    api.getReading.and.returnValue(of({ ...ready, reading: { ...ready.reading!, source: 'RULES' } }));
    render();
    expect(readState.wasRead).toHaveBeenCalledWith('WORKOUT', '9f2c4e1ab03d77aa:RULES');
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:RULES');
  });

  it('draws each citation as a numbered badge and leaves the brackets out', () => {
    render();
    const badges = Array.from(element.querySelectorAll('.citation')).map((node) => node.textContent?.trim());
    expect(badges).toEqual(['1', '2']);
    expect(text('.reading-body')).not.toContain('[');
  });

  it('lists the four facts with number, label, value, unit and note', () => {
    render();
    const column = (selector: string): string[] =>
      Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(column('.fact .fact-number')).toEqual(['1', '2', '3', '4']);
    expect(column('.fact .fact-label')).toEqual(['Weight moved per session', 'Session length', 'Dumbbell Bench Press record', 'Sessions with core work']);
    expect(column('.fact .fact-value')).toEqual(['1,923 kg', '50 min', '22.5 kg', '4 of 4']);
    expect(column('.fact .fact-note')).toEqual(['Up 12%', 'Unchanged', 'Monday', 'Every one']);
  });

  it('draws the slope chart when there are lifts to compare', () => {
    render();
    expect(element.querySelector('app-slope-chart svg')).not.toBeNull();
  });

  it('pins the reading with the coach and does not pre-fill the composer', () => {
    render();
    (element.querySelector('.reading-actions button') as HTMLButtonElement).click();
    expect(store.askAboutReading).toHaveBeenCalledOnceWith(ready);
  });

  it('opens folded when the reading was read before, and unfolds on request', () => {
    readState.wasRead.and.returnValue(true);
    render();
    expect(element.querySelector('.folded')).not.toBeNull();
    expect(element.querySelector('.panel')).toBeNull();
    expect(text('.folded-headline')).toBe('Your lifts grew while your sessions stayed the same length.');

    (element.querySelector('.folded button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.panel')).not.toBeNull();
  });

  it('remembers the reading as read when the user folds it', () => {
    render();
    (element.querySelector('.fold-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:MODEL');
    expect(element.querySelector('.folded')).not.toBeNull();
  });

  it('remembers the reading as read when the user leaves the page', () => {
    render();
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:MODEL');
  });

  it('does not mark a reading as read when it was only ever shown folded', () => {
    readState.wasRead.and.returnValue(true);
    render();
    fixture.destroy();
    expect(readState.markRead).not.toHaveBeenCalled();
  });

  it('keeps the facts and says the model is resting when there is no reading', () => {
    api.getReading.and.returnValue(of(resting));
    render();
    expect(text('.away-headline')).toBe('The coach model is resting.');
    expect(element.querySelectorAll('.fact').length).toBe(4);
    expect(element.querySelector('.reading')).toBeNull();
    fixture.destroy();
    expect(readState.markRead).not.toHaveBeenCalled();
  });

  it('takes no space when there is nothing to show', () => {
    api.getReading.and.returnValue(of(empty));
    render();
    expect(element.children.length).toBe(0);
  });

  it('takes no space when the request fails', () => {
    api.getReading.and.returnValue(throwError(() => new Error('offline')));
    render();
    expect(element.children.length).toBe(0);
  });

  it('shows a skeleton while the first request is on its way', () => {
    api.getReading.and.returnValue(new Subject<CoachReading>());
    render();
    expect(element.querySelector('.panel-skeleton')).not.toBeNull();
  });

  it('asks again while the reading is being written and shows it when it arrives', fakeAsync(() => {
    api.getReading.and.returnValues(of(writing), of(writing), of(ready));
    render();
    expect(text('.away-headline')).toBe('The reading is being written.');
    expect(element.querySelectorAll('.fact').length).toBe(4);

    tick(READING_POLL_MS);
    fixture.detectChanges();
    expect(text('.away-headline')).toBe('The reading is being written.');

    tick(READING_POLL_MS);
    fixture.detectChanges();
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
    expect(api.getReading).toHaveBeenCalledTimes(3);
  }));

  it('stops asking after the last attempt and shows the model as resting', fakeAsync(() => {
    api.getReading.and.returnValue(of(writing));
    render();
    tick(READING_POLL_MS * (READING_POLL_LIMIT + 2));
    fixture.detectChanges();
    expect(api.getReading).toHaveBeenCalledTimes(READING_POLL_LIMIT);
    expect(text('.away-headline')).toBe('The coach model is resting.');
  }));

  it('stops asking when the user leaves the page', fakeAsync(() => {
    api.getReading.and.returnValue(of(writing));
    render();
    fixture.destroy();
    tick(READING_POLL_MS * 3);
    expect(api.getReading).toHaveBeenCalledTimes(1);
  }));

  it('does not ask for chart figures on the workout page', () => {
    render();
    expect(data.getNutritionInsightsPage).not.toHaveBeenCalled();
    expect(data.getProgressInsight).not.toHaveBeenCalled();
  });

  describe('on the nutrition page', () => {
    beforeEach(() => api.getReading.and.returnValue(of(nutritionReady)));

    it('loads its own reading and draws the facts and the meal chart', () => {
      render('NUTRITION');
      expect(api.getReading).toHaveBeenCalledOnceWith('NUTRITION', 'Asia/Singapore');
      expect(data.getNutritionInsightsPage).toHaveBeenCalledOnceWith('Asia/Singapore');
      expect(text('.reading-headline')).toBe('Most of your protein comes after midday.');
      expect(element.querySelectorAll('.fact').length).toBe(4);
      expect(element.querySelectorAll('app-meal-bars rect.bar').length).toBe(3);
      expect(element.querySelector('app-slope-chart')).toBeNull();
    });

    it('lets the lunch and dinner bars stand out when the reading is about their share', () => {
      render('NUTRITION');
      const quiet = Array.from(element.querySelectorAll('app-meal-bars rect.bar')).map((bar) => bar.classList.contains('quiet'));
      expect(quiet).toEqual([true, false, false]);
    });

    it('draws every bar the same when the reading is not about lunch and dinner', () => {
      api.getReading.and.returnValue(of({ ...nutritionReady, facts: nutritionReady.facts.filter((fact) => fact.key !== 'PROTEIN_LUNCH_DINNER') }));
      render('NUTRITION');
      expect(element.querySelectorAll('app-meal-bars rect.bar.quiet').length).toBe(0);
    });

    it('keeps the reading without a chart when the chart request fails', () => {
      data.getNutritionInsightsPage.and.returnValue(throwError(() => new Error('offline')));
      render('NUTRITION');
      expect(text('.reading-headline')).toBe('Most of your protein comes after midday.');
      expect(element.querySelector('app-meal-bars')).toBeNull();
      expect(element.querySelector('.panel')).not.toBeNull();
    });

    it('keeps the reading without a chart when there is no meal to draw', () => {
      data.getNutritionInsightsPage.and.returnValue(of({ ...mealPage, proteinByMeal: [] }));
      render('NUTRITION');
      expect(element.querySelector('app-meal-bars')).toBeNull();
      expect(text('.reading-headline')).toBe('Most of your protein comes after midday.');
    });

    it('pins the reading together with its surface', () => {
      render('NUTRITION');
      (element.querySelector('.reading-actions button') as HTMLButtonElement).click();
      expect(store.askAboutReading).toHaveBeenCalledOnceWith(nutritionReady);
    });
  });

  describe('on the progress page', () => {
    beforeEach(() => api.getReading.and.returnValue(of(progressReady)));

    it('loads its own reading and draws the facts and the weight chart', () => {
      render('PROGRESS');
      expect(api.getReading).toHaveBeenCalledOnceWith('PROGRESS', 'Asia/Singapore');
      expect(data.getProgressInsight).toHaveBeenCalledOnceWith('Asia/Singapore');
      expect(element.querySelectorAll('.fact').length).toBe(4);
      expect(element.querySelector('app-weight-projection svg polyline.series')).not.toBeNull();
    });

    it('writes the 28 days as one range', () => {
      render('PROGRESS');
      expect(text('.eyebrow-period')).toBe('4 Sept to 1 Oct');
    });

    it('keeps the reading without a chart when the chart request fails', () => {
      data.getProgressInsight.and.returnValue(throwError(() => new Error('offline')));
      render('PROGRESS');
      expect(text('.reading-headline')).toBe('At this pace you reach 68 kg early.');
      expect(element.querySelector('app-weight-projection')).toBeNull();
    });

    it('keeps the reading without a chart when the series has fewer than two weights', () => {
      data.getProgressInsight.and.returnValue(of({ ...weightInsight, series: [{ date: '2026-10-01', weightKg: 71.1 }] }));
      render('PROGRESS');
      expect(element.querySelector('app-weight-projection')).toBeNull();
      expect(element.querySelector('.panel')).not.toBeNull();
    });
  });

  it('remembers what was read separately for each surface', () => {
    api.getReading.and.returnValue(of(nutritionReady));
    render('NUTRITION');
    expect(readState.wasRead).toHaveBeenCalledWith('NUTRITION', 'b7d1e0c455aa1290:MODEL');
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('NUTRITION', 'b7d1e0c455aa1290:MODEL');

    readState.markRead.calls.reset();
    api.getReading.and.returnValue(of(progressReady));
    render('PROGRESS');
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('PROGRESS', 'c3a9f0d211bb7745:MODEL');
  });

  it('offers a ready reading to the coach panel, on every surface', () => {
    render();
    expect(store.offerReading).toHaveBeenCalledOnceWith(ready);

    store.offerReading.calls.reset();
    api.getReading.and.returnValue(of(progressReady));
    render('PROGRESS');
    expect(store.offerReading).toHaveBeenCalledOnceWith(progressReady);
  });

  it('offers nothing when the reading is resting, empty or failed', () => {
    for (const outcome of [of(resting), of(empty), throwError(() => new Error('offline'))]) {
      store.offerReading.calls.reset();
      api.getReading.and.returnValue(outcome);
      render();
      expect(store.offerReading).toHaveBeenCalledOnceWith(null);
    }
  });

  it('withdraws the offer while the reading is being written and offers it when it arrives', fakeAsync(() => {
    api.getReading.and.returnValues(of(writing), of(ready));
    render();
    expect(store.offerReading).toHaveBeenCalledOnceWith(null);

    tick(READING_POLL_MS);
    expect(store.offerReading).toHaveBeenCalledWith(ready);
  }));

  it('withdraws the offer when the user leaves the page', () => {
    render();
    store.offerReading.calls.reset();
    fixture.destroy();
    expect(store.offerReading).toHaveBeenCalledOnceWith(null);
  });

  it('shows the working on request, with the period and each fact in full', () => {
    render();
    const link = element.querySelector('.working-link') as HTMLButtonElement;
    expect(link.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('.working')).toBeNull();

    link.click();
    fixture.detectChanges();
    expect(link.getAttribute('aria-expanded')).toBe('true');
    expect(text('.working-link')).toBe('Hide the working');
    expect(text('.working-period')).toBe('Measured from 21 Sept to 27 Sept.');
    expect(text('.eyebrow-period')).toBe('21 to 27 Sept');
    expect(text('.working-list li:first-child strong')).toBe('Weight moved per session');
    expect(text('.working-list li:first-child .working-text > span')).toBe('1,923 kg, 1,716 kg the week before');
  });
});

describe('ageLabel', () => {
  const now = new Date('2026-09-28T15:22:00Z');

  it('describes how long ago a reading was written', () => {
    expect(ageLabel('2026-09-28T15:21:40Z', now)).toBe('just now');
    expect(ageLabel('2026-09-28T15:20:00Z', now)).toBe('2 min ago');
    expect(ageLabel('2026-09-28T12:20:00Z', now)).toBe('3 h ago');
    expect(ageLabel('2026-09-27T12:20:00Z', now)).toBe('1 day ago');
    expect(ageLabel('2026-09-25T12:20:00Z', now)).toBe('3 days ago');
  });

  it('treats a time in the future as just now and an unreadable one as unknown', () => {
    expect(ageLabel('2026-09-28T16:00:00Z', now)).toBe('just now');
    expect(ageLabel('soon', now)).toBe('');
  });
});
