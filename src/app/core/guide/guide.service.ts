import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of } from 'rxjs';

import { AUTH_STORAGE_KEYS } from '../auth/auth.config';
import { subjectFromAccessToken } from '../auth/jwt-role';
import { FitSyncDataService } from '../fitsync-data.service';
import { Goal } from '../fitsync.models';
import { ToastService } from '../toast/toast.service';
import { GUIDE_GATES } from './guide-gates';

/** The four steps of the Getting started card, in the order a new account takes them. */
export const GUIDE_STEP_IDS = ['targets', 'plan', 'meal', 'session'] as const;
export type GuideStepId = (typeof GUIDE_STEP_IDS)[number];

/** The four pages of the first tour, in the order it meets them. */
export const FIRST_TOUR_PAGES = ['workout', 'nutrition', 'progress', 'me'] as const;

/** The second-level surfaces that carry a path of their own (guide v3), in the order they are listed. */
export const TOUR_SURFACES = [
  'workout-plans',
  'workout-history',
  'workout-library',
  'nutrition-recipes',
  'nutrition-nutrients',
  'progress-goal',
  'progress-training',
  'progress-food',
  'coach-dock'
] as const;

/** Every surface that carries a first-visit spotlight path, in the order the tour meets them. */
export const TOUR_PAGES = [...FIRST_TOUR_PAGES, ...TOUR_SURFACES] as const;
export type TourPage = (typeof TOUR_PAGES)[number];

/** True for the surfaces added in v3, which are not held back by the age of the account. */
export function isSurface(page: TourPage): boolean {
  return (TOUR_SURFACES as readonly string[]).includes(page);
}

/** What the tour map keeps for one surface. */
export interface TourEntry {
  /** The path was run to its end, skipped or closed. */
  seen: boolean;
  /** The path was left out because the account's own data shows the surface is already in use. */
  skippedByData: boolean;
  /** When "Show me" last replayed the path (ISO time), or null. */
  replayedAt: string | null;
}

export type TourMap = Partial<Record<TourPage, TourEntry>>;

const NEW_ENTRY: TourEntry = { seen: false, skippedByData: false, replayedAt: null };

/** A spotlight is for new accounts. After this many days the account is left alone unless the person restarts the guide. */
export const TOUR_ACCOUNT_AGE_DAYS = 14;

const DAY_MS = 24 * 3600 * 1000;
const PREFIX = 'fitsync.guide';
/** A goal of one of these types counts as a target for step 1. */
const TARGET_GOAL_TYPES = ['WEIGHT', 'WORKOUT_FREQUENCY'];

export type GuideProgress = Record<GuideStepId, boolean>;

/** How often a followed task is looked at again while the person works on it. */
const FOLLOW_POLL_MS = 6000;
const FOLLOW_TOAST_MS = 6000;

const NONE_DONE: GuideProgress = { targets: false, plan: false, meal: false, session: false };

/**
 * State behind the Getting started card on Home and the first-visit spotlights.
 *
 * Completion is read from the account's real data, never ticked by hand. What the person chose to hide or
 * has already seen is kept in localStorage, under keys that carry the user id so two accounts that share a
 * browser do not share a guide:
 *   fitsync.guide.{userId}.card-hidden   the Getting started card was hidden
 *   fitsync.guide.{userId}.first-seen    the first time this browser saw the account (the 14-day rule counts from it)
 *   fitsync.guide.{userId}.restarted     the guide was restarted from Settings, so age no longer matters
 *   fitsync.guide.{userId}.tour-skipped  "Skip the tour" was chosen
 *   fitsync.guide.{userId}.tour-map      the tour map: per surface seen, skippedByData and replayedAt (JSON)
 *   fitsync.guide.{userId}.counters      what the person has opened so far, for the paths that skip on use (JSON)
 *   fitsync.guide.{userId}.tour.{page}   an older flag for a page whose path was run; still read, cleared on restart
 *
 * A path that was opened from a Home card step (`?guide=`) is followed: when the card's task is done the person
 * gets a toast with a way back to Home. That is held in memory only, for the visit.
 */
@Injectable({ providedIn: 'root' })
export class GuideService {
  // The data service is fetched on first use, so a page that only restarts the guide does not need it.
  private readonly injector = inject(Injector);

