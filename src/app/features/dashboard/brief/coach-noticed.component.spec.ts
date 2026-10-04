import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BriefObservation } from './brief-observations';
import { CoachNoticedComponent } from './coach-noticed.component';

const observations: BriefObservation[] = [
  { id: 'rested', icon: 'rest', muscle: 'CHEST', fact: 'Chest, back and legs have had two days off.', note: 'They were last trained on Friday, so they are ready whenever you are.' },
  { id: 'streak', icon: 'streak', muscle: 'CORE', fact: 'Your core has worked eight sessions running.', note: 'Plank was in every session this week, including yesterday.' },
  { id: 'best-single', icon: 'strength', muscle: null, fact: 'Your Deadlift best single rose 14% to 93.3 kg.', note: 'It was 81.7 kg before.' }
];

describe('CoachNoticedComponent', () => {
  let fixture: ComponentFixture<CoachNoticedComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CoachNoticedComponent] }).compileComponents();
    fixture = TestBed.createComponent(CoachNoticedComponent);
    fixture.componentRef.setInput('observations', observations);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('renders one row for each observation, fact first', () => {
    const facts = Array.from(element.querySelectorAll('.noticed-fact')).map((node) => node.textContent?.trim());
    const notes = Array.from(element.querySelectorAll('.noticed-note')).map((node) => node.textContent?.trim());
    expect(facts).toEqual(observations.map((observation) => observation.fact));
    expect(notes).toEqual(observations.map((observation) => observation.note));
  });

  it('draws the muscle glyph when the observation is about a muscle group', () => {
    const rows = element.querySelectorAll('.noticed-row');
    // The core glyph is six small blocks, which no other glyph has.
    expect(rows[1].querySelectorAll('svg rect').length).toBe(6);
  });

  it('draws the trend glyph for the best single observation', () => {
    const rows = element.querySelectorAll('.noticed-row');
    expect(rows[2].querySelectorAll('svg path').length).toBe(2);
    expect(rows[2].querySelectorAll('svg rect').length).toBe(0);
  });

  it('offers no controls, because an observation is not an instruction', () => {
    expect(element.querySelectorAll('button, a').length).toBe(0);
  });

  it('labels the section with its heading', () => {
    const section = element.querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('coach-noticed-title');
    expect(element.querySelector('#coach-noticed-title')?.textContent?.trim()).toBe('What your coach noticed');
  });
});
