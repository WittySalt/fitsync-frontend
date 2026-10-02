import { Injectable, computed, signal } from '@angular/core';

import { playTimerBeep, vibrateTimer } from './cook-alert-sound';
import { CookTimerDef } from './cook.models';
import { TimerEnd, TimerState, createTimer, isLive, remainingSeconds, tickTimer } from './cook-timer';

export interface CookSessionData {
  recipeId: string;
  name: string;
  servings: number;
  /** The step on screen, 0-based. */
  step: number;
  /** The timer of each step that has one, by 0-based step index. */
  timers: Record<number, TimerState>;
}

/** A timer that ended while its step was not on screen, shown until it is answered. */
export interface CookAlert {
  step: number;
  kind: TimerEnd;
  eachSide: boolean;
}

export interface CookEnded {
  id: number;
  step: number;
  kind: TimerEnd;
}

export interface LiveTimer {
  step: number;
  state: TimerState;
}

export const COOK_SESSION_KEY = 'fitsync.cook.session';
const TICK_MS = 250;

/**
 * The cook session of the signed-in tab: the step on screen and the timer of every step. It lives
 * in the root so timers keep counting when the cook page is closed, and it is written to
 * sessionStorage (wall-clock moments) so a reload keeps them.
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
    return Object.entries(data.timers)
      .map(([step, state]) => ({ step: Number(step), state }))
      .filter((timer) => isLive(timer.state))
      .sort((a, b) => remainingSeconds(a.state, now) - remainingSeconds(b.state, now) || a.step - b.step);
  });
  readonly hasLive = computed(() => this.liveTimers().length > 0);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private endedId = 0;

  constructor() {
    this.ensureTicking();
  }

  /**
   * Opens the cook page for a recipe. The session of the same recipe is taken up again when it still
   * has live timers; anything else starts at the first step.
   */
  open(meta: { recipeId: string; name: string; servings: number }, defs: readonly (CookTimerDef | null)[]): void {
    const kept = this.data();
    const resume = kept && kept.recipeId === meta.recipeId && Object.values(kept.timers).some(isLive);
    const timers: Record<number, TimerState> = {};
    defs.forEach((def, index) => {
      if (def) {
        timers[index] = resume && kept.timers[index] ? kept.timers[index] : createTimer(def);
      }
    });
    const step = resume ? Math.min(kept.step, Math.max(0, defs.length - 1)) : 0;
    this.alerts.set([]);
    this.write({ recipeId: meta.recipeId, name: meta.name, servings: meta.servings, step, timers });
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

  /** Changes the timer of a step with one of the pure functions in cook-timer.ts. */
  act(step: number, change: (state: TimerState, now: number) => TimerState): void {
    const data = this.data();
    const state = data?.timers[step];
    if (!data || !state) {
      return;
    }
    const next = change(state, Date.now());
    this.alerts.update((alerts) => alerts.filter((alert) => alert.step !== step));
    this.write({ ...data, timers: { ...data.timers, [step]: next } });
    this.tickNow();
  }

  dismissAlert(step: number): void {
    this.alerts.update((alerts) => alerts.filter((alert) => alert.step !== step));
  }

  /** The cook page is leaving: keep the timers running for the bar, or stop everything. */
  leave(keepTimers: boolean): void {
    this.viewing.set(false);
    if (!keepTimers || !this.hasLive()) {
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
    const finished: { step: number; kind: TimerEnd; eachSide: boolean }[] = [];
    for (const [key, state] of Object.entries(data.timers)) {
      const result = tickTimer(state, now);
      if (result.ended) {
        timers = { ...timers, [Number(key)]: result.state };
        finished.push({ step: Number(key), kind: result.ended, eachSide: state.eachSide });
      }
    }
    if (finished.length > 0) {
      this.write({ ...data, timers });
      this.onEnded(finished, data.step);
    }
    this.ensureTicking();
  }

  private onEnded(finished: { step: number; kind: TimerEnd; eachSide: boolean }[], current: number): void {
    playTimerBeep();
    vibrateTimer();
    for (const item of finished) {
      this.ended.set({ id: ++this.endedId, step: item.step, kind: item.kind });
      if (!(this.viewing() && item.step === current)) {
        this.alerts.update((alerts) => [...alerts.filter((alert) => alert.step !== item.step), item]);
      }
    }
  }

  private ensureTicking(): void {
    const running = Object.values(this.data()?.timers ?? {}).some((state) => state.phase === 'running');
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
        return parsed as CookSessionData;
      }
    } catch {
      // A broken record is the same as none.
    }
    return null;
  }
}
