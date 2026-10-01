import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY, of, throwError } from 'rxjs';

import { CoachStore } from '../../core/coach/coach.store';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { TodayInsight, WorkoutPlan, WorkoutPlanDay, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { HabitDayStartComponent } from './habit-day-start.component';
import { WorkoutLiveService } from './workout-live.service';

function insight(overrides: Partial<TodayInsight> = {}): TodayInsight {
  return {
    date: '2026-10-01',
    kind: 'CARDIO',
    label: 'Cardio',
    source: 'HABIT',
    planDayId: null,
    title: null,
    estimatedMinutes: null,
    moves: null,
    lastOfKind: {
      date: '2026-09-24',
      minutes: 35,
      distanceKm: 5.75,
      paceSecondsPerKm: 365,
      sessionId: 'session-last',
      exerciseNames: ['Treadmill run', 'Cool down walk']
    },
    carriedOver: [],
    ...overrides
  };
}

function day(planDayId: string, dayOfWeek: number, title: string, minutes: number | null): WorkoutPlanDay {
  return {
    planDayId,
    dayOfWeek,
    kind: 'STRENGTH',
    title,
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: minutes,
    exercises: []
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Base plan',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 45,
    status: 'ACTIVE',
    exerciseCount: 0,
    exercises: [],
    days: [day('d-wed', 3, 'Legs', 50), day('d-mon', 1, 'Push', 40)],
    ...overrides
  };
}

const started = { sessionId: 'session-new', name: 'Started', exercises: [] } as unknown as WorkoutSessionDetail;

describe('HabitDayStartComponent', () => {
  let fixture: ComponentFixture<HabitDayStartComponent>;
  let component: HabitDayStartComponent;
  let live: jasmine.SpyObj<WorkoutLiveService>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let coach: jasmine.SpyObj<CoachStore>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    const defaults: Record<string, unknown> = { today: insight(), activePlan: plan() };
    for (const [name, value] of Object.entries({ ...defaults, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (root: HTMLElement, selector: string) => root.querySelector<HTMLElement>(selector);
  const texts = (root: HTMLElement, selector: string) => [...root.querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? '');
  function expand(root: HTMLElement): void {
    q(root, '.more')?.click();
    fixture.detectChanges();
  }
  function button(root: HTMLElement, label: string): HTMLButtonElement {
    const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent?.trim() === label);
    if (!found) {
      throw new Error(`No button ${label}`);
    }
    return found;
  }

  beforeEach(async () => {
    live = jasmine.createSpyObj<WorkoutLiveService>('WorkoutLiveService', ['repeatSession', 'startAdHoc']);
    live.repeatSession.and.returnValue(of(started));
    live.startAdHoc.and.returnValue(of(started));
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getExerciseMetadata']);
    dataService.getExerciseMetadata.and.returnValue(
      of({
        exerciseTypes: [],
        muscleGroups: [],
        equipment: [],
        difficulties: [],
        workoutTypes: [],
        goalFocuses: [],
        sportActivities: [
          { code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' },
          { code: 'TENNIS', label: 'Tennis', effort: 'MODERATE', measure: 'TIME' }
        ]
      })
    );
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['open', 'ask']);

    await TestBed.configureTestingModule({
      imports: [HabitDayStartComponent],
      providers: [
        { provide: WorkoutLiveService, useValue: live },
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast },
        { provide: CoachStore, useValue: coach }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HabitDayStartComponent);
    component = fixture.componentInstance;
  });

  describe('the recommendation', () => {
    it('says where it comes from, with the facts and the exercises of the last session', () => {
      const root = render();

      expect(q(root, '.source')?.textContent?.trim()).toBe('Same as last Thursday, 24 Sept');
      expect(texts(root, '.facts li')).toEqual(['35 min', '5.75 km']);
      expect(texts(root, '.names li')).toEqual(['Treadmill run', 'Cool down walk']);
      expect(q(root, '.start')?.textContent).toContain('Start this');
    });

    it('leaves the source line out without an earlier session and keeps the facts as last time', () => {
      const root = render({
        today: insight({ lastOfKind: { date: '2026-09-24', minutes: 35, distanceKm: null, paceSecondsPerKm: null } })
      });

      expect(q(root, '.source')).toBeNull();
      expect(texts(root, '.facts li')).toEqual(['35 min last time']);
      expect(q(root, '.names')).toBeNull();
    });

    it('shows only the button when there is nothing earlier at all', () => {
      const root = render({ today: insight({ lastOfKind: null }) });

      expect(q(root, '.source')).toBeNull();
      expect(q(root, '.facts')).toBeNull();
      expect(q(root, '.start')).not.toBeNull();
    });

    it('repeats the last session through the live service and reports the new one', () => {
      const emit = spyOn(component.started, 'emit');
      const root = render();

      q(root, '.start')?.click();

      expect(live.repeatSession).toHaveBeenCalledOnceWith('session-last');
      expect(live.startAdHoc).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Workout started.');
      expect(emit).toHaveBeenCalledOnceWith(started);
    });

    it('starts a plain timed workout named after the kind when there is no session to repeat', () => {
      const root = render({ today: insight({ kind: 'MOBILITY', label: 'Mobility', lastOfKind: null }) });

      q(root, '.start')?.click();

      expect(live.repeatSession).not.toHaveBeenCalled();
      expect(live.startAdHoc).toHaveBeenCalledOnceWith({ name: 'Mobility', workoutType: 'MOBILITY' });
    });

    it('does the same on an older backend that sends no session id', () => {
      const root = render({
        today: insight({ kind: 'STRENGTH', label: 'Strength', lastOfKind: { date: '2026-09-24', minutes: 50, distanceKm: null, paceSecondsPerKm: null } })
      });

      q(root, '.start')?.click();

      expect(live.startAdHoc).toHaveBeenCalledOnceWith({ name: 'Strength', workoutType: 'STRENGTH' });
    });

    it('asks for the sport on a sport habit without a session, and preselects it by its label', () => {
      const root = render({ today: insight({ kind: 'SPORT', label: 'Badminton', lastOfKind: null }) });

      q(root, '.start')?.click();
      fixture.detectChanges();

      expect(live.startAdHoc).not.toHaveBeenCalled();
      expect(q(root, '.more')?.getAttribute('aria-expanded')).toBe('true');
      expect(q(root, '.sport select')).not.toBeNull();
      expect(component.sportCode()).toBe('BADMINTON');
    });

    it('stays quiet, with no error, when a workout is already running and the dialog took over', () => {
      live.repeatSession.and.returnValue(EMPTY);
      const emit = spyOn(component.started, 'emit');
      const root = render();

      q(root, '.start')?.click();
      fixture.detectChanges();

      expect(emit).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(q(root, '.start')?.hasAttribute('disabled')).toBeFalse();
    });

    it('tells the person when the start fails, and can be tried again', () => {
      live.repeatSession.and.returnValue(throwError(() => new Error('offline')));
      const root = render();

      q(root, '.start')?.click();
      fixture.detectChanges();

      expect(toast.error).toHaveBeenCalledWith('Unable to repeat that session. Please retry.');
      expect(q(root, '.start')?.hasAttribute('disabled')).toBeFalse();
    });
  });

  describe('choosing something else', () => {
    it('is closed at first, opens in place and closes with the same button', () => {
      const root = render();
      const toggle = q(root, '.more')!;

      expect(toggle.textContent?.trim()).toBe('Choose something else');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(q(root, '.choices')).toBeNull();

      toggle.click();
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-controls')).toBe(q(root, '.choices')?.id ?? 'missing');
      expect(texts(root, '.choices h3')).toEqual(['From my plan', 'Just a timer', 'Ask your coach']);

      toggle.click();
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(q(root, '.choices')).toBeNull();
    });

    it('lists the plan days by weekday with their minutes, and starts the one chosen', () => {
      const chosen = spyOn(component.startPlanDay, 'emit');
      const root = render();
      expand(root);

      expect(texts(root, '.plan-copy strong')).toEqual(['Push', 'Legs']);
      expect(texts(root, '.plan-copy small')).toEqual(['Monday · 40 min', 'Wednesday · 50 min']);

      root.querySelectorAll<HTMLButtonElement>('.plan-row button')[1].click();
      expect(chosen).toHaveBeenCalledOnceWith('d-wed');
    });

    it('offers a plan without days as one row that starts the plan as it is', () => {
      const chosen = spyOn(component.startPlanDay, 'emit');
      const root = render({ activePlan: plan({ days: [], name: 'Flat plan', estimatedDurationMinutes: 30 }) });
      expand(root);

      expect(texts(root, '.plan-row strong')).toEqual(['Flat plan']);
      root.querySelector<HTMLButtonElement>('.plan-row button')?.click();
      expect(chosen).toHaveBeenCalledOnceWith(null);
    });

    it('leaves the plan group out when there is no active plan', () => {
      const root = render({ activePlan: null });
      expand(root);

      expect(texts(root, '.choices h3')).toEqual(['Just a timer', 'Ask your coach']);
    });

    it('holds the plan starts while a plan start is under way', () => {
      const chosen = spyOn(component.startPlanDay, 'emit');
      const root = render({ planBusy: true });
      expand(root);

      const start = root.querySelector<HTMLButtonElement>('.plan-row button')!;
      expect(start.disabled).toBeTrue();
      component.startPlan({ planDayId: 'd-mon', title: 'Push', detail: '' });
      expect(chosen).not.toHaveBeenCalled();
    });

    it('starts a plain timed workout of the kind from the timer buttons', () => {
      const root = render();
      expand(root);

      expect(texts(root, '.timers button')).toEqual(['Strength', 'Cardio', 'Mobility', 'Sport']);
      button(root, 'Strength').click();
      expect(live.startAdHoc).toHaveBeenCalledWith({ name: 'Strength', workoutType: 'STRENGTH' });
      button(root, 'Cardio').click();
      expect(live.startAdHoc).toHaveBeenCalledWith({ name: 'Cardio', workoutType: 'CARDIO' });
      button(root, 'Mobility').click();
      expect(live.startAdHoc).toHaveBeenCalledWith({ name: 'Mobility', workoutType: 'MOBILITY' });
    });

    it('shows the sport select first and starts only once a sport is chosen', () => {
      const emit = spyOn(component.started, 'emit');
      const root = render();
      expand(root);
      expect(q(root, '.sport')).toBeNull();

      button(root, 'Sport').click();
      fixture.detectChanges();

      expect(dataService.getExerciseMetadata).toHaveBeenCalledTimes(1);
      const select = q(root, '.sport select') as HTMLSelectElement;
      expect([...select.options].map((option) => option.textContent?.trim())).toEqual(['Choose a sport', 'Badminton', 'Tennis']);
      const start = q(root, '.sport button') as HTMLButtonElement;
      expect(start.disabled).toBeTrue();
      expect(live.startAdHoc).not.toHaveBeenCalled();

      select.value = 'TENNIS';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      start.click();

      expect(live.startAdHoc).toHaveBeenCalledOnceWith({ name: 'Tennis', workoutType: 'SPORTS', sportActivity: 'TENNIS' });
      expect(emit).toHaveBeenCalledOnceWith(started);
    });

    it('says so when the sports cannot be loaded', () => {
      dataService.getExerciseMetadata.and.returnValue(of(null));
      const root = render();
      expand(root);

      button(root, 'Sport').click();
      fixture.detectChanges();

      expect(q(root, '.note')?.textContent).toContain('Sports could not be loaded');
    });

    it('opens the coach with the question about the kind, without waiting for the answer', () => {
      const root = render();
      expand(root);

      expect(button(root, 'Plan a cardio session for today')).toBeTruthy();
      button(root, 'Plan a cardio session for today').click();

      expect(coach.open).toHaveBeenCalledTimes(1);
      expect(coach.ask).toHaveBeenCalledOnceWith('Plan a cardio session for today');
      expect(q(root, '[aria-busy="true"]')).toBeNull();
    });

    it('asks about the sport by name on a sport day', () => {
      const root = render({ today: insight({ kind: 'SPORT', label: 'Badminton' }) });

      expect(component.question()).toBe('Plan a badminton session for today');
      expect(root).toBeTruthy();
    });
  });

  it('offers and never says should', () => {
    const root = render();
    expand(root);

    expect(root.textContent?.toLowerCase()).not.toContain('should');
  });
});
