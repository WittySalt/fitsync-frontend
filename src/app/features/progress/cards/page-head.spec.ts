import { ReadingFact } from '../../../core/coach/coach.models';
import { mapReviews } from '../progress-api.mappers';
import { WeeklyReview } from '../progress-api.models';
import { coachLineFor, firstSentence } from './coach-lines';
import { PERIODS, currentSection, eyebrowText, periodOf, reviewChips, weekChips } from './page-head';
import { watchSections } from './section-watch';

const FACTS = [
  { key: 'SESSIONS', label: 'Sessions', value: '4', unit: 'sessions', note: 'Same', detail: 'Same as the week before' },
  { key: 'MINUTES', label: 'Minutes trained', value: '170', unit: 'min', note: '−35 min', detail: '' },
  { key: 'CALORIES_PER_DAY', label: 'Calories a day', value: '2,011', unit: 'kcal', note: '', detail: 'on 5 logged days' },
  { key: 'PROTEIN_PER_DAY', label: 'Protein a day', value: '131', unit: 'g', note: '−6%', detail: 'on 5 logged days' },
  { key: 'WEIGHT_CHANGE', label: 'Weight change', value: '0.4', unit: 'kg', note: 'Down', detail: '' }
];

function review(facts: unknown[] = FACTS): WeeklyReview {
  return mapReviews([{ weekStart: '2026-09-28', weekEnd: '2026-10-04', current: true, status: 'READY', headline: 'Two sessions in.', body: 'Text [1].', facts }])[0];
}

describe('the period and the eyebrow', () => {
  it('reads ?period= and falls back to four weeks', () => {
    expect(periodOf('3m').days).toBe(91);
    expect(periodOf('1y').key).toBe('1y');
    expect(periodOf('nonsense')).toBe(PERIODS[0]);
    expect(periodOf(null)).toBe(PERIODS[0]);
  });

  it('names the period and its dates, with the year when it crosses one', () => {
    expect(eyebrowText(PERIODS[0], '2026-10-03')).toBe('Progress · The last 4 weeks · 6 Sept to 3 Oct');
    expect(eyebrowText(PERIODS[1], '2026-10-03')).toBe('Progress · The last 3 months · 5 Jul to 3 Oct');
    expect(eyebrowText(PERIODS[2], '2026-10-03')).toBe('Progress · The last year · 5 Oct 2025 to 3 Oct 2026');
  });
});

describe('the "this week so far" chips', () => {
  it('maps the four facts to four chips, in order, ignoring other facts', () => {
    const chips = weekChips(review());
    expect(chips.map((chip) => chip.label)).toEqual(['Sessions', 'Minutes', 'Calories a day', 'Protein a day']);
    expect(chips.map((chip) => chip.figure)).toEqual(['4', '170', '2,011', '131 g']);
    expect(chips.map((chip) => chip.delta)).toEqual(['Same as the week before', '−35 min', 'on 5 logged days', 'on 5 logged days']);
  });

  it('keeps a chip with a dash for a fact the review lacks, and for no review at all', () => {
    const chips = weekChips(review(FACTS.slice(0, 2)));
    expect(chips.map((chip) => chip.figure)).toEqual(['4', '170', '–', '–']);
    expect(weekChips(null).every((chip) => chip.figure === '–' && chip.delta === '')).toBeTrue();
  });

  it('lists only the facts an earlier week has', () => {
    expect(reviewChips(review(FACTS.slice(0, 2))).map((chip) => chip.key)).toEqual(['SESSIONS', 'MINUTES']);
  });
});