  private readonly userId = signal<string | null>(null);
  private readonly progress = signal<GuideProgress>(NONE_DONE);
  private readonly cardHidden = signal(false);
  private readonly eligibleForTour = signal(false);
  private readonly tourSkipped = signal(false);
  private readonly tourMap = signal<TourMap>({});
  private readonly counters = signal<Record<string, number>>({});
  private readonly used = signal<Partial<Record<TourPage, boolean>>>({});
  private readonly followed = signal<GuideStepId | null>(null);
  private followTimer: ReturnType<typeof setInterval> | null = null;
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** True once the person is known, so the stored flags have been read. */
  readonly ready = signal(false);
  /** True while a spotlight path is on screen. The "step done" toast waits until it is closed. */
  readonly pathRunning = signal(false);
  /** Fires when a page has told the guide whether its surface is in use, so a path waiting on that can start. */
  readonly usageReported = new Subject<void>();
  /** The tour map as it stands, for tests and for the restart. */
  readonly map = this.tourMap.asReadonly();
  /** The Home card step the person arrived from and is working on, or null. */
  readonly following = this.followed.asReadonly();
  /** True once the completion of the four steps has been read from the account. */
  readonly loaded = signal(false);

  readonly steps = this.progress.asReadonly();
  readonly doneCount = computed(() => GUIDE_STEP_IDS.filter((id) => this.progress()[id]).length);
  readonly allDone = computed(() => this.doneCount() === GUIDE_STEP_IDS.length);
  /** The first step that is not done, or null when all four are. */
  readonly nextStep = computed<GuideStepId | null>(() => GUIDE_STEP_IDS.find((id) => !this.progress()[id]) ?? null);
  /** The card is shown once the data is in, until the person hides it. */
  readonly cardVisible = computed(() => this.ready() && this.loaded() && !this.cardHidden());

  /** Reads the stored flags for a user the caller already knows, and stamps the day this browser first saw them. */
  adopt(userId: string | null): void {
    this.userId.set(userId);
    if (!userId) {
      return;
    }
    if (this.read('first-seen') === null) {
      this.write('first-seen', String(Date.now()));
    }
    this.cardHidden.set(this.read('card-hidden') === '1');
    this.tourSkipped.set(this.read('tour-skipped') === '1');
    this.tourMap.set(this.readMap());
    this.counters.set(this.readJson<Record<string, number>>('counters') ?? {});
    this.used.set({});
    this.eligibleForTour.set(this.read('restarted') === '1' || this.accountIsNew());
    this.ready.set(true);
  }

  /**
   * Finds the person from the stored sign-in token, which needs no request, and reads their flags. A page without
   * a signed-in person leaves the guide off.
   */
  start(): void {
    if (this.ready()) {
      return;
    }
    let token: string | null = null;
    try {
      token = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    } catch {
      token = null;
    }
    this.adopt(subjectFromAccessToken(token));
  }

  /**
   * Reads whether each step is done. The goals come from Home, which has them already, so only the plan, the
   * sessions and the meals are asked for here. A request that fails leaves its step open.
   */
  load(goals: readonly Pick<Goal, 'goalType' | 'status'>[]): void {
    this.start();
    if (!this.ready()) {
      return;
    }
    const data = this.injector.get(FitSyncDataService);
    forkJoin({
      plan: this.planDone(data),
      session: this.sessionDone(data),
      meal: this.mealDone(data)
    }).subscribe(({ plan, session, meal }) => {
      this.progress.set({
        targets: goals.some((goal) => goal.status === 'ACTIVE' && TARGET_GOAL_TYPES.includes(goal.goalType)),
        plan,
        meal,
        session
      });
      this.loaded.set(true);
    });
  }

  /** Whether one card step is done now, read from the account. A request that fails reads as not done. */
  stepDone(step: GuideStepId): Observable<boolean> {
    const data = this.injector.get(FitSyncDataService);
    switch (step) {
      case 'targets':
        return data.getGoals().pipe(
          map((goals) => goals.some((goal) => goal.status === 'ACTIVE' && TARGET_GOAL_TYPES.includes(goal.goalType))),
          catchError(() => of(false))
        );
      case 'plan':
        return this.planDone(data);
      case 'meal':
        return this.mealDone(data);
      case 'session':
        return this.sessionDone(data);
    }
  }

