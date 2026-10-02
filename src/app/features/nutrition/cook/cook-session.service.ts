import { Injectable, computed, signal } from '@angular/core';

import { playTimerBeep, vibrateTimer } from './cook-alert-sound';
import { CookTimerDef } from './cook.models';
import { TimerEnd, TimerState, createTimer, isLive, remainingSeconds, startStage, tickTimer } from './cook-timer';

/** A timer the cook added to a step, such as an oven to preheat. */
export interface CustomTimer {
  id: number;
  /** The 0-based step it was added on. */
  step: number;
  /** What the cook called it, or an empty string. */
  name: string;
  state: TimerState;
}

export interface CookSessionData {
  recipeId: string;
  name: string;
  servings: number;
  /** The step on screen, 0-based. */
  step: number;
  /** The timer of each step that has one, by 0-based step index. */
  timers: Record<number, TimerState>;
  /** The timers the cook added, any number on any step. */
  customs: CustomTimer[];
  /** The ingredients the cook has ticked as added, by ingredient id. */
  added: string[];
  /** For the Continue cooking banner on the Recipes tab. */
  imageUrl: string | null;
  stepCount: number;
  /** When cooking began, in epoch milliseconds, for the minutes on the finish card. */
  startedAt: number;
  /** Made when the cook starts; sent with the cook record so a retry or a reload counts it once. */
  cookId: string;
}

/** A timer that ended while its step was not on screen, shown until it is answered. */
export interface CookAlert {
  /** `s<step>` for the timer found in a step, `c<id>` for one the cook added. */
  key: string;
  step: number;
  kind: TimerEnd;
  eachSide: boolean;
  /** The cook's name for a timer they added, else null. */
  name: string | null;
  /** The name of the timer found in a step, such as "Brown patties"; empty or missing for none. */
  label?: string;
}

export interface CookEnded {
  id: number;
  step: number;
  kind: TimerEnd;
}

export interface LiveTimer {
  key: string;
  step: number;
  /** Set for a timer the cook added (it may be empty); null for the timer found in a step. */
  name: string | null;
  state: TimerState;
}

export const COOK_SESSION_KEY = 'fitsync.cook.session';
export const CUSTOM_MAX_MINUTES = 12 * 60;
export const CUSTOM_NAME_MAX = 40;
const TICK_MS = 250;

/** A fresh id for one cook; the browser's UUID when it has one. */
export function newCookId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function foundKey(step: number): string {
  return `s${step}`;
}

export function customKey(id: number): string {
  return `c${id}`;
}

/**
 * The cook session of the signed-in tab: the step on screen, the timers (the ones found in the
 * steps and the ones the cook added) and the ingredients ticked as added. It lives in the root so
 * timers keep counting when the cook page is closed, and it is written to sessionStorage
 * (wall-clock moments) so a reload keeps all of it.
 */
@Injectable({ providedIn: 'root' })
export class CookSessionService {
  readonly data = signal<CookSessionData | null>(CookSessionService.restore());
  readonly now = signal(Date.now());
  /** True while the cook page is on screen. */
  readonly viewing = signal(false);
  readonly alerts = signal<CookAlert[]>([]);
  /** The latest timer that ended, for sound-free reactions such as the tick animation. */
  readonly ended = signal<CookEnded | null>(null);