describe('the contents navigation', () => {
  const tops = (goal: number, training: number, food: number) => [
    { id: 'goal' as const, top: goal },
    { id: 'training' as const, top: training },
    { id: 'food' as const, top: food }
  ];

  it('is on the last card whose top has passed the reading line, and on Goal before any has', () => {
    expect(currentSection(tops(400, 1000, 1600), 300)).toBe('goal');
    expect(currentSection(tops(-200, 300, 900), 300)).toBe('training');
    expect(currentSection(tops(-1200, -500, 120), 300)).toBe('food');
    expect(currentSection([], 300)).toBe('goal');
  });

  describe('the watcher', () => {
    class FakeObserver {
      static all: FakeObserver[] = [];
      observed: Element[] = [];
      constructor(
        public callback: IntersectionObserverCallback,
        public options: IntersectionObserverInit
      ) {
        FakeObserver.all.push(this);
      }
      observe(element: Element): void {
        this.observed.push(element);
      }
      disconnect(): void {
        this.observed = [];
      }
    }

    function page(): { answer: HTMLElement; remove: () => void } {
      const host = document.createElement('div');
      host.innerHTML = '<div id="progress-answer"></div><div id="progress-goal"></div><div id="progress-training"></div><div id="progress-food"></div>';
      document.body.appendChild(host);
      return { answer: host.querySelector('#progress-answer')!, remove: () => host.remove() };
    }

    beforeEach(() => (FakeObserver.all = []));

    it('reports the section being read and whether the answer has scrolled out, and writes nothing to the address', () => {
      const { answer, remove } = page();
      const sections: string[] = [];
      const out: boolean[] = [];
      const before = location.href;
      const stop = watchSections(document, answer, { onSection: (id) => sections.push(id), onAnswerOut: (value) => out.push(value) }, (callback, options) => new FakeObserver(callback, options));
      const [reading, answerWatcher] = FakeObserver.all;
      expect(reading.observed.map((element) => element.id)).toEqual(['progress-goal', 'progress-training', 'progress-food']);
      expect(answerWatcher.observed).toEqual([answer]);

      document.getElementById('progress-goal')!.getBoundingClientRect = () => ({ top: -300 }) as DOMRect;
      document.getElementById('progress-training')!.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
      document.getElementById('progress-food')!.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
      reading.callback([], reading as unknown as IntersectionObserver);
      expect(sections).toEqual(['training']);

      answerWatcher.callback([{ isIntersecting: false, boundingClientRect: { bottom: -40 } } as IntersectionObserverEntry], answerWatcher as unknown as IntersectionObserver);
      answerWatcher.callback([{ isIntersecting: true, boundingClientRect: { bottom: 200 } } as IntersectionObserverEntry], answerWatcher as unknown as IntersectionObserver);
      answerWatcher.callback([{ isIntersecting: false, boundingClientRect: { bottom: 900 } } as IntersectionObserverEntry], answerWatcher as unknown as IntersectionObserver);
      expect(out).toEqual([true, false, false]);
      expect(location.href).toBe(before);

      stop();
      expect(reading.observed).toEqual([]);
      remove();
    });
  });
});

describe('the coach lines between the cards', () => {
  const fact = (key: string, card: ReadingFact['card'], note: string, detail: string): ReadingFact => ({ number: 1, key, label: key, value: '1', unit: '', numericValue: 1, note, detail, card });

  it('takes the first sentence of the detail, else the note, of the first fact that cites the card', () => {
    expect(firstSentence('Two sessions in 4 weeks. The week before had three.')).toBe('Two sessions in 4 weeks.');
    expect(firstSentence('You lifted 22.5 kg more')).toBe('You lifted 22.5 kg more.');
    expect(firstSentence('  ')).toBe('');
    const facts = [fact('A', 'GOAL', 'x', 'About the goal.'), fact('B', 'TRAINING', 'steady week', ''), fact('C', 'TRAINING', '', 'Later fact.'), fact('D', 'FOOD', '', 'protein fell to 131 g. More text.')];
    expect(coachLineFor(facts, 'TRAINING')).toBe('Steady week.');
    expect(coachLineFor(facts, 'FOOD')).toBe('Protein fell to 131 g.');
  });

  it('is empty when no fact fits', () => {
    expect(coachLineFor([fact('A', 'GOAL', 'x', 'y.')], 'TRAINING')).toBe('');
    expect(coachLineFor([], 'FOOD')).toBe('');
    expect(coachLineFor([fact('B', 'FOOD', '', '')], 'FOOD')).toBe('');
  });
});