  /**
   * The person came from this Home card step. When its task is done, and the page's path is not on screen, a quiet
   * toast says so with a link back to Home. A task that is already done at arrival is not followed.
   */
  follow(step: GuideStepId): void {
    if (this.followed() === step || !this.ready()) {
      return;
    }
    this.stopFollowing();
    this.stepDone(step).subscribe((done) => {
      if (done || this.followed() !== null) {
        return;
      }
      this.followed.set(step);
      this.followTimer = setInterval(() => this.checkFollowed(), FOLLOW_POLL_MS);
    });
  }

  /** Looks at the followed task once; the poll and a few page events call it. */
  checkFollowed(): void {
    const step = this.followed();
    if (!step || this.pathRunning()) {
      return;
    }
    this.stepDone(step).subscribe((done) => {
      if (!done || this.followed() !== step) {
        return;
      }
      this.stopFollowing();
      const number = GUIDE_STEP_IDS.indexOf(step) + 1;
      this.toast.success(`Step ${number} done.`, FOLLOW_TOAST_MS, {
        label: 'Back to Home ›',
        run: () => void this.router.navigateByUrl('/dashboard')
      });
    });
  }

  stopFollowing(): void {
    if (this.followTimer !== null) {
      clearInterval(this.followTimer);
      this.followTimer = null;
    }
    this.followed.set(null);
  }

  private planDone(data: FitSyncDataService): Observable<boolean> {
    return data.getWorkoutPlans('ACTIVE').pipe(
      map((plans) => plans.some((plan) => plan.status === 'ACTIVE')),
      catchError(() => of(false))
    );
  }

  private sessionDone(data: FitSyncDataService): Observable<boolean> {
    return data.getWorkoutSessionPage({ size: 1, status: 'COMPLETED' }).pipe(
      map((page) => page.sessions.length > 0),
      catchError(() => of(false))
    );
  }

  private mealDone(data: FitSyncDataService): Observable<boolean> {
    return data.hasLoggedMeal().pipe(catchError(() => of(false)));
  }

  hideCard(): void {
    this.cardHidden.set(true);
    this.write('card-hidden', '1');
  }

  /**
   * Whether the path of a page is due: new account (or restarted), not seen, not skipped. A page opened from a Home
   * card (`explicit`) does not need the account to be new. The surfaces of v3 are not held back by the age of the
   * account; what keeps them away from a person who already uses them is their skip condition (see `gate`).
   */
  spotlightDue(page: TourPage, explicit = false): boolean {
    const entry = this.entry(page);
    const eligible = explicit || isSurface(page) || this.eligibleForTour();
    return this.ready() && eligible && !this.tourSkipped() && !entry.seen && !entry.skippedByData;
  }

  /** Whether the path of a page has been run, closed or skipped. */
  seen(page: TourPage): boolean {
    return this.entry(page).seen;
  }

  markSeen(page: TourPage): void {
    if (this.entry(page).seen) {
      return;
    }
    this.setEntry(page, { seen: true });
  }

  /** The path was left out because the data shows the surface is in use; it is not offered again until a restart. */
  markSkippedByData(page: TourPage): void {
    if (!this.entry(page).skippedByData) {
      this.setEntry(page, { skippedByData: true });
    }
  }

  /** "Show me" replayed the path now. */
  markReplayed(page: TourPage): void {
    this.setEntry(page, { replayedAt: new Date().toISOString() });
  }

  /** What the person has opened, counted on this browser: sessions, exercises, visits of a surface. */
  count(key: string): number {
    return this.counters()[key] ?? 0;
  }

  bump(key: string): void {
    this.start();
    if (!this.userId()) {
      return;
    }
    this.counters.update((counters) => ({ ...counters, [key]: (counters[key] ?? 0) + 1 }));
    this.writeJson('counters', this.counters());
  }

  /** A surface was opened; the skip condition of "opened twice" counts these. */
  noteVisit(page: TourPage): void {
    this.bump(`visit.${page}`);
  }

  /** A page that knows from the data it already loaded tells whether the surface is in use. */
  reportUsed(page: TourPage, used: boolean): void {
    if (this.used()[page] === used) {
      return;
    }
    this.used.update((all) => ({ ...all, [page]: used }));
    this.usageReported.next();
  }

