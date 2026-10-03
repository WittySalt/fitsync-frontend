import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { TrainingApiService } from './training-api.service';
import { trainingFixture } from './training-fixture.spec';
import { TrainingPage, heroTiles, trainingSentence, trainingVerdict } from './training.page';
import { TrainingProgress } from './training.models';
import { mapTrainingProgress } from './training-mappers';

describe('TrainingPage', () => {
  let api: jasmine.SpyObj<TrainingApiService>;
  let coach: jasmine.SpyObj<CoachStore>;
  let fixture: ComponentFixture<TrainingPage>;

  function create(): HTMLElement {
    fixture = TestBed.createComponent(TrainingPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<TrainingApiService>('TrainingApiService', ['getTraining']);
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['askAboutCard']);
    TestBed.configureTestingModule({
      imports: [TrainingPage],
      providers: [provideRouter([]), { provide: TrainingApiService, useValue: api }, { provide: CoachStore, useValue: coach }]
    });
  });

  it('shows skeletons while the read runs, for the last four weeks', () => {
    api.getTraining.and.returnValue(new Subject<TrainingProgress>());
    const host = create();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    const [from, to] = api.getTraining.calls.mostRecent().args;
    expect(Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)).toBe(27);
  });

  it('offers a retry after an error and reads again', () => {
    api.getTraining.and.returnValue(throwError(() => new Error('502')));
    const host = create();
    expect(host.textContent).toContain('Training progress could not load');
    api.getTraining.and.returnValue(of(trainingFixture()));
    host.querySelector<HTMLButtonElement>('app-state-panel button')?.click();
    fixture.detectChanges();
    expect(api.getTraining).toHaveBeenCalledTimes(2);
    expect(host.querySelector('app-detail-head')).not.toBeNull();
  });

  it('draws every section of the board from a full response', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    for (const selector of ['app-detail-head', 'app-contents-rail', 'app-highlights', 'app-activity-card', 'app-strength-section', 'app-muscle-figure', 'app-load-chart', 'app-training-calendar', 'app-records-section']) {
      expect(host.querySelector(selector)).withContext(selector).not.toBeNull();
    }
    expect(host.textContent).toContain('The lighter bar is this week so far');
    expect(Array.from(host.querySelectorAll('app-detail-section h2')).map((h) => h.textContent?.trim())).toEqual([
      'Highlights',
      'By activity',
      'Strength',
      'Hard sets a week by group',
      'Training load',
      'Training log',
      'Records'
    ]);
    expect(host.querySelector('.hero, app-progress-hero')).toBeNull();
    expect(host.textContent).toContain('Fresh');
    expect(host.querySelectorAll('app-activity-card').length).toBe(2);
    expect(host.querySelector('app-activity-card a')?.getAttribute('href')).toBe('/progress/training/activities/STRENGTH');
  });

  it('shows the e1RM of each lift in Fraunces with its change, best set and ladder', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    const card = host.querySelector('app-lift-card')!;
    expect(card.querySelector('.figure strong')?.textContent?.trim()).toBe('93.3 kg');
    expect(card.textContent).toContain('est. best single');
    expect(card.textContent).toContain('+14%');
    expect(card.textContent).toContain('best set 80 kg × 5');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/progress/training/exercises/dl');
    const ladder = host.querySelector('app-strength-section .rows')!;
    expect(ladder.querySelector('app-ladder')).not.toBeNull();
    expect(ladder.textContent).toContain('Intermediate');
    expect(ladder.textContent).toContain('next: advanced at 89 kg');
  });

  it('keeps two highlights on a phone behind "2 more highlights"', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    expect(host.querySelectorAll('app-highlights .card').length).toBe(4);
    const more = host.querySelector<HTMLButtonElement>('app-highlights .more')!;
    expect(more.textContent).toContain('2 more highlights');
    more.click();
    fixture.detectChanges();
    expect(host.querySelector('app-highlights .more')).toBeNull();
  });

  it('lists the exercises of a tapped muscle group', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    host.querySelector<SVGPathElement>('[data-region="back-hamstrings"]')?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    const detail = host.querySelector('app-muscle-group-detail')!;
    expect(detail.textContent).toContain('Legs');
    expect(detail.textContent).toContain('22 hard sets a week, above the usual 10 to 20.');
    expect(detail.textContent).toContain('Romanian deadlift');
  });

  it('asks the coach about a section with its kind and period', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    host.querySelector<HTMLButtonElement>('app-strength-section app-detail-section .ask')?.click();
    const [card, prefill] = coach.askAboutCard.calls.mostRecent().args;
    expect(card.kind).toBe('STRENGTH');
    expect(card.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The formula that used to sit beside the title now goes into the question.
    expect(prefill).toContain('worked out as weight × (1 + reps ÷ 30)');
  });

  it('opens with the verdict, one sentence and the four figures, the period as ink text, and no green block', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    expect(host.querySelector('app-detail-head h1')?.textContent?.trim()).toBe('Strong month.');
    expect(host.querySelector('app-detail-head .eyebrow')?.textContent).toContain('TRAINING · THE LAST 4 WEEKS');
    expect(host.querySelector('app-detail-head .sentence')?.textContent).toContain('15 sessions and 11 h 50 in four weeks');
    expect(host.querySelectorAll('app-detail-head dt').length).toBe(4);
    expect(Array.from(host.querySelectorAll('app-detail-head app-ink-switch button')).map((b) => b.textContent?.trim())).toEqual(['4 weeks', '3 months', '1 year']);
    expect(host.querySelector('app-detail-head app-ink-switch button.on')?.textContent?.trim()).toBe('4 weeks');
  });

  it('gives the month a verdict from its records and its sessions, scaled to a longer period', () => {
    const base = trainingFixture();
    const hero = (sessions: number, records: number) => ({ ...base, hero: { ...base.hero, sessions: { value: sessions, previous: 3 }, records: { ...base.hero.records, value: records } } });
    expect(trainingVerdict(hero(15, 3), '4w')).toEqual({ text: 'Strong month.', tone: 'good' });
    expect(trainingVerdict(hero(3, 0), '4w')).toEqual({ text: 'Quiet month.', tone: 'ink' });
    expect(trainingVerdict(hero(8, 2), '4w')).toEqual({ text: 'Steady month.', tone: 'good' });
    // A longer period is judged by sessions a week over the weeks that have a session.
    const weeksOf = (count: number, sessions: number) => ({ ...hero(sessions, 0), calendar: Array.from({ length: count }, (_, k) => ({ ...base.calendar[0], date: new Date(Date.parse('2026-01-05T00:00:00Z') + k * 7 * 86_400_000).toISOString().slice(0, 10) })) });
    expect(trainingVerdict(weeksOf(10, 31), '1y').text).toBe('Strong year.');
    expect(trainingVerdict(weeksOf(10, 20), '1y').text).toBe('Steady year.');
    expect(trainingVerdict(weeksOf(10, 12), '3m').text).toBe('Quiet quarter.');
    expect(trainingSentence(hero(15, 3), '3m')).toContain('in three months, 3 new records');
  });

  it('says there is not enough data yet when the period holds no session', () => {
    api.getTraining.and.returnValue(of(mapTrainingProgress({}, '2026-09-06', '2026-10-03')));
    const host = create();
    expect(host.textContent).toContain('Not enough data yet');
    expect(host.querySelector('app-strength-section')).toBeNull();
  });

  it('says there is no earlier data when the period before has none, never a percentage from zero', () => {
    const base = trainingFixture();
    const bare = { ...base, hero: { ...base.hero, sessions: { value: 3, previous: null }, load: { ...base.hero.load, value: 900, previous: 0 } } };
    const contexts = heroTiles(bare).map((tile) => tile.context);
    expect(contexts[0]).toBe('No earlier data');
    expect(contexts[2]).toBe('No earlier data');
    const empty = { ...base, hero: { ...base.hero, sessions: { value: 31, previous: 0 }, minutes: { value: 1500, previous: 0 } } };
    expect(heroTiles(empty).map((tile) => tile.context).slice(0, 2)).toEqual(['No earlier data', 'No earlier data']);
  });

  it('writes the hero figures with their change on the period before', () => {
    expect(heroTiles(trainingFixture()).map((tile) => [tile.value, tile.context])).toEqual([
      ['15', '+2'],
      ['11 h 50', '+1 h 10'],
      ['4,320', '+9%'],
      ['4', 'deadlift, squat']
    ]);
  });
});
