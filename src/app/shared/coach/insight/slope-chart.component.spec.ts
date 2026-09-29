import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiftProgress } from '../../../core/coach/coach.models';
import { SlopeChartComponent } from './slope-chart.component';

const lifts: LiftProgress[] = [
  { exerciseName: 'Dumbbell Bench Press', fromKg: 20, fromDate: '2026-09-13', toKg: 22.5, toDate: '2026-09-25' },
  { exerciseName: 'Bent-Over Row', fromKg: 20, fromDate: '2026-09-13', toKg: 18, toDate: '2026-09-25' }
];

describe('SlopeChartComponent', () => {
  let fixture: ComponentFixture<SlopeChartComponent>;
  let element: HTMLElement;

  function render(value: LiftProgress[]): void {
    fixture = TestBed.createComponent(SlopeChartComponent);
    fixture.componentRef.setInput('lifts', value);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SlopeChartComponent] }).compileComponents();
  });

  it('draws one line with two points for each lift', () => {
    render(lifts);
    expect(element.querySelectorAll('line.lift').length).toBe(2);
    expect(element.querySelectorAll('circle.from').length).toBe(2);
    expect(element.querySelectorAll('circle.to').length).toBe(2);
  });

  it('marks a lift that went down', () => {
    render(lifts);
    const lines = element.querySelectorAll('line.lift');
    expect(lines[0].classList.contains('falling')).toBeFalse();
    expect(lines[1].classList.contains('falling')).toBeTrue();
  });

  it('describes the drawing in words', () => {
    render(lifts);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Top set weight for 2 lifts, 13 Sept against 25 Sept. Dumbbell Bench Press 20 kg to 22.5 kg, Bent-Over Row 20 kg to 18 kg.'
    );
  });

  it('writes the same lifts as a list for narrow panels', () => {
    render(lifts);
    const column = (selector: string): string[] =>
      Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(column('.lift-list .lift-name')).toEqual(['Dumbbell Bench Press', 'Bent-Over Row']);
    expect(column('.lift-list .lift-values strong')).toEqual(['22.5 kg', '18 kg']);
    expect(column('.lift-list .lift-change')).toEqual(['up 12.5%', 'down 10%']);
  });

  it('draws nothing when there is no lift', () => {
    render([]);
    expect(element.children.length).toBe(0);
  });
});
