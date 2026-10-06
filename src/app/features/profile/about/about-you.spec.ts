import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AboutData, dietLabel, equipmentLabels, focusCaption, focusSets, focusedGroups, injuryLabels, leadSentence, partOfDay } from './about-you';
import { AboutYouComponent } from './about-you.component';
import { dayPercent, trainingBlock } from './day-line.component';

const weightGoal = { type: 'WEIGHT', targetValue: 68, targetUnit: 'kg', targetDate: '2026-12-11' };

const steady: AboutData = {
  weeklyDays: 4,
  trainingTime: '19:00',
  goal: weightGoal,
  weightKg: 71.2,
  focusAreas: ['SHOULDERS', 'ARMS', 'GLUTES'],
  equipment: ['DUMBBELLS', 'BARBELL', 'KETTLEBELL'],
  injuries: [],
  diet: '300001',
  meals: [
    { label: 'Breakfast', time: '07:30' },
    { label: 'Lunch', time: '12:30' },
    { label: 'Dinner', time: '19:00' }
  ]
};

const fresh: AboutData = { weeklyDays: null, trainingTime: null, goal: null, weightKg: null, focusAreas: [], equipment: [], injuries: [], diet: null, meals: [] };

describe('About you', () => {
  describe('the lead sentence', () => {
    it('writes the inputs as one sentence', () => {
      expect(leadSentence(steady)).toBe('Four evenings a week, lose weight to 68 kg by 11 Dec.');
    });

    it('reads the part of the day from the usual start time', () => {
      expect(partOfDay('06:30')).toBe('morning');
      expect(partOfDay('13:00')).toBe('afternoon');
      expect(partOfDay('19:00')).toBe('evening');
      expect(partOfDay('later')).toBe('');
      expect(leadSentence({ ...steady, trainingTime: '06:30' })).toContain('Four mornings a week');
      expect(leadSentence({ ...steady, trainingTime: null })).toContain('Four days a week');
    });

    it('turns to gain when the target is above the weight now, and keeps when they are equal', () => {
      expect(leadSentence({ ...steady, weightKg: 60 })).toBe('Four evenings a week, gain weight to 68 kg by 11 Dec.');
      expect(leadSentence({ ...steady, weightKg: 68 })).toBe('Four evenings a week, keep weight at 68 kg.');
      expect(leadSentence({ ...steady, weightKg: null })).toBe('Four evenings a week, weight target 68 kg by 11 Dec.');
    });

    it('stands on one part alone, and says nothing is set for an empty account', () => {
      expect(leadSentence({ ...steady, goal: null })).toBe('Four evenings a week.');
      expect(leadSentence({ ...steady, weeklyDays: null })).toBe('Lose weight to 68 kg by 11 Dec.');
      expect(leadSentence(fresh)).toBe('Nothing set yet.');
    });
  });

  describe('the figure', () => {
    it('colours the groups of the focus areas, and the groups behind a wide area', () => {
      expect(focusedGroups(['SHOULDERS', 'ARMS', 'GLUTES']).sort()).toEqual(['ARMS', 'GLUTES', 'SHOULDERS']);
      expect(focusedGroups(['UPPER']).sort()).toEqual(['ARMS', 'BACK', 'CHEST', 'SHOULDERS']);
      expect(focusedGroups(['FULL_BODY']).length).toBe(7);
      expect(focusedGroups(['CARDIO', 'MOBILITY'])).toEqual([]);
      expect(Object.keys(focusSets(['LOWER'])).sort()).toEqual(['GLUTES', 'LEGS']);
    });

    it('writes the caption', () => {
      expect(focusCaption(['SHOULDERS', 'ARMS', 'GLUTES'])).toBe('Focus: shoulders, arms, glutes');
      expect(focusCaption(['UPPER', 'CARDIO'])).toBe('Focus: upper body, cardio');
      expect(focusCaption([])).toBe('Focus: not set');
      expect(focusCaption(['240002', '240003'])).toBe('Focus: not set');
    });
  });

  describe('the chips', () => {
    it('names equipment, diet and injuries', () => {
      expect(equipmentLabels(['DUMBBELLS', '230003'])).toEqual(['Dumbbells', 'Barbell']);
      expect(dietLabel('300001')).toBe('No preference');
      expect(dietLabel('300004')).toBe('Vegan');
      expect(dietLabel('')).toBeNull();
      expect(injuryLabels(['LOWER_BACK', ' '])).toEqual(['Lower back']);
    });
  });

  describe('the day line', () => {
    it('places a time on the line from 06:00 to 24:00', () => {
      expect(dayPercent('06:00')).toBe(0);
      expect(dayPercent('15:00')).toBe(50);
      expect(dayPercent('24:00')).toBeNull();
      expect(dayPercent('05:00')).toBeNull();
      expect(dayPercent('soon')).toBeNull();
    });

    it('draws the training hour and keeps it inside the line', () => {
      expect(trainingBlock('19:00')?.width).toBeCloseTo(5.56, 1);
      const late = trainingBlock('23:30');
      expect((late?.left ?? 0) + (late?.width ?? 0)).toBeLessThanOrEqual(100);
      expect(trainingBlock(null)).toBeNull();
    });
  });

  describe('the card', () => {
    let fixture: ComponentFixture<AboutYouComponent>;

    function render(data: AboutData): HTMLElement {
      fixture = TestBed.createComponent(AboutYouComponent);
      fixture.componentRef.setInput('data', data);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    beforeEach(() => TestBed.configureTestingModule({ imports: [AboutYouComponent], providers: [provideRouter([])] }));

    it('shows the lead, the figure caption, the day line and the chips', () => {
      const el = render(steady);

      expect(el.querySelector('.lead')?.textContent).toBe('Four evenings a week, lose weight to 68 kg by 11 Dec.');
      expect(el.querySelector('.caption')?.textContent).toBe('Focus: shoulders, arms, glutes');
      expect(el.querySelectorAll('app-day-line .dot').length).toBe(3);
      expect(el.querySelector('app-day-line .training')).toBeTruthy();
      expect(Array.from(el.querySelectorAll('.chip')).map((chip) => chip.textContent?.trim())).toEqual(['Dumbbells', 'Barbell', 'Kettlebell', 'None', 'No preference']);
      expect(el.querySelector('.foot')?.textContent).toBe('Tap anything to change it.');
    });

    it('draws the muscle figure as a picture, coloured only where a focus area is', () => {
      const el = render(steady);

      expect(el.querySelector('app-muscle-figure')).toBeTruthy();
      expect(el.querySelectorAll('app-muscle-figure button').length).toBe(0);
    });

    it('sends each element to where it is changed', () => {
      const el = render(steady);

      expect(el.querySelector('.figure')?.getAttribute('href')).toBe('/workout/plans/new');
      expect(el.querySelector('.chip')?.getAttribute('href')).toBe('/settings?section=preferences');
      expect(el.querySelector('app-day-line a')?.getAttribute('href')).toBe('/settings?section=preferences');
    });

    it('shows the empty account with an Add chip in each row and the day line hint', () => {
      const el = render(fresh);

      expect(el.querySelector('.lead')?.textContent).toBe('Nothing set yet.');
      expect(el.querySelector('.caption')?.textContent).toBe('Focus: not set');
      expect(el.querySelectorAll('.chip.add').length).toBe(3);
      expect(el.querySelector('app-day-line .hint')?.textContent).toBe('Add your usual meals and training time');
      expect(el.querySelector('.foot')?.textContent).toBe('Tap anything to add it.');
    });
  });
});
