import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CoachStore } from '../../core/coach/coach.store';
import { HighlightsComponent, highlightChart } from './highlights.component';
import { JumpBarComponent } from './jump-bar.component';
import { ProgressHeroComponent } from './progress-hero.component';
import { ProgressCardContext } from './progress.models';
import { SectionCardComponent } from './section-card.component';
import { SummaryLinesComponent } from './summary-lines.component';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const card: ProgressCardContext = { kind: 'GOAL', from: '2026-09-06', to: '2026-10-03' };

describe('progress sections', () => {
  let coach: { askAboutCard: jasmine.Spy };

  beforeEach(() => {
    coach = { askAboutCard: jasmine.createSpy('askAboutCard') };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CoachStore, useValue: coach }] });
  });

  function render<T>(type: Type<T>, inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(type);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('SectionCardComponent', () => {
    it('shows the title, the line under it and the coach line', () => {
      const { el } = render(SectionCardComponent, { title: 'Weight', sub: 'weekly average', coachLine: 'The drop passed 0.4 kg.' });
      expect(text(el.querySelector('h2'))).toBe('Weight');
      expect(text(el.querySelector('.sub'))).toBe('weekly average');
      expect(text(el.querySelector('.coach p'))).toBe('The drop passed 0.4 kg.');
      expect(el.querySelector('.ask')).toBeNull();
    });

    it('opens the coach with the card context and emits it when Ask is pressed', () => {
      const { fixture, el } = render(SectionCardComponent, { title: 'Goal', context: card, link: '/progress/goal' });
      const router = TestBed.inject(Router);
      const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
      let emitted: ProgressCardContext | null = null;
      fixture.componentInstance.ask.subscribe((value) => (emitted = value));
      el.querySelector<HTMLButtonElement>('.ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith(card);
      expect(emitted!).toEqual(card);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('opens its page from a click anywhere on the card', () => {
      const { el } = render(SectionCardComponent, { title: 'Goal', link: '/progress/goal' });
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      el.querySelector<HTMLElement>('.card')!.click();
      expect(navigate).toHaveBeenCalledOnceWith('/progress/goal');
      expect(el.querySelector('a.open')?.getAttribute('aria-label')).toBe('Open Goal');
    });

    it('carries the badge of the fact that cites it, and the ring', () => {
      const { el } = render(SectionCardComponent, { title: 'Food', factNumber: 3, ringed: true });
      expect(text(el.querySelector('.cite'))).toBe('3');
      expect(text(el.querySelector('.fact-note'))).toBe("Fact 3 in your coach's reading");
      expect(el.querySelector('.card.ringed')).not.toBeNull();
    });
  });

  describe('SummaryLinesComponent', () => {
    it('shows each line with its trend word in lower case and the context', () => {
      const { el } = render(SummaryLinesComponent, {
        lines: [
          { figure: '−0.41 kg', text: 'a week, the last 28 days', trend: 'faster' },
          { text: 'Volume 1.9 t a week', trend: 'STEADY' }
        ],
        context: 'Was −0.28 kg a week'
      });
      expect(Array.from(el.querySelectorAll('.trend')).map((t) => text(t))).toEqual(['faster', 'steady']);
      expect(text(el.querySelector('strong'))).toBe('−0.41 kg');
      expect(text(el.querySelector('.context'))).toBe('Was −0.28 kg a week');
    });

    it('says not enough data yet without lines', () => {
      expect(text(render(SummaryLinesComponent, { lines: [] }).el)).toBe('Not enough data yet');
    });
  });

  describe('ProgressHeroComponent', () => {
    it('shows the back link, the title and the four figures with their comparisons', () => {
      const { el } = render(ProgressHeroComponent, {
        eyebrow: 'Goal',
        title: '68 kg by 11 Dec',
        sub: 'Each change is compared with the 4 weeks before.',
        stats: [
          { label: 'Now', value: '71.2', unit: 'kg', context: '−1.6 kg on 4 weeks before' },
          { label: 'Days left', value: '69' }
        ]
      });
      expect(text(el.querySelector('.back'))).toBe('Progress');
      expect(el.querySelector('.back')?.getAttribute('href')).toBe('/progress');
      expect(text(el.querySelector('h1'))).toBe('68 kg by 11 Dec');
      expect(el.querySelectorAll('.stat').length).toBe(2);
      expect(text(el.querySelector('.stat dt'))).toBe('Now');
      expect(text(el.querySelector('.stat .value'))).toBe('71.2 kg');
      expect(text(el.querySelector('.stat .context'))).toBe('−1.6 kg on 4 weeks before');
    });

    it('hides the back link when asked', () => {
      expect(render(ProgressHeroComponent, { eyebrow: 'x', title: 'y', back: null }).el.querySelector('.back')).toBeNull();
    });
  });

  describe('JumpBarComponent', () => {
    it('marks the active section and says which one was chosen', () => {
      const { fixture, el } = render(JumpBarComponent, {
        items: [
          { id: 'summary', label: 'Summary' },
          { id: 'goal', label: 'Goal' }
        ],
        active: 'goal'
      });
      let chosen = '';
      fixture.componentInstance.chosen.subscribe((id) => (chosen = id));
      expect(el.querySelector('[aria-current="true"]')?.textContent?.trim()).toBe('Goal');
      el.querySelector<HTMLButtonElement>('.chip')!.click();
      expect(chosen).toBe('summary');
    });
  });

  describe('HighlightsComponent', () => {
    const highlights = [
      { code: 'RATE_IN_RANGE', title: 'You lose 0.41 kg a week.', series: [{ label: '2026-09-07', value: 0.3 }, { label: '2026-09-28', value: 0.41 }], unit: 'kg', context: 'Was 0.28' },
      { code: 'LOG_VS_SCALE', title: 'The log says −0.7 kg.', series: [{ label: 'Food log', value: -0.7 }, { label: 'Scale', value: -2.7 }], unit: 'kg', context: '' },
      { code: 'WAIST_VS_WEIGHT', title: 'Waist is down.', series: [], unit: 'cm', context: '' },
      { code: 'NEW_RULE', title: 'Something else.', series: [], unit: '', context: '' }
    ];

    it('draws each finding with its kicker and the right kind of chart', () => {
      const { el } = render(HighlightsComponent, { highlights, sub: 'one finding each' });
      const cards = el.querySelectorAll('.card');
      expect(cards.length).toBe(4);
      expect(text(cards[0].querySelector('.kicker'))).toBe('Pace');
      expect(cards[0].querySelector('app-small-trend')).not.toBeNull();
      expect(text(cards[1].querySelector('.bars'))).toContain('−2.7 kg');
      expect(cards[3].querySelector('.kicker')).toBeNull();
      expect(text(el.querySelector('.more'))).toBe('2 more highlights ›');
    });

    it('chooses lines for dated series and bars for a few named values', () => {
      expect(highlightChart([])).toBe('none');
      expect(highlightChart([{ label: 'A', value: 1 }, { label: 'B', value: 2 }])).toBe('bars');
      expect(highlightChart([{ label: '2026-09-01', value: 1 }, { label: '2026-09-08', value: 2 }])).toBe('line');
      expect(highlightChart([1, 2, 3, 4].map((v) => ({ label: `W${v}`, value: v })))).toBe('line');
    });

    it('opens every highlight after "more" and asks about the card context', () => {
      const { fixture, el } = render(HighlightsComponent, { highlights, context: card });
      el.querySelector<HTMLButtonElement>('.more')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.grid.open')).not.toBeNull();
      expect(el.querySelector('.more')).toBeNull();
      el.querySelector<HTMLButtonElement>('.ask')!.click();
      expect(coach.askAboutCard).toHaveBeenCalledOnceWith(card);
    });

    it('says not enough data yet without highlights', () => {
      expect(text(render(HighlightsComponent, { highlights: [] }).el.querySelector('.none'))).toContain('Not enough data yet');
    });
  });
});
