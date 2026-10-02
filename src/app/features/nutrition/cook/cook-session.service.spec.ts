import { TestBed } from '@angular/core/testing';

import { CookTimerDef } from './cook.models';
import { COOK_SESSION_KEY, CookSessionService } from './cook-session.service';
import { adjustStage, startStage } from './cook-timer';

const sides: CookTimerDef = { seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' };
const single: CookTimerDef = { seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' };
const meta = { recipeId: 'r1', name: 'Salmon salad', servings: 2 };

function create(): CookSessionService {
  TestBed.resetTestingModule();
  return TestBed.inject(CookSessionService);
}

describe('CookSessionService', () => {
  let service: CookSessionService;

  beforeEach(() => {
    sessionStorage.removeItem(COOK_SESSION_KEY);
    service = create();
  });

  afterEach(() => {
    service.clear();
    sessionStorage.removeItem(COOK_SESSION_KEY);
  });

  it('opens with a timer for each step that has one, at the first step', () => {
    service.open(meta, [null, sides, single]);
    expect(service.step()).toBe(0);
    expect(Object.keys(service.data()!.timers)).toEqual(['1', '2']);
    expect(service.viewing()).toBeTrue();
    expect(service.hasLive()).toBeFalse();
  });

  it('goes to a step', () => {
    service.open(meta, [null, sides]);
    service.goTo(1);
    expect(service.step()).toBe(1);
  });

  it('lists live timers soonest first', () => {
    service.open(meta, [single, sides]);
    service.act(0, startStage);
    service.act(1, startStage);
    expect(service.liveTimers().map((timer) => timer.step)).toEqual([1, 0]);
  });

  it('writes to sessionStorage and a new service takes it up again', () => {
    service.open(meta, [sides]);
    service.act(0, startStage);
    const again = create();
    expect(again.data()?.recipeId).toBe('r1');
    expect(again.hasLive()).toBeTrue();
    again.clear();
  });

  it('keeps running timers of the same recipe when it is opened again, and starts fresh otherwise', () => {
    service.open(meta, [sides]);
    service.act(0, startStage);
    service.goTo(0);
    service.leave(true);
    service.open(meta, [sides]);
    expect(service.hasLive()).toBeTrue();
    service.open({ ...meta, recipeId: 'other' }, [sides]);
    expect(service.hasLive()).toBeFalse();
  });

  it('turns a finished first side into an alert when another step is on screen', () => {
    service.open(meta, [sides, null]);
    service.act(0, startStage);
    service.goTo(1);
    service.tickNow(Date.now() + 181_000);
    expect(service.data()!.timers[0].phase).toBe('turn');
    expect(service.alerts()).toEqual([{ step: 0, kind: 'turn', eachSide: true }]);
    expect(service.ended()?.kind).toBe('turn');
  });

  it('raises no alert for the step that is on screen', () => {
    service.open(meta, [sides]);
    service.act(0, startStage);
    service.tickNow(Date.now() + 181_000);
    expect(service.alerts()).toEqual([]);
    expect(service.ended()?.step).toBe(0);
  });

  it('raises an alert when the page is closed', () => {
    service.open(meta, [sides, null]);
    service.act(0, startStage);
    service.goTo(1);
    service.leave(true);
    service.tickNow(Date.now() + 181_000);
    expect(service.alerts().length).toBe(1);
  });

  it('clears the alert when the step is opened or its next action is taken', () => {
    service.open(meta, [sides, null]);
    service.act(0, startStage);
    service.goTo(1);
    service.tickNow(Date.now() + 181_000);
    service.act(0, startStage);
    expect(service.alerts()).toEqual([]);
    expect(service.data()!.timers[0].stage).toBe(1);
    service.tickNow(Date.now() + 400_000);
    expect(service.alerts().length).toBe(1);
    service.goTo(0);
    expect(service.alerts()).toEqual([]);
  });

  it('dismisses an alert with Later', () => {
    service.open(meta, [single, null]);
    service.act(0, startStage);
    service.goTo(1);
    service.tickNow(Date.now() + 601_000);
    service.dismissAlert(0);
    expect(service.alerts()).toEqual([]);
  });

  it('changes the stage length only through the timer functions', () => {
    service.open(meta, [sides]);
    service.act(0, (state) => adjustStage(state, 1));
    expect(service.data()!.timers[0].stageSeconds).toBe(240);
  });

  it('stops everything when the cook leaves without keeping timers', () => {
    service.open(meta, [sides]);
    service.act(0, startStage);
    service.leave(false);
    expect(service.data()).toBeNull();
    expect(sessionStorage.getItem(COOK_SESSION_KEY)).toBeNull();
    expect(service.viewing()).toBeFalse();
  });

  it('forgets the session when nothing is left to wait for', () => {
    service.open(meta, [sides]);
    service.leave(true);
    expect(service.data()).toBeNull();
  });

  it('ignores a broken stored record', () => {
    sessionStorage.setItem(COOK_SESSION_KEY, '{not json');
    expect(create().data()).toBeNull();
  });
});
