import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { BodyMetric, ProgressInsight } from '../../../core/fitsync.models';
import { TodayBodyComponent } from './today-body.component';

const NOW = new Date(2026, 9, 1, 8, 0);

const metric: BodyMetric = {
  weightKg: 71.1,
  bodyFatRate: 21.4,
  bmi: 22.4,
  measuredAt: '2026-10-01',
  weightChange30dKg: -1.4
};

const insight: ProgressInsight = {
  referenceDate: '2026-10-01',
  weightKg: 71.1,
  measuredOn: '2026-10-01',
  weeklyRateKg: -0.41,
  rateWindowDays: 28,
  goalWeightKg: 68,
  goalDate: '2026-12-31',
  projectedDate: '2026-11-25',
  series: [
    { date: '2026-09-13', weightKg: 72.5 },
    { date: '2026-09-27', weightKg: 71.8 },
    { date: '2026-10-01', weightKg: 71.1 }
  ]
};

describe('TodayBodyComponent', () => {
  let fixture: ComponentFixture<TodayBodyComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getProgressInsight']);
    dataService.getProgressInsight.and.returnValue(of(insight));
  });

  function create(inputs: { metric?: BodyMetric | null } = {}): void {
    TestBed.configureTestingModule({
      imports: [TodayBodyComponent],
      providers: [provideRouter([]), { provide: FitSyncDataService, useValue: dataService }]
    });
    fixture = TestBed.createComponent(TodayBodyComponent);
    fixture.componentRef.setInput('metric', inputs.metric === undefined ? metric : inputs.metric);
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  // Angular drops the whitespace between elements, so the text of neighbouring elements is joined
  // with a space to read the way a person sees it.
  function spaced(node: Node): string {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let next = walker.nextNode(); next; next = walker.nextNode()) {
      const value = (next.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (value) {
        parts.push(value);
      }
    }
    return parts.join(' ');
  }

  function text(selector: string): string[] {
    return Array.from(el().querySelectorAll(selector)).map((node) => spaced(node));
  }

  function figures(): string[] {
    return text('.figures div');
  }

  describe('figures', () => {
    it('shows the weight, when it was taken, the change, body fat and BMI', () => {
      create();

      expect(text('strong.weight')).toEqual(['71.1 kg']);
      expect(text('.when')).toEqual(['Weighed today']);
      expect(text('.change')).toEqual(['Down 1.4 kg in 30 days']);
      expect(figures()).toEqual(['Body fat 21.4%', 'BMI 22.4']);
    });

    it('adds the waist between body fat and BMI when one is recorded', () => {
      create({ metric: { ...metric, waistCm: 80.4 } });

      expect(figures()).toEqual(['Body fat 21.4%', 'Waist 80.4 cm', 'BMI 22.4']);
    });

    it('leaves out a waist that is missing or zero', () => {
      create({ metric: { ...metric, waistCm: 0 } });

      expect(figures().join(' ')).not.toContain('Waist');
    });
  });

  describe('trend chart', () => {
    it('draws the series, the goal line, the projection and the three dates', () => {
      create();

      expect(dataService.getProgressInsight).toHaveBeenCalledOnceWith();
      expect(el().querySelector('polyline.series')).not.toBeNull();
      expect(text('text.latest-label')).toEqual(['71.1 kg']);
      expect(el().querySelector('line.goal-line')).not.toBeNull();
      expect(text('text.goal-label')).toEqual(['Goal 68 kg']);
      expect(el().querySelector('line.projection')).not.toBeNull();
      expect(text('text.date')).toEqual(['13 Sept', '1 Oct', '25 Nov']);
    });

    it('states the latest weight, the goal and the projected date as the text alternative', () => {
      create();

      const label = el().querySelector('svg.weight')?.getAttribute('aria-label') ?? '';
      expect(label).toContain('Latest weight 71.1 kg');
      expect(label).toContain('Goal 68 kg');
      expect(label).toContain('25 Nov');
    });

    it('also writes the same figures as a list for a narrow card, which the container query shows', () => {
      create();

      expect(text('.weight-list div')).toEqual(['Latest weight 71.1 kg', 'Goal 68 kg', 'Projected 25 Nov']);
    });

    it('draws no goal line and no projection without a goal', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, goalWeightKg: null, goalDate: null, projectedDate: null }));
      create();

      expect(el().querySelector('polyline.series')).not.toBeNull();
      expect(el().querySelector('line.goal-line')).toBeNull();
      expect(el().querySelector('line.projection')).toBeNull();
    });

    it('draws nothing and puts nothing in its place with fewer than two weigh-ins', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, series: [{ date: '2026-10-01', weightKg: 71.1 }] }));
      create();

      expect(el().querySelector('app-today-weight-chart')).toBeNull();
      expect(el().querySelector('.sentence')).toBeNull();
      expect(el().querySelector('.trend-skeleton')).toBeNull();
    });
  });

  describe('sentence', () => {
    it('says the goal comes before the date when the pace gets there in time', () => {
      create();

      expect(text('.sentence')).toEqual(['At this pace 68 kg comes on 25 Nov, before your date.']);
    });

    it('makes no remark when the pace gets there after the date', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, goalDate: '2026-11-01', projectedDate: '2027-01-10' }));
      create();

      expect(text('.sentence')).toEqual(['At this pace 68 kg comes on 10 Jan 2027.']);
    });

    it('says nothing when the pace does not lead to the goal', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, projectedDate: null }));
      create();

      expect(el().querySelector('.sentence')).toBeNull();
    });

    it('tells the pace when there is no goal', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, goalWeightKg: null, goalDate: null, projectedDate: null }));
      create();

      expect(text('.sentence')).toEqual(['Down 0.41 kg a week over four weeks.']);
    });

    it('says nothing for a rate of zero without a goal', () => {
      dataService.getProgressInsight.and.returnValue(of({ ...insight, goalWeightKg: null, goalDate: null, projectedDate: null, weeklyRateKg: 0 }));
      create();

      expect(el().querySelector('.sentence')).toBeNull();
    });
  });

  describe('loading and failure', () => {
    it('shows the figures at once and a skeleton of the chart height until the trend arrives', () => {
      const pending = new Subject<ProgressInsight>();
      dataService.getProgressInsight.and.returnValue(pending);
      create();

      expect(text('strong.weight')).toEqual(['71.1 kg']);
      expect(figures()).toEqual(['Body fat 21.4%', 'BMI 22.4']);
      const skeleton = el().querySelector('.trend-skeleton');
      expect(skeleton).not.toBeNull();
      expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
      expect(el().querySelector('svg.weight')).toBeNull();

      pending.next(insight);
      fixture.detectChanges();

      expect(el().querySelector('.trend-skeleton')).toBeNull();
      expect(el().querySelector('svg.weight')).not.toBeNull();
    });

    it('leaves out the chart and the sentence and keeps the figures when the request fails', () => {
      dataService.getProgressInsight.and.returnValue(throwError(() => new Error('down')));
      create();

      expect(text('strong.weight')).toEqual(['71.1 kg']);
      expect(figures()).toEqual(['Body fat 21.4%', 'BMI 22.4']);
      expect(el().querySelector('app-today-weight-chart')).toBeNull();
      expect(el().querySelector('.sentence')).toBeNull();
      expect(el().querySelector('.trend-skeleton')).toBeNull();
      expect(el().textContent).not.toMatch(/null|undefined|NaN/);
    });

    it('keeps the figures when the request cannot even be made', () => {
      dataService.getProgressInsight.and.callFake((): Observable<ProgressInsight> => {
        throw new Error('no request');
      });
      create();

      expect(text('strong.weight')).toEqual(['71.1 kg']);
      expect(el().querySelector('.trend-skeleton')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('says No measurement yet and makes no request', () => {
      create({ metric: null });

      expect(spaced(el())).toBe('No measurement yet Record a measurement');
      expect(el().querySelector('.action.primary')?.getAttribute('href')).toBe('/body');
      expect(dataService.getProgressInsight).not.toHaveBeenCalled();
    });

    it('asks for the trend when a measurement arrives later, and asks again only when it changes', () => {
      create({ metric: null });

      fixture.componentRef.setInput('metric', metric);
      fixture.detectChanges();
      expect(dataService.getProgressInsight).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('metric', { ...metric });
      fixture.detectChanges();
      expect(dataService.getProgressInsight).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('metric', { ...metric, weightKg: 70.8, measuredAt: '2026-10-02' });
      fixture.detectChanges();
      expect(dataService.getProgressInsight).toHaveBeenCalledTimes(2);
    });
  });
});
