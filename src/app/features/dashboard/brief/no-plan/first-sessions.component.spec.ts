import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { OnboardingSeed, WorkoutPlan } from '../../../../core/fitsync.models';
import { ToastService } from '../../../../core/toast/toast.service';
import { WORKOUT_PLAN_TEMPLATES } from '../../../workout/plan-templates.component';
import { FirstSessionsComponent } from './first-sessions.component';
import { ActivatedTemplate, NoTemplateExercisesError, PlanTemplateActivationService } from './plan-template-activation.service';

const startedPlan: WorkoutPlan = {
  planId: 'plan-1',
  name: 'Upper-lower split',
  description: '',
  goalFocus: 'STRENGTH',
  workoutType: 'STRENGTH',
  difficulty: 'INTERMEDIATE',
  estimatedDurationMinutes: 50,
  status: 'ACTIVE',
  exerciseCount: 3,
  exercises: []
};

function seed(value: OnboardingSeed['value']): OnboardingSeed {
  return { value, hasExistingBodyBaseline: true, hasExistingTrainingBaseline: true, hasExistingNutritionBaseline: true };
}

describe('FirstSessionsComponent', () => {
  let fixture: ComponentFixture<FirstSessionsComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let activation: jasmine.SpyObj<PlanTemplateActivationService>;
  let toast: jasmine.SpyObj<ToastService>;
  let started: WorkoutPlan[];

  function setup(): void {
    fixture = TestBed.createComponent(FirstSessionsComponent);
    started = [];
    fixture.componentInstance.planStarted.subscribe((plan) => started.push(plan));
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const cards = () => Array.from(root().querySelectorAll('li.card'));
  const buttons = () => Array.from(root().querySelectorAll<HTMLButtonElement>('button.start'));

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getOnboardingSeed']);
    dataService.getOnboardingSeed.and.returnValue(of(seed({})));
    activation = jasmine.createSpyObj<PlanTemplateActivationService>('PlanTemplateActivationService', ['activate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [FirstSessionsComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: PlanTemplateActivationService, useValue: activation },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('draws three cards with the heading, the moves line, the level and one button each', () => {
    setup();
    expect(root().querySelector('.eyebrow')?.textContent?.trim()).toBe('Start here');
    expect(root().querySelector('h2')?.textContent?.trim()).toBe('Three ways to begin');
    expect(cards().length).toBe(3);
    expect(cards().map((card) => card.querySelector('h3')?.textContent?.trim())).toEqual(['Full-body beginner', 'Upper-lower split', 'HIIT starter']);
    expect(cards().map((card) => card.querySelector('.meta')?.textContent?.trim())).toEqual(['3 moves · 35 min', '3 moves · 50 min', '3 moves · 25 min']);
    expect(cards().map((card) => card.querySelector('.difficulty')?.textContent?.trim())).toEqual(['Beginner', 'Intermediate', 'Beginner']);
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Start with this', 'Start with this', 'Start with this']);
    expect(cards().every((card) => card.querySelector('.glyph svg') !== null)).toBeTrue();
  });

  it('gives the first card no eyebrow when there are no answers', () => {
    setup();
    expect(root().querySelector('.card-eyebrow')).toBeNull();
  });

  it('puts the closest plan first and names it when the answers decided the order', () => {
    dataService.getOnboardingSeed.and.returnValue(of(seed({ fitnessLevel: 'INTERMEDIATE', preferredDurationMinutes: 45 })));
    setup();
    expect(cards()[0].querySelector('h3')?.textContent?.trim()).toBe('Upper-lower split');
    const eyebrows = root().querySelectorAll('.card-eyebrow');
    expect(eyebrows.length).toBe(1);
    expect(eyebrows[0].textContent?.trim()).toBe('Closest to what you told us');
    expect(cards()[0].contains(eyebrows[0])).toBeTrue();
  });

  it('draws placeholders until the answers have arrived, and falls back to the listed order when they fail', () => {
    const answers = new Subject<OnboardingSeed>();
    dataService.getOnboardingSeed.and.returnValue(answers);
    setup();
    expect(root().querySelectorAll('.placeholder').length).toBe(3);
    expect(buttons().length).toBe(0);

    answers.error(new Error('offline'));
    fixture.detectChanges();
    expect(root().querySelectorAll('.placeholder').length).toBe(0);
    expect(cards()[0].querySelector('h3')?.textContent?.trim()).toBe(WORKOUT_PLAN_TEMPLATES[0].name);
  });

  it('starts the pressed plan, disables every button while it runs and marks the pressed one busy', () => {
    const run = new Subject<ActivatedTemplate>();
    activation.activate.and.returnValue(run);
    setup();

    buttons()[1].click();
    fixture.detectChanges();

    expect(activation.activate).toHaveBeenCalledOnceWith(WORKOUT_PLAN_TEMPLATES[1]);
    expect(buttons().every((button) => button.disabled)).toBeTrue();
    expect(buttons().map((button) => button.getAttribute('aria-busy'))).toEqual([null, 'true', null]);
  });

  it('emits the plan, confirms with a toast and keeps the cards disabled on success', () => {
    activation.activate.and.returnValue(of({ plan: startedPlan, skipped: 0 }));
    setup();

    buttons()[0].click();
    fixture.detectChanges();

    expect(started).toEqual([startedPlan]);
    expect(toast.success).toHaveBeenCalledOnceWith('Plan started.');
    expect(toast.info).not.toHaveBeenCalled();
    expect(buttons().every((button) => button.disabled)).toBeTrue();
    fixture.componentInstance.start(WORKOUT_PLAN_TEMPLATES[2]);
    expect(activation.activate).toHaveBeenCalledTimes(1);
  });

  it('says so when some exercises were left out', () => {
    activation.activate.and.returnValue(of({ plan: startedPlan, skipped: 1 }));
    setup();
    buttons()[0].click();
    expect(toast.info).toHaveBeenCalledOnceWith('1 template exercise unavailable and skipped.');
  });

  it('reports a failure in a toast and keeps the cards ready for another try', () => {
    activation.activate.and.returnValue(throwError(() => new Error('offline')));
    setup();

    buttons()[0].click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledOnceWith('Unable to start this plan. Please retry.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(started).toEqual([]);
    expect(cards().length).toBe(3);
    expect(buttons().every((button) => !button.disabled)).toBeTrue();
    expect(buttons()[0].getAttribute('aria-busy')).toBeNull();
  });

  it('names the missing exercises when none of them exist yet', () => {
    activation.activate.and.returnValue(throwError(() => new NoTemplateExercisesError()));
    setup();
    buttons()[0].click();
    expect(toast.error).toHaveBeenCalledOnceWith("None of this template's exercises are available yet.");
  });

  it('links to the plans tab of the Workout page', () => {
    setup();
    const link = root().querySelector<HTMLAnchorElement>('a.browse');
    expect(link?.textContent?.trim()).toBe('Browse all plans');
    expect(link?.getAttribute('href')).toBe('/workout?tab=plans');
  });
});
