import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MuscleWheelComponent, MuscleWheelSector } from './muscle-wheel.component';

const planWeek: MuscleWheelSector[] = [
  { code: 'CHEST', label: 'Chest', sessions: 2, trainedYesterday: false },
  { code: 'BACK', label: 'Back', sessions: 2, trainedYesterday: false },
  { code: 'CORE', label: 'Core', sessions: 4, trainedYesterday: true },
  { code: 'LEGS', label: 'Legs', sessions: 2, trainedYesterday: false },
  { code: 'CARDIO', label: 'Cardio', sessions: 2, trainedYesterday: true }
];

describe('MuscleWheelComponent', () => {
  let fixture: ComponentFixture<MuscleWheelComponent>;
  let element: HTMLElement;

  function render(sectors: MuscleWheelSector[], completed = 4, target: number | null = 4): void {
    fixture = TestBed.createComponent(MuscleWheelComponent);
    fixture.componentRef.setInput('sectors', sectors);
    fixture.componentRef.setInput('completed', completed);
    fixture.componentRef.setInput('target', target);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MuscleWheelComponent] }).compileComponents();
  });

  it('draws five rings and one badge for each muscle group', () => {
    render(planWeek);
    expect(element.querySelectorAll('path.cell').length).toBe(25);
    expect(element.querySelectorAll('circle.badge').length).toBe(5);
  });

  it('fills one ring for each session and marks the one added yesterday', () => {
    render(planWeek);
    expect(element.querySelectorAll('path.cell.trained').length).toBe(10);
    expect(element.querySelectorAll('path.cell.yesterday').length).toBe(2);
  });

  it('names every group with its count', () => {
    render(planWeek);
    const names = Array.from(element.querySelectorAll('text.name')).map((node) => node.textContent?.trim());
    const counts = Array.from(element.querySelectorAll('text.count')).map((node) => node.textContent?.trim());
    expect(names).toEqual(['Chest', 'Back', 'Core', 'Legs', 'Cardio']);
    expect(counts).toEqual(['2 sessions', '2 sessions', '4 sessions', '2 sessions', '2 sessions']);
  });

  it('writes a single session in the singular', () => {
    render([{ code: 'ARMS', label: 'Arms', sessions: 1, trainedYesterday: false }]);
    expect(element.querySelector('text.count')?.textContent?.trim()).toBe('1 session');
  });

  it('shows the week against the goal in the centre', () => {
    render(planWeek, 4, 4);
    expect(element.querySelector('text.total')?.textContent?.replace(/\s+/g, '')).toBe('4/4');
  });

  it('shows only the count when there is no goal', () => {
    render(planWeek, 3, null);
    expect(element.querySelector('text.total')?.textContent?.replace(/\s+/g, '')).toBe('3');
  });

  it('describes the wheel in words for a screen reader', () => {
    render(planWeek);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Sessions this week for each muscle group. Chest two, back two, core four, legs two, cardio two.'
    );
  });

  it('leaves Yesterday out of the legend when nothing was trained yesterday', () => {
    render(planWeek.map((sector) => ({ ...sector, trainedYesterday: false })));
    expect(element.querySelector('.legend')?.textContent).not.toContain('Yesterday');
    expect(element.querySelector('.legend')?.textContent).toContain('Trained');
    expect(element.querySelector('.legend')?.textContent).toContain('Open');
  });

  it('has a glyph for all nine muscle groups', () => {
    const codes: MuscleWheelSector['code'][] = ['FULL_BODY', 'CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'GLUTES', 'LEGS', 'CARDIO'];
    codes.forEach((code) => {
      render([{ code, label: code, sessions: 0, trainedYesterday: false }]);
      expect(element.querySelectorAll('g.icon > *').length).withContext(code).toBeGreaterThan(0);
    });
  });

  it('redraws when the sectors change', () => {
    render(planWeek);
    fixture.componentRef.setInput('sectors', planWeek.slice(0, 4));
    fixture.detectChanges();
    expect(element.querySelectorAll('circle.badge').length).toBe(4);
  });
});
