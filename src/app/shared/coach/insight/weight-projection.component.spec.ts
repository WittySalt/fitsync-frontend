import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressInsight } from '../../../core/fitsync.models';
import { WeightProjectionComponent } from './weight-projection.component';

const insight: ProgressInsight = {
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

describe('WeightProjectionComponent', () => {
  let fixture: ComponentFixture<WeightProjectionComponent>;
  let element: HTMLElement;

  function render(value: ProgressInsight): void {
    fixture = TestBed.createComponent(WeightProjectionComponent);
    fixture.componentRef.setInput('insight', value);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function column(selector: string): string[] {
    return Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WeightProjectionComponent] }).compileComponents();
  });

  it('draws the series, the latest dot with its value, the goal line and the continuation', () => {
    render(insight);
    expect(element.querySelector('polyline.series')).not.toBeNull();
    expect(element.querySelectorAll('circle.latest').length).toBe(1);
    expect(column('text.latest-label')).toEqual(['71.1 kg']);
    expect(element.querySelector('line.goal-line')).not.toBeNull();
    expect(column('text.goal-label')).toEqual(['Goal 68 kg']);
    expect(element.querySelector('line.projection')).not.toBeNull();
    expect(element.querySelector('circle.reach')).not.toBeNull();
    expect(element.querySelector('path.arrow')).toBeNull();
  });

  it('labels the first, latest and projected dates on the axis', () => {
    render(insight);
    expect(column('text.date')).toEqual(['13 Sept', '1 Oct', '25 Oct']);
  });

  it('ends a far projection in an arrow head instead of a dot on the goal', () => {
    render({ ...insight, projectedDate: '2027-06-01' });
    expect(element.querySelector('path.arrow')).not.toBeNull();
    expect(element.querySelector('circle.reach')).toBeNull();
    expect(column('text.date')).toContain('1 Jun 2027');
  });

  it('leaves out the goal and the continuation when there is no goal', () => {
    render({ ...insight, goalWeightKg: null });
    expect(element.querySelector('line.goal-line')).toBeNull();
    expect(element.querySelector('line.projection')).toBeNull();
  });

  it('states the latest weight, the goal and the projected date in the text alternative', () => {
    render(insight);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Latest weight 71.1 kg on 1 Oct. Goal 68 kg. At this pace the goal is reached around 25 Oct.'
    );
  });

  it('writes the same figures as a list for narrow panels', () => {
    render(insight);
    expect(column('.weight-list dt')).toEqual(['Latest weight', 'Goal', 'Projected']);
    expect(column('.weight-list dd')).toEqual(['71.1 kg', '68 kg', '25 Oct']);
  });

  it('draws nothing with fewer than two weights', () => {
    render({ ...insight, series: [{ date: '2026-10-01', weightKg: 71.1 }] });
    expect(element.children.length).toBe(0);
  });
});
