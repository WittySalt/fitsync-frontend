import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { DEFAULT_PROFILE, DraftMove, emptyPlan, emptyWeek } from './plan-draft';
import { PlanFlowApi, PlanFlowContext } from './plan-flow.api';
import { PlanFlowPage } from './plan-flow.page';
import { defaultSegments } from './segments/segment-math';

const move: DraftMove = {
  exerciseId: 'e1',
  name: 'Goblet Squat',
  meta: '',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: null,
  restSeconds: 75,
  tempoSeconds: null,
  notes: ''
};

describe('PlanFlowPage', () => {
  let api: jasmine.SpyObj<PlanFlowApi>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;
  let fixture: ComponentFixture<PlanFlowPage>;
  const root = () => fixture.nativeElement as HTMLElement;
  const routeStub = { snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } };
  const context: PlanFlowContext = {
    profile: { ...DEFAULT_PROFILE, weeklyWorkoutDays: 3, focusAreas: ['FULL_BODY'] },
    profileKnown: true,
    habits: [],
    sports: [],
    currentPlanName: null,
    lastCardio: null,
    preferences: null
  };

  function open(params: Record<string, string> = {}, query: Record<string, string> = {}, width = 1000): void {
    routeStub.snapshot = { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) };
    fixture = TestBed.createComponent(PlanFlowPage);
    root().style.display = 'block';
    root().style.width = `${width}px`;
    fixture.detectChanges();
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<PlanFlowApi>('PlanFlowApi', ['load', 'proposal', 'coverage', 'loadPlan', 'save', 'saveProfile', 'mobilityFlow', 'resolveTemplate']);
    api.load.and.returnValue(of(context));
    api.proposal.and.returnValue(of(null));
    api.coverage.and.returnValue(of(null));
    api.mobilityFlow.and.returnValue(of([]));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      imports: [PlanFlowPage],
      providers: [
        { provide: PlanFlowApi, useValue: api },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: ToastService, useValue: toast }
      ]
    });
  });

  it('opens a new plan at step 1 with the profile card, the week, the day editor and the panel', () => {
    open();
    expect(root().querySelector('.eyebrow')?.textContent).toBe('New plan');
    expect(root().querySelector('h1')?.textContent).toBe('Build the week');
    expect(root().querySelector('app-plan-profile-card .line')?.textContent).toContain('Beginner · 3 days a week · 45 min');
    expect(root().querySelectorAll('app-plan-week-strip .tile').length).toBe(7);
    expect(root().querySelector('app-plan-day-editor')).not.toBeNull();
    expect(root().querySelector('app-plan-week-panel')).not.toBeNull();
    expect(root().querySelector('.steps .current')?.textContent?.trim()).toBe('1 Build');
    expect(root().querySelector('.summary')?.textContent).toContain('Your profile says 3 days and 45 min.');
  });

  it('arranges the editor and the panel by the page width, wide in two columns and folded under 900', () => {
    open({}, {}, 1000);
    expect(root().querySelector('.flow')!.getAttribute('data-band')).toBe('wide');
    expect(root().querySelector('app-plan-week-panel .panel')!.classList).not.toContain('folded');
    open({}, {}, 700);
    expect(root().querySelector('.flow')!.getAttribute('data-band')).toBe('medium');
    expect(root().querySelector('app-plan-week-panel .panel')!.classList).toContain('folded');
    open({}, {}, 360);
    expect(root().querySelector('.flow')!.getAttribute('data-band')).toBe('narrow');
  });

  it('opens a saved plan as Edit plan', () => {
    api.loadPlan.and.returnValue(of({ ...emptyPlan(), planId: 'p9', name: 'Mine', days: emptyWeek().map((day) => (day.dayOfWeek === 2 ? { ...day, kind: 'STRENGTH' as const, title: 'A', minutes: 40, moves: [move] } : day)) }));
    open({ id: 'p9' });
    expect(api.loadPlan).toHaveBeenCalledWith('p9');
    expect(root().querySelector('.eyebrow')?.textContent).toBe('Edit plan');
  });

  it('shows the loading state first, then an error with Retry when the opening fails', () => {
    const load = new Subject<PlanFlowContext>();
    api.load.and.returnValue(load);
    open();
    expect(root().querySelector('.skeleton')).not.toBeNull();
    load.error(new Error('down'));
    fixture.detectChanges();
    expect(root().querySelector('.skeleton')).toBeNull();
    expect(root().querySelector('app-state-panel')).not.toBeNull();
    api.load.and.returnValue(of(context));
    root().querySelector<HTMLButtonElement>('app-state-panel button')!.click();
    fixture.detectChanges();
    expect(root().querySelector('app-plan-week-strip')).not.toBeNull();
  });

  it('keeps Continue on step 1 and names the problem when a day is not ready', () => {
    open();
    root().querySelector<HTMLButtonElement>('.foot .button.primary')!.click();
    fixture.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Build the week');
    expect(root().querySelector('app-plan-day-editor .problem')?.textContent).toBe('Add at least one move.');
  });

  it('goes to step 2 when the week is ready, and Back returns with the week kept', () => {
    open();
    const store = (fixture.componentInstance as unknown as { store: { days: () => Array<{ dayOfWeek: number; kind: string }>; updateDay: (day: number, patch: object) => void } }).store;
    store.days().filter((day) => day.kind === 'STRENGTH').forEach((day) => store.updateDay(day.dayOfWeek, { moves: [move] }));
    root().querySelector<HTMLButtonElement>('.foot .button.primary')!.click();
    fixture.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Review and save');
    expect(root().querySelector('.steps .done')?.textContent).toContain('1 Build');
    expect(root().querySelector('app-plan-review-step')).not.toBeNull();
    root().querySelectorAll<HTMLButtonElement>('app-plan-review-step .actions button')[0].click();
    fixture.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Build the week');
    expect(root().querySelectorAll('app-plan-week-strip .tile').length).toBe(7);
  });

  it('saves from step 2, tells the person and goes back to the plans', () => {
    api.save.and.returnValue(of('plan-1'));
    open();
    const store = (fixture.componentInstance as unknown as { store: { days: () => Array<{ dayOfWeek: number; kind: string }>; updateDay: (day: number, patch: object) => void } }).store;
    store.days().filter((day) => day.kind === 'STRENGTH').forEach((day) => store.updateDay(day.dayOfWeek, { moves: [move] }));
    root().querySelector<HTMLButtonElement>('.foot .button.primary')!.click();
    fixture.detectChanges();
    root().querySelectorAll<HTMLButtonElement>('app-plan-review-step .actions button')[1].click();
    expect(api.save).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Plan saved.');
    expect(router.navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'plans' } });
  });

  it('leaves at once on Cancel when nothing changed', () => {
    open();
    root().querySelector<HTMLButtonElement>('.cancel')!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'plans' } });
    expect(root().querySelector('.notice')).toBeNull();
  });

  it('asks before discarding changes, with Keep editing and a red Discard, and no native confirm', () => {
    const confirm = spyOn(window, 'confirm');
    open();
    const store = (fixture.componentInstance as unknown as { store: { updateDay: (day: number, patch: object) => void } }).store;
    store.updateDay(1, { title: 'Changed' });
    root().querySelector<HTMLButtonElement>('.cancel')!.click();
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(root().querySelector('.notice')?.textContent).toContain('Discard this plan?');
    const buttons = Array.from(root().querySelectorAll<HTMLButtonElement>('.notice button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Keep editing', 'Discard']);
    expect(buttons[1].classList).toContain('discard');

    buttons[0].click();
    fixture.detectChanges();
    expect(root().querySelector('.notice')).toBeNull();

    root().querySelector<HTMLButtonElement>('.cancel')!.click();
    fixture.detectChanges();
    root().querySelectorAll<HTMLButtonElement>('.notice button')[1].click();
    expect(router.navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'plans' } });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('opens a starter template when the address names one', () => {
    api.resolveTemplate.and.returnValue(of({ name: 'Full-body beginner', workoutType: 'STRENGTH', estimatedDurationMinutes: 35, moves: [move] }));
    open({}, { template: 'full-body-beginner' });
    expect(api.resolveTemplate).toHaveBeenCalled();
    expect(root().querySelector('app-plan-week-strip .tile .title')?.textContent).toBe('Full-body beginner');
  });

  for (const width of [343, 540, 568, 600, 880, 1000]) {
    it('keeps the whole page inside a ' + width + ' px column with a cardio day open', () => {
      const week = emptyWeek().map((day) =>
        day.dayOfWeek === 2
          ? { ...day, kind: 'CARDIO' as const, title: 'Easy run', minutes: 45, targetKind: 'MINUTES' as const, targetValue: 45, location: 'TREADMILL' as const, effort: 'EASY' as const, segments: defaultSegments(45) }
          : day
      );
      api.proposal.and.returnValue(of(week));
      open({}, {}, width);
      const host = root();
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
      const limit = host.getBoundingClientRect().right + 0.5;
      const past = Array.from(host.querySelectorAll<HTMLElement>('*'))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.right > limit && getComputedStyle(element).position !== 'absolute' && !element.closest('app-plan-week-strip .strip');
        })
        .map((element) => element.tagName.toLowerCase() + '.' + element.className);
      expect(past).toEqual([]);
    });
  }
});
