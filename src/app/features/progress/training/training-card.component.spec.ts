import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { radarFigures, recordsLine } from './card/training-card';
import { TrainingApiService } from './training-api.service';
import { TrainingCardComponent } from './training-card.component';
import { trainingFixture } from './training-fixture.spec';
import { TrainingProgress } from './training.models';

describe('TrainingCardComponent', () => {
  let api: jasmine.SpyObj<TrainingApiService>;
  let coach: jasmine.SpyObj<CoachStore>;
  let fixture: ComponentFixture<TrainingCardComponent>;

  function create(citation: number | null = 4): HTMLElement {
    fixture = TestBed.createComponent(TrainingCardComponent);
    fixture.componentRef.setInput('from', '2026-09-06');
    fixture.componentRef.setInput('to', '2026-10-03');
    fixture.componentRef.setInput('citation', citation);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<TrainingApiService>('TrainingApiService', ['getTraining']);
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['askAboutCard']);
    TestBed.configureTestingModule({
      imports: [TrainingCardComponent],
      providers: [provideRouter([]), { provide: TrainingApiService, useValue: api }, { provide: CoachStore, useValue: coach }]
    });
  });

  it('reads the period it is given and shows a skeleton meanwhile', () => {
    api.getTraining.and.returnValue(new Subject<TrainingProgress>());
    const host = create();
    expect(api.getTraining).toHaveBeenCalledWith('2026-09-06', '2026-10-03');
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the calendar, the radar, the lifts as est. best single start to now, and the citation', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const host = create();
    expect(host.querySelector('.cite')?.textContent?.trim()).toBe('4');
    expect(host.textContent).toContain('Fact 4 in your coach\'s reading');
    expect(host.textContent).toContain('3 days trained in 4 weeks');
    expect(host.querySelector('app-training-calendar')).not.toBeNull();
    expect(host.querySelector('app-training-calendar a')).toBeNull();
    expect(host.querySelector('app-training-radar')?.textContent).toContain('Hard sets a week in each area');
    const lifts = host.querySelectorAll('.lift');
    expect(lifts.length).toBe(2);
    expect(lifts[0].textContent).toContain('est. best single, 2 records');
    expect(lifts[0].textContent).toContain('+14%');
    expect(lifts[0].textContent).toContain('93.3 kg');
    expect(host.querySelector('.records')?.textContent).toContain('2 new personal records in these 4 weeks.');
  });

  it('opens the Training page from anywhere on the card, but not from Ask', () => {
    api.getTraining.and.returnValue(of(trainingFixture()));
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const host = create();
    host.querySelector<HTMLElement>('.blocks')?.click();
    expect(navigate).toHaveBeenCalledWith(['/progress/training']);
    navigate.calls.reset();
    host.querySelector<HTMLButtonElement>('app-ask-chip button')?.click();
    expect(navigate).not.toHaveBeenCalled();
    expect(coach.askAboutCard).toHaveBeenCalledWith({ kind: 'TRAINING', from: '2026-09-06', to: '2026-10-03' }, undefined);
  });

  it('offers a retry after an error', () => {
    api.getTraining.and.returnValue(throwError(() => new Error('500')));
    const host = create(null);
    expect(host.querySelector('.cite')).toBeNull();
    expect(host.textContent).toContain('Training could not load.');
    api.getTraining.and.returnValue(of(trainingFixture()));
    host.querySelector<HTMLButtonElement>('.message button')?.click();
    fixture.detectChanges();
    expect(host.querySelector('.lift')).not.toBeNull();
  });

  it('counts sessions on the radar once the backend sends them', () => {
    const muscles = trainingFixture().muscles;
    muscles.groups[0].sessions = 5;
    const figures = radarFigures(muscles);
    expect(figures.caption).toBe('Sessions touching each area');
    expect(figures.muscles.find((entry) => entry.group === 'LEGS')?.sessions).toBe(5);
    expect(recordsLine([], 'these 4 weeks')).toBe('');
  });
});
