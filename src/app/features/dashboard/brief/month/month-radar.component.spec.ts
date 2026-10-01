import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { MonthRadarComponent } from './month-radar.component';

const group = (code: string, label: string, sessions: number): MonthMuscleInsight => ({ group: code, label, sessions });

const FIVE = [group('CHEST', 'Chest', 8), group('BACK', 'Back', 4), group('CORE', 'Core', 13), group('LEGS', 'Legs', 1), group('CARDIO', 'Cardio', 5)];
const TWO = [group('CHEST', 'Chest', 3), group('BACK', 'Back', 6)];

describe('MonthRadarComponent', () => {
  let fixture: ComponentFixture<MonthRadarComponent>;
  let picked: string[];

  function mount(muscles: MonthMuscleInsight[], selected: string | null = null): void {
    fixture = TestBed.createComponent(MonthRadarComponent);
    fixture.componentRef.setInput('muscles', muscles);
    fixture.componentRef.setInput('selected', selected);
    picked = [];
    fixture.componentInstance.groupSelected.subscribe((code) => picked.push(code));
    fixture.detectChanges();
  }

  const labels = (): SVGGElement[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<SVGGElement>('g.label'));

  it('makes every label of the radar a focusable button with its sessions as its name', () => {
    mount(FIVE);
    expect(labels().length).toBe(5);
    for (const label of labels()) {
      expect(label.getAttribute('role')).toBe('button');
      expect(label.getAttribute('tabindex')).toBe('0');
      expect(label.getAttribute('aria-pressed')).toBe('false');
      expect(label.querySelector('rect.hit')).not.toBeNull();
    }
    expect(labels().map((label) => label.getAttribute('aria-label'))).toEqual(['Chest, 8 sessions', 'Core, 13 sessions', 'Legs, 1 session', 'Back, 4 sessions', 'Cardio, 5 sessions']);
  });

  it('draws the chart as a group, so the buttons inside it can be reached', () => {
    mount(FIVE);
    expect((fixture.nativeElement as HTMLElement).querySelector('svg')?.getAttribute('role')).toBe('group');
  });

  it('makes the bar rows buttons as well when fewer than three groups were trained', () => {
    mount(TWO);
    expect(labels().map((label) => label.getAttribute('data-group'))).toEqual(['CHEST', 'BACK']);
    expect(labels().every((label) => label.getAttribute('role') === 'button')).toBeTrue();
  });

  it('shows the picked group as pressed and draws it in the selected style', () => {
    mount(FIVE, 'CORE');
    const pressed = labels().filter((label) => label.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((label) => label.getAttribute('data-group'))).toEqual(['CORE']);
    expect(pressed[0].classList).toContain('selected');
  });

  it('reports the group on a click, on Enter and on Space', () => {
    mount(FIVE);
    const chest = labels()[0];
    chest.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    chest.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    chest.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(picked).toEqual(['CHEST', 'CHEST', 'CHEST']);
  });

  it('keeps Space from scrolling the page', () => {
    mount(FIVE);
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    labels()[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
  });

  it('puts the focus on the label of a group', () => {
    mount(FIVE);
    fixture.componentInstance.focusGroup('LEGS');
    expect(document.activeElement).toBe(labels().find((label) => label.getAttribute('data-group') === 'LEGS') ?? null);
  });
});
