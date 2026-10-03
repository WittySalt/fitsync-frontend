import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { ActivityPage } from './activity/activity.page';
import { ExercisePage } from './exercise/exercise.page';
import { TrainingApiService } from './training-api.service';
import { mapActivityProgress, mapExerciseProgress } from './training-mappers';
import { TRAINING_ROUTES } from './training.routes';

const ACTIVITY = mapActivityProgress(
  {
    key: 'SPORT:badminton',
    name: 'Badminton',
    kind: 'SPORT',
    tiles: { minutes: 245, sessions: 4, weeksInARow: 5, longestSession: { minutes: 70, date: '2026-08-30' }, effort: { average: 6.1, first: 5, last: 7 } },
    weekly: [{ weekStart: '2026-09-21', minutes: 60, sessions: 1, current: false }, { weekStart: '2026-09-28', minutes: 0, sessions: 0, current: true }],
    sessions: [
      { sessionId: 's-9', startedAt: '2026-09-26T07:10:00Z', minutes: 65, effort: 7, calories: 520 },
      { sessionId: 's-8', startedAt: '2026-09-20T07:00:00Z', minutes: 60, effort: null, estimatedEffort: true }
    ],
    whenGrid: [{ weekday: 7, hour: 15, count: 3 }],
    summary: [{ text: 'Once a week, 5 weeks in a row', trend: 'STEADY' }],
    context: '+1 h 10 on the 4 weeks before'
  },
  'SPORT:badminton'
);

const EXERCISE = mapExerciseProgress(
  {
    exerciseId: 'dl',
    name: 'Deadlift',
    primaryGroup: 'BACK',
    secondaryGroups: ['LEGS', 'GLUTES'],
    equipment: 'BARBELL',
    firstSeen: '2026-08-07',
    sessions: 14,
    tiles: { e1rm: { value: 93.3, changeKg: 12, since: '2026-08-07' }, heaviestSet: { weightKg: 80, reps: 5, date: '2026-10-02' }, bestVolume: { kg: 1175, date: '2026-10-02' }, records: 5 },
    series: {
      e1rm: [{ date: '2026-09-22', value: 87.5 }, { date: '2026-10-02', value: 93.3, isRecord: true }],
      heaviest: [{ date: '2026-09-22', value: 75 }, { date: '2026-10-02', value: 80 }],
      volume: [{ date: '2026-09-22', value: 1100 }],
      reps: []
    },
    history: [
      { sessionId: 's-2', date: '2026-10-02', sets: [{ weightKg: 80, reps: 5 }, { weightKg: 75, reps: 6 }], record: true },
      { sessionId: 's-1', date: '2026-09-22', sets: [{ weightKg: 75, reps: 5 }], record: false }
    ],
    summary: [{ text: 'About 2.5 kg more each week', trend: 'UP' }]
  },
  'dl'
);

function route(params: Record<string, string>) {
  const query = new BehaviorSubject(convertToParamMap({}));
  return { paramMap: of(convertToParamMap(params)), queryParamMap: query, snapshot: { queryParamMap: convertToParamMap({}), paramMap: convertToParamMap(params) } };
}

