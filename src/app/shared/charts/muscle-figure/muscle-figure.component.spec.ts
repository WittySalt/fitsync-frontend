import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MuscleFigureComponent } from './muscle-figure.component';
import { BACK_VIEW, FRONT_VIEW } from './muscle-figure.paths';
import { MUSCLE_GROUPS, formatSets, heatLevel, regionAriaLabel } from './muscle-figure';

describe('MuscleFigureComponent', () => {
  let fixture: ComponentFixture<MuscleFigureComponent>;
  let host: HTMLElement;

  const sets = { LEGS: 22, GLUTES: 15, CHEST: 14, BACK: 12, CORE: 9, ARMS: 7, SHOULDERS: 3 };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MuscleFigureComponent] });
    fixture = TestBed.createComponent(MuscleFigureComponent);
    fixture.componentRef.setInput('setsByGroup', sets);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  const regions = (): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('path.region'));

  it('draws sixteen regions, eight on each view, every one tagged with one of the seven groups', () => {
    expect(FRONT_VIEW.regions.length).toBe(8);
    expect(BACK_VIEW.regions.length).toBe(8);
    expect(regions().length).toBe(16);
    const groups = new Set(regions().map((path) => path.getAttribute('data-group')));
    expect([...groups].sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect(host.querySelectorAll('figcaption')[0].textContent).toContain('Front');
    expect(host.querySelectorAll('figcaption')[1].textContent).toContain('Back');
  });

  it('colours every region by its group on the amber-under scale', () => {
    const levelOf = (key: string): string => host.querySelector(`[data-region="${key}"]`)?.getAttribute('class') ?? '';
    expect(levelOf('front-front-shoulders')).toContain('under');
    expect(levelOf('back-rear-shoulders')).toContain('under');
    expect(levelOf('front-biceps')).toContain('low');
    expect(levelOf('front-chest')).toContain('in');
    expect(levelOf('back-glutes')).toContain('in');
    expect(levelOf('front-quads')).toContain('over');
    expect(levelOf('back-calves')).toContain('over');
  });

  it('treats a group with no figure as under', () => {
    fixture.componentRef.setInput('setsByGroup', { LEGS: 12 });
    fixture.detectChanges();
    expect(host.querySelector('[data-region="front-chest"]')?.getAttribute('class')).toContain('under');
    expect(host.querySelector('[data-region="front-quads"]')?.getAttribute('class')).toContain('in');
  });

  it('makes every region a keyboard button with a spoken label', () => {
    for (const path of regions()) {
      expect(path.getAttribute('tabindex')).toBe('0');
      expect(path.getAttribute('role')).toBe('button');
    }
    expect(host.querySelector('[data-region="front-front-shoulders"]')?.getAttribute('aria-label')).toBe('Shoulders, 3 sets a week');
    expect(host.querySelector('[data-region="back-hamstrings"]')?.getAttribute('aria-label')).toBe('Legs, 22 sets a week');
  });

  it('reports the group of a pressed region, by mouse or by keyboard', () => {
    const picked: string[] = [];
    fixture.componentInstance.groupSelected.subscribe((group) => picked.push(group));
    host.querySelector<HTMLElement>('[data-region="back-hamstrings"]')?.dispatchEvent(new MouseEvent('click'));
    host.querySelector<HTMLElement>('[data-region="front-chest"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    host.querySelector<HTMLElement>('[data-region="front-abs"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(picked).toEqual(['LEGS', 'CHEST', 'CORE']);
  });

  it('outlines the picked group and fades the rest', () => {
    fixture.componentRef.setInput('selected', 'LEGS');
    fixture.detectChanges();
    const quads = host.querySelector('[data-region="front-quads"]');
    const chest = host.querySelector('[data-region="front-chest"]');
    expect(quads?.classList).toContain('on');
    expect(quads?.getAttribute('aria-pressed')).toBe('true');
    expect(chest?.classList).toContain('dim');
    expect(chest?.getAttribute('aria-pressed')).toBe('false');
  });

  it('draws a still picture with no buttons when it is not interactive', () => {
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    expect(host.querySelectorAll('[role="button"]').length).toBe(0);
    expect(host.querySelectorAll('svg[role="img"]').length).toBe(2);
  });

  it('never draws smaller than 140 px', () => {
    fixture.componentRef.setInput('height', 90);
    fixture.detectChanges();
    expect(host.querySelector('svg')?.getAttribute('height')).toBe('140');
  });
});

describe('muscle figure helpers', () => {
  it('sorts sets into the four levels around the usual 10 to 20', () => {
    expect([0, 5.5, 6, 9.5, 10, 20, 20.5].map((value) => heatLevel(value))).toEqual(['under', 'under', 'low', 'low', 'in', 'in', 'over']);
    expect(heatLevel(Number.NaN)).toBe('under');
  });

  it('writes half sets with one decimal and whole sets without', () => {
    expect(formatSets(3)).toBe('3');
    expect(formatSets(2.5)).toBe('2.5');
    expect(formatSets(2.04)).toBe('2');
    expect(regionAriaLabel('ARMS', 1)).toBe('Arms, 1 set a week');
  });
});
