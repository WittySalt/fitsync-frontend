import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PlanCoverage } from './plan-coverage';
import { DEFAULT_PROFILE, DraftMove, emptyPlan, emptyWeek, PlanProfile } from './plan-draft';
import { PlanFlowApi, PlanFlowContext } from './plan-flow.api';
import { PlanFlowStore } from './plan-flow.store';
import { proposeWeek } from './plan-week-proposal';
import { segmentTotal } from './segments/segment-math';

const move = (over: Partial<DraftMove> = {}): DraftMove => ({
  exerciseId: 'ex-1',
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
  notes: '',
  ...over
});

describe('PlanFlowStore', () => {
  let api: jasmine.SpyObj<PlanFlowApi>;
  let store: PlanFlowStore;
  const profile: PlanProfile = { ...DEFAULT_PROFILE, weeklyWorkoutDays: 4, focusAreas: ['FULL_BODY', 'CARDIO'] };
  const context = (over: Partial<PlanFlowContext> = {}): PlanFlowContext => ({
    profile,
    profileKnown: true,
    habits: [],
    sports: [],
    currentPlanName: null,
    lastCardio: null,
    preferences: null,
    ...over
  });

  function create(ctx: PlanFlowContext = context()): void {
    TestBed.resetTestingModule();
    api = jasmine.createSpyObj<PlanFlowApi>('PlanFlowApi', ['load', 'proposal', 'coverage', 'loadPlan', 'save', 'saveProfile', 'mobilityFlow', 'resolveTemplate']);
    api.load.and.returnValue(of(ctx));
    api.proposal.and.returnValue(of(null));
    api.coverage.and.returnValue(of(null));
    api.mobilityFlow.and.returnValue(of([]));
    api.saveProfile.and.returnValue(of(null));
    TestBed.configureTestingModule({ providers: [PlanFlowStore, { provide: PlanFlowApi, useValue: api }] });
    store = TestBed.inject(PlanFlowStore);
  }

  describe('opening', () => {
    it('falls back to the client-built default week when the proposal fails', () => {
      create();
      store.start(null, null);
      expect(store.status()).toBe('ready');
      expect(store.days()).toEqual(proposeWeek(profile, []));
      expect(store.selectedDay()).toBe(1);
      expect(store.dirty()).toBeFalse();
      expect(store.editing()).toBeFalse();
    });

    it('uses the server proposal when there is one', () => {
      create();
      const week = emptyWeek().map((day) => (day.dayOfWeek === 3 ? { ...day, kind: 'MOBILITY' as const, title: 'Flow', minutes: 20 } : day));
      api.proposal.and.returnValue(of(week));
      store.start(null, null);
      expect(store.days()[2].kind).toBe('MOBILITY');
      expect(store.selectedDay()).toBe(3);
    });

    it('makes the first plan current and leaves another current plan alone', () => {
      create();
      store.start(null, null);
      expect(store.makeCurrent()).toBeTrue();
      create(context({ currentPlanName: 'Recomp' }));
      store.start(null, null);
      expect(store.makeCurrent()).toBeFalse();
    });

    it('opens a starter template as the week, and the default week when the catalogue knows none of its moves', () => {
      create();
      api.resolveTemplate.and.returnValue(of({ name: 'Full-body beginner', workoutType: 'STRENGTH', estimatedDurationMinutes: 35, moves: [move()] }));
      store.start(null, 'full-body-beginner');
      expect(store.days().filter((day) => day.kind === 'STRENGTH').length).toBe(3);
      expect(store.days()[0].moves.length).toBe(1);

      create();
      api.resolveTemplate.and.returnValue(of({ name: 'x', workoutType: 'STRENGTH', estimatedDurationMinutes: 35, moves: [] }));
      store.start(null, 'full-body-beginner');
      expect(store.days()).toEqual(proposeWeek(profile, []));
    });

    it('opens a saved plan at step 1 for editing', () => {
      create();
      api.loadPlan.and.returnValue(of({ ...emptyPlan(), planId: 'p1', name: 'Mine', days: emptyWeek().map((day) => (day.dayOfWeek === 4 ? { ...day, kind: 'STRENGTH' as const, title: 'A', minutes: 40, moves: [move()] } : day)) }));
      store.start('p1', null);
      expect(store.editing()).toBeTrue();
      expect(store.step()).toBe(1);
      expect(store.selectedDay()).toBe(4);
      expect(store.makeCurrent()).toBeFalse();
    });

    it('shows an error state when the plan cannot be loaded', () => {
      create();
      api.loadPlan.and.returnValue(throwError(() => new Error('gone')));
      store.start('p1', null);
      expect(store.status()).toBe('error');
      create();
      api.loadPlan.and.returnValue(of(null));
      store.start('p2', null);
      expect(store.status()).toBe('error');
    });

    it('shows an error state when the opening reads fail', () => {
      create();
      api.load.and.returnValue(throwError(() => new Error('down')));
      store.start(null, null);
      expect(store.status()).toBe('error');
    });
  });

  describe('editing the week', () => {
    beforeEach(() => {
      create();
      store.start(null, null);
    });

    it('changes the kind and keeps a title the person typed', () => {
      store.updateDay(1, { title: 'Leg day' });
      store.setKind(1, 'CARDIO');
      expect(store.days()[0].kind).toBe('CARDIO');
      expect(store.days()[0].title).toBe('Leg day');
      expect(store.days()[0].targetKind).toBe('MINUTES');
      expect(segmentTotal(store.days()[0].segments)).toBe(store.days()[0].minutes!);
      expect(store.dirty()).toBeTrue();
    });

    it('replaces a default title with the default of the new kind', () => {
      store.setKind(1, 'CARDIO');
      expect(store.days()[0].title).toBe('Easy run');
      store.setKind(1, 'MOBILITY');
      expect(store.days()[0].title).toBe('Mobility flow');
    });

    it('clears a day made a rest day and opens the kind tiles', () => {
      store.setKind(1, 'REST');
      expect(store.days()[0].kind).toBe('REST');
      expect(store.days()[0].moves).toEqual([]);
      expect(store.kindsOpen()).toBeTrue();
    });

    it('fills an empty mobility day with the catalogue flow', () => {
      api.mobilityFlow.and.returnValue(of([move({ name: 'Cat Cow', timed: true })]));
      store.setKind(3, 'MOBILITY');
      expect(store.days()[2].moves.map((entry) => entry.name)).toEqual(['Cat Cow']);
    });

    it('starts a cardio day on the treadmill, or where the last session was done', () => {
      store.setKind(3, 'CARDIO');
      expect(store.days()[2].location).toBe('TREADMILL');
      create(context({ lastCardio: { location: 'OUTDOOR', distanceKm: 5, minutes: 30, startedAt: '2026-10-01T10:00:00Z' } }));
      store.start(null, null);
      store.setKind(3, 'CARDIO');
      expect(store.days()[2].location).toBe('OUTDOOR');
    });

    it('gives a proposed cardio day without a place the default one', () => {
      create();
      api.proposal.and.returnValue(of(emptyWeek().map((day) => (day.dayOfWeek === 2 ? { ...day, kind: 'CARDIO' as const, title: 'Run', minutes: 30 } : day))));
      store.start(null, null);
      expect(store.days()[1].location).toBe('TREADMILL');
    });

    it('keeps the segments equal to the duration, and the minutes target with it', () => {
      store.setKind(2, 'CARDIO');
      store.setMinutes(2, 50);
      const day = store.days()[1];
      expect(day.minutes).toBe(50);
      expect(day.targetValue).toBe(50);
      expect(segmentTotal(day.segments)).toBe(50);
    });

    it('leaves a distance target alone when the minutes change', () => {
      store.setKind(2, 'CARDIO');
      store.updateDay(2, { targetKind: 'DISTANCE', targetValue: 5 });
      store.setMinutes(2, 45);
      expect(store.days()[1].targetValue).toBe(5);
    });

    it('swaps two days when one is moved and follows it', () => {
      const before = store.days();
      store.moveDay(1, 3);
      expect(store.days()[2].title).toBe(before[0].title);
      expect(store.days()[2].dayOfWeek).toBe(3);
      expect(store.days()[0].dayOfWeek).toBe(1);
      expect(store.selectedDay()).toBe(3);
    });

    it('opens the kind tiles for a rest day when it is selected', () => {
      store.select(3);
      expect(store.kindsOpen()).toBeTrue();
      store.select(1);
      expect(store.kindsOpen()).toBeFalse();
    });
  });

  describe('continuing and saving', () => {
    beforeEach(() => {
      create();
      store.start(null, null);
    });

    it('stays on step 1 and opens the day with the first problem', () => {
      store.goReview();
      expect(store.step()).toBe(1);
      expect(store.problem()).toEqual({ dayOfWeek: 1, message: 'Add at least one move.' });
      expect(store.selectedDay()).toBe(1);
    });

    it('asks for a training day when the week is all rest', () => {
      store.days().forEach((day) => store.setKind(day.dayOfWeek, 'REST'));
      store.goReview();
      expect(store.problem()).toEqual({ dayOfWeek: null, message: 'Plan at least one training day.' });
    });

    function fillMoves(): void {
      store.days().filter((day) => day.kind === 'STRENGTH').forEach((day) => store.updateDay(day.dayOfWeek, { moves: [move()] }));
      store.days().filter((day) => day.kind === 'MOBILITY').forEach((day) => store.updateDay(day.dayOfWeek, { moves: [move()] }));
    }

    it('goes to step 2 with a name and a type from the week', () => {
      fillMoves();
      store.goReview();
      expect(store.step()).toBe(2);
      expect(store.plan().name).toBe('Strength and running, 4 days');
      expect(store.plan().planType).toBe('MIXED');
    });

    it('keeps a name the person typed when the week changes', () => {
      fillMoves();
      store.goReview();
      store.setName('My plan');
      store.goBuild();
      store.goReview();
      expect(store.plan().name).toBe('My plan');
      store.setPlanType('STRENGTH');
      store.goBuild();
      store.goReview();
      expect(store.plan().planType).toBe('STRENGTH');
    });

    it('does not save with a missing name, and says why', () => {
      fillMoves();
      store.goReview();
      store.setName('  ');
      store.save(() => fail('should not save'));
      expect(store.reviewMessage()).toBe('Give the plan a name.');
      expect(api.save).not.toHaveBeenCalled();
    });

    it('saves with the current-plan choice and reports the saved id', () => {
      fillMoves();
      store.goReview();
      api.save.and.returnValue(of('plan-77'));
      let saved = '';
      store.save((id) => (saved = id));
      expect(api.save).toHaveBeenCalledWith(store.plan(), store.profile(), true);
      expect(saved).toBe('plan-77');
      expect(store.dirty()).toBeFalse();
      expect(store.saving()).toBeFalse();
    });

    it('keeps the plan and shows an error when the save fails', () => {
      fillMoves();
      store.goReview();
      api.save.and.returnValue(throwError(() => new Error('500')));
      store.save(() => fail('should not report a save'));
      expect(store.saveError()).toContain('could not be saved');
      expect(store.saving()).toBeFalse();
      expect(store.step()).toBe(2);
    });
  });

  describe('the profile', () => {
    it('writes the profile back and proposes the week again while it is untouched', () => {
      create();
      store.start(null, null);
      const next = { ...profile, weeklyWorkoutDays: 2 };
      store.saveProfile(next);
      expect(api.saveProfile).toHaveBeenCalled();
      expect(store.profile().weeklyWorkoutDays).toBe(2);
      expect(store.days().filter((day) => day.kind !== 'REST').length).toBe(2);
    });

    it('leaves a week the person has changed alone', () => {
      create();
      store.start(null, null);
      store.updateDay(1, { title: 'Mine' });
      store.saveProfile({ ...profile, weeklyWorkoutDays: 2 });
      expect(store.days()[0].title).toBe('Mine');
      expect(store.days().filter((day) => day.kind !== 'REST').length).toBe(4);
    });

    it('keeps the old profile and says so when the save fails', () => {
      create();
      store.start(null, null);
      api.saveProfile.and.returnValue(throwError(() => new Error('500')));
      store.saveProfile({ ...profile, weeklyWorkoutDays: 2 });
      expect(store.profile().weeklyWorkoutDays).toBe(4);
      expect(store.profileError()).toContain('could not be saved');
      expect(store.profileSaving()).toBeFalse();
    });
  });

  describe('coverage', () => {
    const coverage: PlanCoverage = { groups: [{ group: 'CHEST', setsPerWeek: 8 }], notes: [{ code: 'CALVES_NOT_TRAINED', text: '' }] };

    it('asks the server after the week settles and shows what it says', fakeAsync(() => {
      create();
      api.coverage.and.returnValue(of(coverage));
      store.start(null, null);
      TestBed.tick();
      tick(500);
      expect(api.coverage).toHaveBeenCalledTimes(1);
      expect(store.coverage()).toEqual(coverage);
      expect(store.lines()).toContain('Calves are not trained yet.');
      expect(store.coverageFailed()).toBeFalse();
    }));

    it('hides the figure when coverage fails, and stops asking', fakeAsync(() => {
      create();
      store.start(null, null);
      TestBed.tick();
      tick(500);
      expect(store.coverage()).toBeNull();
      expect(store.coverageFailed()).toBeTrue();
      store.updateDay(1, { title: 'Changed' });
      TestBed.tick();
      tick(500);
      expect(api.coverage).toHaveBeenCalledTimes(1);
      expect(store.figures().trainingDays).toBe(4);
    }));
  });
});
