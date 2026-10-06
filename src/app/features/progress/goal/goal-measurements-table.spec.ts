import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AccountBodyMetric, AccountDataService } from '../../../core/account-data.service';
import { GoalMeasurementsTableComponent, measurementRows } from './goal-measurements-table.component';

const metric = (over: Partial<AccountBodyMetric>): AccountBodyMetric => ({
  metricId: null,
  weightKg: null,
  bodyFatRate: null,
  waistCm: null,
  hipCm: null,
  chestCm: null,
  armCm: null,
  thighCm: null,
  calfCm: null,
  bmi: null,
  measuredAt: null,
  source: null,
  note: null,
  ...over
});

const METRICS = [
  metric({ metricId: 'a', measuredAt: '2026-09-05T08:00:00Z', weightKg: 72.8, waistCm: 85.9, bodyFatRate: 22.4, bmi: 24.1 }),
  metric({ metricId: 'b', measuredAt: '2026-10-03T08:00:00Z', weightKg: 71.2, waistCm: 83.8, bodyFatRate: 21.3, bmi: 23.6 }),
  metric({ metricId: 'c', measuredAt: '2026-09-20T08:00:00Z', weightKg: 72 })
];

describe('GoalMeasurementsTableComponent', () => {
  function render(listBodyMetrics: () => Observable<AccountBodyMetric[]>) {
    TestBed.configureTestingModule({ providers: [{ provide: AccountDataService, useValue: { listBodyMetrics } }] });
    const fixture = TestBed.createComponent(GoalMeasurementsTableComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('puts the newest measurement first and a dash where a figure was not taken', () => {
    const rows = measurementRows(METRICS);
    expect(rows.map((row) => row.weight)).toEqual(['71.2 kg', '72.0 kg', '72.8 kg']);
    expect(rows[1]).toEqual(jasmine.objectContaining({ waist: '–', bodyFat: '–', bmi: '–' }));
    expect(rows[0]).toEqual(jasmine.objectContaining({ waist: '83.8 cm', bodyFat: '21.3%', bmi: '23.6' }));
  });

  it('draws a plain table of date, waist, body fat, BMI and weight, with no icons', () => {
    const el = render(() => of(METRICS));
    expect(Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual(['Date', 'Waist', 'Body fat', 'BMI', 'Weight']);
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(el.querySelector('svg, img, i')).toBeNull();
  });

  it('says so when the read fails', () => {
    expect(render(() => throwError(() => new Error('down'))).textContent).toContain('could not load');
  });

  it('says so when there is nothing yet', () => {
    expect(render(() => of([])).textContent).toContain('No measurements yet');
  });
});