  /**
   * Whether the path of a surface may run now: "go", "skip" when its skip condition says the person already uses
   * it, or "wait" while the data that decides is not in yet.
   */
  gate(page: TourPage): 'go' | 'skip' | 'wait' {
    const rule = GUIDE_GATES[page];
    if (!rule) {
      return 'go';
    }
    if (rule.kind === 'count') {
      return this.count(rule.key) >= rule.min ? 'skip' : 'go';
    }
    const used = this.used()[page];
    return used === undefined ? 'wait' : used ? 'skip' : 'go';
  }

  /** "Skip the tour": no page shows a spotlight again until the guide is restarted. */
  skipTour(): void {
    this.tourSkipped.set(true);
    this.write('tour-skipped', '1');
  }

  /** "Show the guide again": clears every flag, brings the card back and lets an older account see the tour. */
  restart(userId?: string | null): void {
    if (userId) {
      this.adopt(userId);
    }
    if (!this.userId()) {
      return;
    }
    for (const key of ['card-hidden', 'tour-skipped', 'counters', ...TOUR_PAGES.map((page) => `tour.${page}`)]) {
      this.remove(key);
    }
    // Every surface can be offered again; the times of earlier replays stay.
    const kept: TourMap = {};
    for (const [page, entry] of Object.entries(this.tourMap()) as [TourPage, TourEntry][]) {
      if (entry.replayedAt) {
        kept[page] = { ...NEW_ENTRY, replayedAt: entry.replayedAt };
      }
    }
    this.tourMap.set(kept);
    this.writeJson('tour-map', kept);
    this.counters.set({});
    this.used.set({});
    this.write('restarted', '1');
    this.stopFollowing();
    this.cardHidden.set(false);
    this.tourSkipped.set(false);
    this.eligibleForTour.set(true);
    this.ready.set(true);
  }

  private entry(page: TourPage): TourEntry {
    return this.tourMap()[page] ?? NEW_ENTRY;
  }

  private setEntry(page: TourPage, change: Partial<TourEntry>): void {
    this.tourMap.update((map) => ({ ...map, [page]: { ...(map[page] ?? NEW_ENTRY), ...change } }));
    this.writeJson('tour-map', this.tourMap());
  }

  /** The stored tour map, with the older per-page flags folded in. */
  private readMap(): TourMap {
    const stored = this.readJson<TourMap>('tour-map') ?? {};
    const map: TourMap = {};
    for (const page of TOUR_PAGES) {
      const entry = stored[page];
      const legacy = this.read(`tour.${page}`) === '1';
      if (entry || legacy) {
        map[page] = { ...NEW_ENTRY, ...entry, seen: !!entry?.seen || legacy };
      }
    }
    return map;
  }

  private readJson<T>(name: string): T | null {
    const raw = this.read(name);
    if (!raw) {
      return null;
    }
    try {
      const value: unknown = JSON.parse(raw);
      return value && typeof value === 'object' ? (value as T) : null;
    } catch {
      return null;
    }
  }

  private writeJson(name: string, value: unknown): void {
    this.write(name, JSON.stringify(value));
  }

  private accountIsNew(): boolean {
    const firstSeen = Number(this.read('first-seen'));
    return Number.isFinite(firstSeen) && Date.now() - firstSeen <= TOUR_ACCOUNT_AGE_DAYS * DAY_MS;
  }

  private key(name: string): string {
    return `${PREFIX}.${this.userId()}.${name}`;
  }

  private read(name: string): string | null {
    try {
      return localStorage.getItem(this.key(name));
    } catch {
      return null;
    }
  }

  private write(name: string, value: string): void {
    if (!this.userId()) {
      return;
    }
    try {
      localStorage.setItem(this.key(name), value);
    } catch {
      // Storage can be blocked; the flag then holds for this visit only.
    }
  }

  private remove(name: string): void {
    if (!this.userId()) {
      return;
    }
    try {
      localStorage.removeItem(this.key(name));
    } catch {
      // Nothing stored, nothing to clear.
    }
  }
}

/** Counts one visit of a surface for the skip condition "opened twice"; call it where the page is created. */
export function markVisit(page: TourPage): void {
  inject(GuideService).noteVisit(page);
}
