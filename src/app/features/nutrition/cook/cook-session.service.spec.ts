import { TestBed } from '@angular/core/testing';

import { CookTimerDef } from './cook.models';
import { COOK_SESSION_KEY, CookSessionService, newCookId } from './cook-session.service';
import { pauseTimer, setRemaining, startStage } from './cook-timer';

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
    expect(service.alerts()).toEqual([{ key: 's0', step: 0, kind: 'turn', eachSide: true, name: null, label: '' }]);
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
    service.dismissAlert('s0');
    expect(service.alerts()).toEqual([]);
  });

  it('changes the stage length only through the timer functions', () => {
    service.open(meta, [sides]);
    service.act(0, (state, now) => setRemaining(state, now, 240));
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

  it('keeps a session with progress but no running timer, and takes it up again', () => {
    service.open(meta, [null, sides, null]);
    service.goTo(1);
    service.toggleAdded('i1');
    service.leave(true);
    expect(service.hasProgress()).toBeTrue();
    expect(service.data()?.step).toBe(1);
    service.open(meta, [null, sides, null]);
    expect(service.step()).toBe(1);
    expect(service.data()?.added).toEqual(['i1']);
    service.open({ ...meta, recipeId: 'other' }, [null, sides, null]);
    expect(service.step()).toBe(0);
    expect(service.data()?.added).toEqual([]);
  });

  it('remembers when cooking began and keeps it when the session is taken up again', () => {
    const before = Date.now();
    service.open(meta, [null, sides]);
    const started = service.data()!.startedAt;
    expect(started).toBeGreaterThanOrEqual(before);
    service.goTo(1);
    service.leave(true);
    service.open(meta, [null, sides]);
    expect(service.data()!.startedAt).toBe(started);
    service.open({ ...meta, recipeId: 'other' }, [null, sides]);
    expect(service.data()!.startedAt).toBeGreaterThanOrEqual(started);
  });

  it('makes a cook id when cooking starts and keeps it through leaving and a reload', () => {
    service.open(meta, [null, sides]);
    const id = service.data()!.cookId;
    expect(id.length).toBeGreaterThan(8);
    service.goTo(1);
    service.leave(true);
    service.open(meta, [null, sides]);
    expect(service.data()!.cookId).toBe(id);
    expect(create().data()!.cookId).toBe(id);
    service.open({ ...meta, recipeId: 'other' }, [null, sides]);
    expect(service.data()!.cookId).not.toBe(id);
  });

  it('ticks an ingredient and takes the tick off again, and keeps ticks through a reload', () => {
    service.open(meta, [sides]);
    service.toggleAdded('i1');
    service.toggleAdded('i2');
    service.toggleAdded('i1');
    expect(service.data()?.added).toEqual(['i2']);
    const again = create();
    expect(again.data()?.added).toEqual(['i2']);
    again.clear();
  });

  it('ticks or clears a group of ingredients at once', () => {
    service.open(meta, [sides]);
    service.toggleAdded('keep');
    service.setAdded(['a', 'b'], true);
    expect(service.data()?.added).toEqual(['keep', 'a', 'b']);
    service.setAdded(['a', 'b'], true);
    expect(service.data()?.added).toEqual(['keep', 'a', 'b']);
    service.setAdded(['a', 'b'], false);
    expect(service.data()?.added).toEqual(['keep']);
  });

  it('adds timers to a step, any number, next to the one found in the text', () => {
    service.open({ ...meta, imageUrl: 'https://img/x.jpg' }, [sides, null]);
    expect(service.data()?.stepCount).toBe(2);
    expect(service.addCustom(0, ' Oven preheating ', 10)).toBeTrue();
    expect(service.addCustom(0, '', 3)).toBeTrue();
    expect(service.addCustom(1, 'Rice', 12)).toBeTrue();
    const customs = service.data()!.customs;
    expect(customs.map((c) => [c.id, c.step, c.name, c.state.phase])).toEqual([
      [1, 0, 'Oven preheating', 'running'],
      [2, 0, '', 'running'],
      [3, 1, 'Rice', 'running']
    ]);
    expect(service.liveTimers().map((t) => t.key)).toEqual(['c2', 'c1', 'c3']);
    expect(service.liveTimers().find((t) => t.key === 'c1')?.name).toBe('Oven preheating');
    expect(service.hasLive()).toBeTrue();
  });

  it('refuses a timer with no sense in it', () => {
    service.open(meta, [sides]);
    expect(service.addCustom(0, 'x', 0)).toBeFalse();
    expect(service.addCustom(0, 'x', 721)).toBeFalse();
    expect(service.addCustom(5, 'x', 5)).toBeFalse();
    expect(service.data()!.customs).toEqual([]);
  });

  it('changes and removes a timer the cook added', () => {
    service.open(meta, [null]);
    service.addCustom(0, 'Rice', 5);
    service.actCustom(1, pauseTimer);
    expect(service.data()!.customs[0].state.phase).toBe('paused');
    service.removeCustom(1);
    expect(service.data()!.customs).toEqual([]);
  });

  it('raises an alert when a timer the cook added ends on another step, and keeps it through a reload', () => {
    service.open(meta, [null, null]);
    service.addCustom(0, 'Oven preheating', 1);
    service.goTo(1);
    const again = create();
    expect(again.data()!.customs.length).toBe(1);
    again.tickNow(Date.now() + 61_000);
    expect(again.alerts()).toEqual([{ key: 'c1', step: 0, kind: 'done', eachSide: false, name: 'Oven preheating' }]);
    again.dismissAlert('c1');
    expect(again.alerts()).toEqual([]);
    again.clear();
  });

  it('ignores a broken stored record', () => {
    sessionStorage.setItem(COOK_SESSION_KEY, '{not json');
    expect(create().data()).toBeNull();
  });
});

describe('newCookId', () => {
  it('falls back to crypto.getRandomValues when randomUUID is missing', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    const getRandomValues = spyOn(crypto, 'getRandomValues').and.callThrough();
    try {
      const first = newCookId();
      const second = newCookId();
      expect(first).toMatch(/^[0-9a-z]+-[0-9a-f]{12}$/);
      expect(second).not.toBe(first);
      expect(getRandomValues).toHaveBeenCalled();
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
