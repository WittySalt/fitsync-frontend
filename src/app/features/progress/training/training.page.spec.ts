import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { TrainingApiService } from './training-api.service';
import { trainingFixture } from './training-fixture.spec';
import { TrainingPage, heroTiles } from './training.page';
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
    expect(host.querySelector('app-progress-hero')).not.toBeNull();
  });

  it('draws every section of the board from a full response', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    for (const selector of ['app-progress-hero', 'app-highlights', 'app-activity-card', 'app-strength-section', 'app-muscle-figure', 'app-load-chart', 'app-training-calendar', 'app-records-section']) {
      expect(host.querySelector(selector)).withContext(selector).not.toBeNull();
    }
    expect(host.textContent).toContain('worked out as weight × (1 + reps ÷ 30)');
    expect(host.textContent).toContain('this week so far');
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
    host.querySelector<HTMLButtonElement>('app-strength-section app-section-card .ask')?.click();
    const [card] = coach.askAboutCard.calls.mostRecent().args;
    expect(card.kind).toBe('STRENGTH');
    expect(card.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('says there is not enough data yet when the period holds no session', () => {
    api.getTraining.and.returnValue(of(mapTrainingProgress({}, '2026-09-06', '2026-10-03')));
    const host = create();
    expect(host.textContent).toContain('Not enough data yet');
    expect(host.querySelector('app-strength-section')).toBeNull();
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