describe('Training detail pages', () => {
  let api: jasmine.SpyObj<TrainingApiService>;
  let coach: jasmine.SpyObj<CoachStore>;

  function setUp(params: Record<string, string>): void {
    api = jasmine.createSpyObj<TrainingApiService>('TrainingApiService', ['getActivity', 'getExercise']);
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['askAboutCard']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route(params) },
        { provide: TrainingApiService, useValue: api },
        { provide: CoachStore, useValue: coach }
      ]
    });
  }

  describe('ActivityPage', () => {
    beforeEach(() => setUp({ key: 'SPORT:badminton' }));

    it('reads the activity of the route key and shows its figures and sessions', () => {
      api.getActivity.and.returnValue(of(ACTIVITY));
      const fixture = TestBed.createComponent(ActivityPage);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(api.getActivity.calls.mostRecent().args[0]).toBe('SPORT:badminton');
      expect(host.querySelector('.eyebrow')?.textContent).toContain('TRAINING · BADMINTON · THE LAST 4 WEEKS');
      expect(host.querySelector('h1')?.textContent).toBe('Every week.');
      expect(host.querySelector('.sentence')?.textContent).toContain('4 sessions and 4 h 05 in four weeks, 5 weeks in a row.');
      expect(host.textContent).toContain('4 h 05');
      expect(host.textContent).toContain('6.1 of 10');
      expect(host.textContent).toContain('70 min');
      expect(host.querySelector('app-week-bars')).not.toBeNull();
      expect(host.querySelector('app-session-chart')).not.toBeNull();
      expect(host.querySelectorAll('app-when-grid [role="cell"].many').length).toBe(1);
      expect(host.querySelector('#when .sentence')?.textContent).toContain('You train most on Sundays around 15:00.');
      expect(Array.from(host.querySelectorAll('app-contents-rail .item')).map((item) => item.textContent?.trim())).toEqual([
        'What the numbers say',
        'Each week',
        'Each session',
        'When you train',
        'Sessions'
      ]);
      const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.sessions a')).map((link) => link.getAttribute('href'));
      expect(links).toEqual(['/workout/sessions/s-9', '/workout/sessions/s-8']);
      expect(host.textContent).toContain('520 kcal');
    });

    it('asks a suggested question with the activity as the card', () => {
      api.getActivity.and.returnValue(of(ACTIVITY));
      const fixture = TestBed.createComponent(ActivityPage);
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-ask-chip button')?.click();
      const [card, question] = coach.askAboutCard.calls.mostRecent().args;
      expect(card).toEqual(jasmine.objectContaining({ kind: 'SPORT', id: 'SPORT:badminton' }));
      expect(question).toBe('Should I eat more on badminton days?');
    });

    it('shows an error with a retry', () => {
      api.getActivity.and.returnValue(throwError(() => new Error('500')));
      const fixture = TestBed.createComponent(ActivityPage);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('This activity could not load');
    });
  });

  describe('ExercisePage', () => {
    beforeEach(() => setUp({ exerciseId: 'dl' }));

    it('shows the figures, the e1RM series and every session with its PR mark', () => {
      api.getExercise.and.returnValue(of(EXERCISE));
      const fixture = TestBed.createComponent(ExercisePage);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('h1')?.textContent).toBe('Getting stronger.');
      expect(host.querySelector('.sentence')?.textContent).toContain('Deadlift stands at an estimated best single of 93.3 kg');
      expect(host.textContent).toContain('Back, legs and glutes · barbell · 14 sessions since 7 Aug');
      expect(host.textContent).toContain('93.3 kg');
      expect(host.textContent).toContain('+12.0 kg since 7 Aug');
      expect(host.textContent).toContain('1,175 kg');
      expect(host.querySelector('app-series-chart circle.record')).not.toBeNull();
      const rows = host.querySelectorAll('app-exercise-history li');
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('80 kg × 5');
      expect(rows[0].querySelector('.pr')).not.toBeNull();
      expect(rows[1].querySelector('.pr')).toBeNull();
      expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/workout/sessions/s-2');
    });

    it('switches the series and says when a series is too short to draw', () => {
      api.getExercise.and.returnValue(of(EXERCISE));
      const fixture = TestBed.createComponent(ExercisePage);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('#series app-ink-switch button'));
      buttons.find((button) => button.textContent?.trim() === 'Volume')?.click();
      fixture.detectChanges();
      expect(host.textContent).toContain('Not enough data yet');
      buttons.find((button) => button.textContent?.trim() === 'Heaviest weight')?.click();
      fixture.detectChanges();
      expect(host.querySelector('app-series-chart svg')).not.toBeNull();
    });

    it('writes the period to the URL', () => {
      api.getExercise.and.returnValue(of(EXERCISE));
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(ExercisePage);
      fixture.detectChanges();
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-detail-head app-ink-switch button'))
        .find((button) => button.textContent?.trim() === '1 year')
        ?.click();
      expect(navigate.calls.mostRecent().args[1]?.queryParams).toEqual({ period: '1y' });
    });
  });

  it('routes the page, one activity and one exercise lazily', async () => {
    expect(TRAINING_ROUTES.map((entry) => entry.path)).toEqual(['', 'activities/:key', 'exercises/:exerciseId']);
    const loaded = await Promise.all(TRAINING_ROUTES.map((entry) => (entry.loadComponent as () => Promise<unknown>)()));
    expect(loaded.every((component) => typeof component === 'function')).toBeTrue();
  });
});