  readonly step = computed(() => this.data()?.step ?? 0);
  /** Timers that count or wait for the cook, soonest first (a timer at the turn comes first). */
  readonly liveTimers = computed<LiveTimer[]>(() => {
    const data = this.data();
    const now = this.now();
    if (!data) {
      return [];
    }
    const found = Object.entries(data.timers).map(
      ([step, state]): LiveTimer => ({ key: foundKey(Number(step)), step: Number(step), name: null, state })
    );
    const added = data.customs.map((custom): LiveTimer => ({ key: customKey(custom.id), step: custom.step, name: custom.name, state: custom.state }));
    return [...found, ...added]
      .filter((timer) => isLive(timer.state))
      .sort((a, b) => remainingSeconds(a.state, now) - remainingSeconds(b.state, now) || a.step - b.step);
  });
  readonly hasLive = computed(() => this.liveTimers().length > 0);
  /** True once the cook has done something worth coming back to: a later step, a tick or a running timer. */
  readonly hasProgress = computed(() => {
    const data = this.data();
    return !!data && (data.step > 0 || data.added.length > 0 || this.hasLive());
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private endedId = 0;

  constructor() {
    this.ensureTicking();
  }

  /**
   * Opens the cook page for a recipe. The session of the same recipe is taken up again (its step,
   * timers and ticks); anything else starts at the first step.
   */
  open(
    meta: { recipeId: string; name: string; servings: number; imageUrl?: string | null },
    defs: readonly (CookTimerDef | null)[]
  ): void {
    const kept = this.data();
    const resume = !!kept && kept.recipeId === meta.recipeId;
    const timers: Record<number, TimerState> = {};
    defs.forEach((def, index) => {
      if (def) {
        timers[index] = resume && kept.timers[index] ? kept.timers[index] : createTimer(def);
      }
    });
    const step = resume ? Math.min(kept.step, Math.max(0, defs.length - 1)) : 0;
    this.alerts.set([]);
    this.write({
      recipeId: meta.recipeId,
      name: meta.name,
      servings: meta.servings,
      step,
      timers,
      customs: resume ? kept.customs.filter((custom) => custom.step < defs.length) : [],
      added: resume ? kept.added : [],
      imageUrl: meta.imageUrl ?? null,
      stepCount: defs.length,
      startedAt: resume ? kept.startedAt : Date.now(),
      cookId: resume ? kept.cookId : newCookId()
    });
    this.viewing.set(true);
    this.tickNow();
  }

  goTo(step: number): void {
    const data = this.data();
    if (!data) {
      return;
    }
    this.alerts.update((alerts) => alerts.filter((alert) => alert.step !== step));
    this.write({ ...data, step });
  }

  /** Changes the timer found in a step with one of the pure functions in cook-timer.ts. */
  act(step: number, change: (state: TimerState, now: number) => TimerState): void {
    const data = this.data();
    const state = data?.timers[step];
    if (!data || !state) {
      return;
    }
    const next = change(state, Date.now());
    this.dismissAlert(foundKey(step));
    this.write({ ...data, timers: { ...data.timers, [step]: next } });
    this.tickNow();
  }

  /** Adds a timer to a step and starts it. False when the step or the minutes make no sense. */
  addCustom(step: number, name: string, minutes: number): boolean {
    const data = this.data();
    const whole = Math.round(minutes);
    if (!data || step < 0 || step >= data.stepCount || !(whole >= 1) || whole > CUSTOM_MAX_MINUTES) {
      return false;
    }
    const id = data.customs.reduce((max, custom) => Math.max(max, custom.id), 0) + 1;
    const state = startStage(createTimer({ seconds: whole * 60, maxSeconds: null, eachSide: false, phrase: '' }), Date.now());
    this.write({ ...data, customs: [...data.customs, { id, step, name: name.trim().slice(0, CUSTOM_NAME_MAX), state }] });
    this.tickNow();
    return true;
  }

  /** Changes a timer the cook added with one of the pure functions in cook-timer.ts. */
  actCustom(id: number, change: (state: TimerState, now: number) => TimerState): void {
    const data = this.data();
    if (!data || !data.customs.some((custom) => custom.id === id)) {
      return;
    }
    const now = Date.now();
    this.dismissAlert(customKey(id));
    this.write({ ...data, customs: data.customs.map((custom) => (custom.id === id ? { ...custom, state: change(custom.state, now) } : custom)) });
    this.tickNow();
  }

  removeCustom(id: number): void {
    const data = this.data();
    if (!data) {
      return;
    }
    this.dismissAlert(customKey(id));
    this.write({ ...data, customs: data.customs.filter((custom) => custom.id !== id) });
    this.tickNow();
  }

  /** Ticks an ingredient as added, or takes the tick off again. */
  toggleAdded(ingredientId: string): void {
    const data = this.data();
    if (!data) {
      return;
    }
    const has = data.added.includes(ingredientId);
    this.write({ ...data, added: has ? data.added.filter((id) => id !== ingredientId) : [...data.added, ingredientId] });
  }

  /** Ticks all of these ingredients as added, or takes the ticks off all of them. */
  setAdded(ingredientIds: readonly string[], on: boolean): void {
    const data = this.data();
    if (!data) {
      return;
    }
    const rest = data.added.filter((id) => !ingredientIds.includes(id));
    this.write({ ...data, added: on ? [...rest, ...ingredientIds] : rest });
  }

  dismissAlert(key: string): void {
    this.alerts.update((alerts) => alerts.filter((alert) => alert.key !== key));
  }

  /**
   * The cook page is leaving: stop everything, or keep the session for the bar and the Continue
   * cooking banner. A session with no timers and no progress has nothing to come back to.
   */
  leave(keepTimers: boolean): void {
    this.viewing.set(false);
    if (!keepTimers || !this.hasProgress()) {
      this.clear();
    }
  }

  clear(): void {
    this.alerts.set([]);
    this.write(null);
    this.stopTicking();
  }

  /** One beat of the clock: moves the timers that ran out and raises their alerts. */
  tickNow(now = Date.now()): void {
    this.now.set(now);
    const data = this.data();
    if (!data) {
      this.stopTicking();
      return;
    }
    let timers = data.timers;
    let customs = data.customs;
    const finished: CookAlert[] = [];
    for (const [key, state] of Object.entries(data.timers)) {
      const result = tickTimer(state, now);
      if (result.ended) {
        timers = { ...timers, [Number(key)]: result.state };
        finished.push({ key: foundKey(Number(key)), step: Number(key), kind: result.ended, eachSide: state.eachSide, name: null, label: state.label });
      }
    }
    for (const custom of data.customs) {
      const result = tickTimer(custom.state, now);
      if (result.ended) {
        customs = customs.map((item) => (item.id === custom.id ? { ...item, state: result.state } : item));
        finished.push({ key: customKey(custom.id), step: custom.step, kind: result.ended, eachSide: false, name: custom.name });
      }
    }
    if (finished.length > 0) {
      this.write({ ...data, timers, customs });
      this.onEnded(finished, data.step);
    }
    this.ensureTicking();
  }

  private onEnded(finished: CookAlert[], current: number): void {
    playTimerBeep();
    vibrateTimer();
    for (const item of finished) {
      this.ended.set({ id: ++this.endedId, step: item.step, kind: item.kind });
      if (!(this.viewing() && item.step === current)) {
        this.alerts.update((alerts) => [...alerts.filter((alert) => alert.key !== item.key), item]);
      }
    }
  }

  private ensureTicking(): void {
    const data = this.data();
    const states = [...Object.values(data?.timers ?? {}), ...(data?.customs ?? []).map((custom) => custom.state)];
    const running = states.some((state) => state.phase === 'running');
    if (running && this.intervalId === null) {
      this.intervalId = setInterval(() => this.tickNow(), TICK_MS);
    } else if (!running) {
      this.stopTicking();
    }
  }

  private stopTicking(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private write(data: CookSessionData | null): void {
    this.data.set(data);
    try {
      if (data) {
        sessionStorage.setItem(COOK_SESSION_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(COOK_SESSION_KEY);
      }
    } catch {
      // Without storage a reload starts the recipe again; the timers still work meanwhile.
    }
  }

  private static restore(): CookSessionData | null {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(COOK_SESSION_KEY) ?? 'null') as Partial<CookSessionData> | null;
      if (
        parsed &&
        typeof parsed.recipeId === 'string' &&
        typeof parsed.name === 'string' &&
        typeof parsed.servings === 'number' &&
        typeof parsed.step === 'number' &&
        parsed.timers &&
        typeof parsed.timers === 'object'
      ) {
        return {
          ...parsed,
          customs: Array.isArray(parsed.customs) ? parsed.customs : [],
          added: Array.isArray(parsed.added) ? parsed.added.filter((id): id is string => typeof id === 'string') : [],
          imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : null,
          stepCount: typeof parsed.stepCount === 'number' ? parsed.stepCount : 0,
          startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now(),
          cookId: typeof parsed.cookId === 'string' && parsed.cookId !== '' ? parsed.cookId : newCookId()
        } as CookSessionData;
      }
    } catch {
      // A broken record is the same as none.
    }
    return null;
  }
}
