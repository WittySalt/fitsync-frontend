import { DestroyRef, Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of } from 'rxjs';

import { AccountDataService } from '../account-data.service';
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

/**
 * The surfaces below the four pages (guide v3 and v4). None of them starts on its own except the session player on the
 * very first session; the rest are reached from the "?" in the top bar.
 */
export const TOUR_SURFACES = [
  'workout-plans',
  'workout-history',
  'workout-library',
  'nutrition-recipes',
  'nutrition-nutrients',
  'progress-goal',
  'progress-training',
  'progress-food',
  'coach-dock',
  'workout-session-player',
  'workout-live',
  'workout-plan-flow',
  'coach-plan-studio',
  'workout-session-detail',
  'nutrition-recipe',
  'nutrition-cook',
  'nutrition-nutrient',
  'me-achievements',
  'settings'
] as const;

/** Every surface that carries a spotlight path, in the order the tour meets them. */
export const TOUR_PAGES = [...FIRST_TOUR_PAGES, ...TOUR_SURFACES] as const;
export type TourPage = (typeof TOUR_PAGES)[number];

/** True for the surfaces below the four first-tour pages. */
export function isSurface(page: TourPage): boolean {
  return (TOUR_SURFACES as readonly string[]).includes(page);
}

/** The session player: the one surface besides the first-tour pages whose path starts by itself. */
export const PLAYER_PAGE: TourPage = 'workout-session-player';

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

/** The whole guide state as the server keeps it (an opaque JSON object there). */
export interface GuideState {
  tourMap: TourMap;
  cardHidden: boolean;
  tourSkipped: boolean;
  /** The guide was restarted from Settings or the card, so the age of the account no longer matters. */
  restarted: boolean;
  /** What the person has opened so far, for the paths that skip on use. */
  counters: Record<string, number>;
}

/** A spotlight is for new accounts. After this many days the account is left alone unless the person restarts the guide. */
export const TOUR_ACCOUNT_AGE_DAYS = 14;

/** A change is written to the server this long after the last one. */
export const GUIDE_SAVE_DEBOUNCE_MS = 500;

const DAY_MS = 24 * 3600 * 1000;
const PREFIX = 'fitsync.guide';
/** The keys v2 and v3 kept one by one; read once when a browser has no cached state, removed on restart. */
const LEGACY_KEYS = ['card-hidden', 'first-seen', 'restarted', 'tour-skipped', 'tour-map', 'counters'];
/** A goal of one of these types counts as a target for step 1. */
const TARGET_GOAL_TYPES = ['WEIGHT', 'WORKOUT_FREQUENCY'];

export type GuideProgress = Record<GuideStepId, boolean>;

/** How often a followed task is looked at again while the person works on it. */
const FOLLOW_POLL_MS = 6000;
const FOLLOW_TOAST_MS = 6000;

const NONE_DONE: GuideProgress = { targets: false, plan: false, meal: false, session: false };

function emptyState(): GuideState {
  return { tourMap: {}, cardHidden: false, tourSkipped: false, restarted: false, counters: {} };
}

/** Reads a stored or received state defensively; anything that is not an object reads as no state. */
export function parseGuideState(raw: unknown): GuideState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const state = emptyState();
  const stored = value['tourMap'];
  if (stored && typeof stored === 'object') {
    for (const page of TOUR_PAGES) {
      const entry = (stored as Record<string, unknown>)[page];
      if (entry && typeof entry === 'object') {
        const e = entry as Partial<TourEntry>;
        state.tourMap[page] = {
          seen: e.seen === true,
          skippedByData: e.skippedByData === true,
          replayedAt: typeof e.replayedAt === 'string' ? e.replayedAt : null
        };
      }
    }
  }
  const counters = value['counters'];
  if (counters && typeof counters === 'object') {
    for (const [key, count] of Object.entries(counters as Record<string, unknown>)) {
      if (typeof count === 'number' && Number.isFinite(count)) {
        state.counters[key] = count;
      }
    }
  }
  state.cardHidden = value['cardHidden'] === true;
  state.tourSkipped = value['tourSkipped'] === true;
  state.restarted = value['restarted'] === true;
  return state;
}

/**
 * State behind the Getting started card on Home and the spotlight paths.
 *
 * Completion of the four steps is read from the account's real data, never ticked by hand. What the person hid, saw
 * or counted lives on the server (`/users/me/guide`, one JSON object), so a second device, a cleared browser or the
 * desktop app's own browser pick up where the person left off. The state is loaded once after sign-in, and nothing
 * starts until it has arrived; a failed load leaves the guide off for that visit rather than guessing. Every change is
 * written back whole, 500 ms after the last one. localStorage keeps a copy only to avoid a flash before the load; where
 * the two differ the server copy wins.
 *
 * "New account" is the profile's `createdAt` within 14 days. A path opened from a Home card step (`?guide=`) is
 * followed: when the card's task is done the person gets a toast with a way back to Home (memory only).
 */
@Injectable({ providedIn: 'root' })
export class GuideService {
  // The data services are fetched on first use, so a page that only restarts the guide does not need them.
  private readonly injector = inject(Injector);

  private readonly userId = signal<string | null>(null);
  private readonly progress = signal<GuideProgress>(NONE_DONE);
  private readonly cardHidden = signal(false);
  private readonly eligibleForTour = signal(false);
  private readonly tourSkipped = signal(false);
  private readonly restarted = signal(false);
  private readonly tourMap = signal<TourMap>({});
  private readonly counters = signal<Record<string, number>>({});
  private readonly used = signal<Partial<Record<TourPage, boolean>>>({});
  private readonly followed = signal<GuideStepId | null>(null);
  private followTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Counts the loads and restarts, so the answer to an older load never overwrites a newer state. */
  private epoch = 0;
  private createdAt: string | null = null;
  /** Counts bumped before the state arrived; they are added to it when it does. */
  private pending: Record<string, number> = {};
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** True once the state is known (loaded from the server, or reset by a restart): paths may start. */
  readonly ready = signal(false);
  /** True when the state could not be read from the server; the guide stays off for this visit. */
  readonly loadFailed = signal(false);
  /** True while a spotlight path is on screen. The "step done" toast waits until it is closed. */
  readonly pathRunning = signal(false);
  /** Fires when the state has arrived or a page has told the guide whether its surface is in use, so a waiting path can start. */
  readonly usageReported = new Subject<void>();
  /** The tour map as it stands, for tests and for the restart. */
  readonly map = this.tourMap.asReadonly();
  /** The Home card step the person arrived from and is working on, or null. */
  readonly following = this.followed.asReadonly();
  /** True once the completion of the four steps has been read from the account. */
  readonly loaded = signal(false);

  /** The surface the page on screen publishes (the open tab, for a tabbed page); null when it publishes none. */
  readonly surface = signal<TourPage | null>(null);
  /** True while a full-screen surface (the session player, the live tracker) carries its own "?", so the top bar's is not drawn. */
  readonly fullScreen = signal(false);
  /** A surface that covers the page, such as the open coach dock; it wins over `surface` while it is up. */
  readonly overlay = signal<TourPage | null>(null);

  readonly steps = this.progress.asReadonly();
  readonly doneCount = computed(() => GUIDE_STEP_IDS.filter((id) => this.progress()[id]).length);
  readonly allDone = computed(() => this.doneCount() === GUIDE_STEP_IDS.length);
  /** The first step that is not done, or null when all four are. */
  readonly nextStep = computed<GuideStepId | null>(() => GUIDE_STEP_IDS.find((id) => !this.progress()[id]) ?? null);
  /** The card is shown once the data is in, until the person hides it. */
  readonly cardVisible = computed(() => this.ready() && this.loaded() && !this.cardHidden());

  /** A page tells the guide which surface it is showing. */
  publishSurface(page: TourPage | null): void {
    this.surface.set(page);
  }

  /** A page that is going away takes its surface back, unless the next page has already published its own. */
  clearSurface(page: TourPage | null): void {
    if (this.surface() === page) {
      this.surface.set(null);
    }
  }

  /**
   * Takes a person the caller already knows: reads the cached copy for the first paint and asks the server for the
   * real state. Paths wait for the answer.
   */
  adopt(userId: string | null): void {
    this.cancelSave();
    this.epoch++;
    this.userId.set(userId);
    this.ready.set(false);
    this.loadFailed.set(false);
    this.createdAt = null;
    this.pending = {};
    this.used.set({});
    this.applyState(emptyState());
    this.eligibleForTour.set(false);
    if (!userId) {
      return;
    }
    const cached = this.readCache();
    if (cached) {
      this.applyState(cached);
    }
    this.loadState(userId, this.epoch, cached);
  }

  /**
   * Finds the person from the stored sign-in token, which needs no request, and loads their state. Called from every
   * place that wants the guide, so it does nothing while the same person is already loaded or loading.
   */
  start(): void {
    const subject = this.tokenSubject();
    if (subject && subject !== this.userId()) {
      this.adopt(subject);
    }
  }

  private tokenSubject(): string | null {
    try {
      return subjectFromAccessToken(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken));
    } catch {
      return null;
    }
  }

  private loadState(userId: string, epoch: number, cached: GuideState | null): void {
    const fail = (): void => {
      if (epoch === this.epoch) {
        this.loadFailed.set(true);
      }
    };
    try {
      const data = this.injector.get(FitSyncDataService);
      const account = this.injector.get(AccountDataService);
      forkJoin({
        view: data.getGuideState(),
        created: account.getCurrentUser().pipe(
          map((user) => user.profile?.createdAt ?? null),
          catchError(() => of(null))
        )
      }).subscribe({
        next: ({ view, created }) => {
          if (epoch !== this.epoch || this.userId() !== userId) {
            return;
          }
          this.createdAt = created;
          const server = parseGuideState(view?.state);
          // No row yet: whatever this browser already knew moves up to the server.
          const state = server ?? cached ?? emptyState();
          for (const [key, count] of Object.entries(this.pending)) {
            state.counters[key] = (state.counters[key] ?? 0) + count;
          }
          const dirty = !server && (cached !== null || Object.keys(this.pending).length > 0);
          this.pending = {};
          this.applyState(state);
          this.eligibleForTour.set(state.restarted || this.accountIsNew());
          this.ready.set(true);
          this.writeCache();
          if (dirty) {
            this.scheduleSave();
          }
          this.usageReported.next();
        },
        error: fail
      });
    } catch {
      fail();
    }
  }

  /**
   * Reads whether each step is done. The goals come from Home, which has them already, so only the plan, the
   * sessions and the meals are asked for here. A request that fails leaves its step open.
   */
  load(goals: readonly Pick<Goal, 'goalType' | 'status'>[]): void {
    this.start();
    if (!this.userId()) {
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
    this.changed();
  }

  /**
   * Whether the path of a page starts on its own now. Only the four first-tour pages do, and only for a new account (or
   * one that restarted the guide); a page opened with `?guide=` (`explicit`) does not need the account to be new; and
   * the session player does, whatever the account's age, until a first session has been completed (its skip condition,
   * see `gate`). Every other surface is reached from the "?" and never appears here.
   */
  spotlightDue(page: TourPage, explicit = false): boolean {
    const entry = this.entry(page);
    const firstTour = (FIRST_TOUR_PAGES as readonly string[]).includes(page);
    const allowed = explicit || (firstTour && this.eligibleForTour()) || page === PLAYER_PAGE;
    return this.ready() && allowed && !this.tourSkipped() && !entry.seen && !entry.skippedByData;
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

  /** What the person has opened, kept in the server state: sessions, exercises, visits of a surface. */
  count(key: string): number {
    return this.counters()[key] ?? 0;
  }

  bump(key: string): void {
    this.start();
    if (!this.userId()) {
      return;
    }
    if (!this.ready()) {
      this.pending[key] = (this.pending[key] ?? 0) + 1;
      return;
    }
    this.counters.update((counters) => ({ ...counters, [key]: (counters[key] ?? 0) + 1 }));
    this.changed();
  }

  /** A surface was opened; the skip condition "opened twice" counts these. */
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

  /**
   * The session player asks once whether a first session is still ahead, which is what lets its path start by itself. A
   * request that fails reports nothing, so the path does not start on a guess.
   */
  checkFirstSession(): void {
    this.start();
    try {
      this.injector
        .get(FitSyncDataService)
        .getWorkoutSessionPage({ size: 1, status: 'COMPLETED' })
        .subscribe({
          next: (page) => this.reportUsed(PLAYER_PAGE, page.sessions.length > 0),
          error: () => undefined
        });
    } catch {
      // No data service, nothing to ask.
    }
  }

  /** "Skip the tour": no page shows a spotlight again until the guide is restarted. */
  skipTour(): void {
    this.tourSkipped.set(true);
    this.changed();
  }

  /**
   * "Show the guide again" and "Take the tour again": resets the state on the server, brings the card back and lets the
   * four first-tour pages start again, for an older account too. Nothing else starts on its own.
   */
  restart(userId?: string | null): void {
    if (userId && userId !== this.userId()) {
      this.cancelSave();
      this.userId.set(userId);
    }
    this.start();
    if (!this.userId()) {
      return;
    }
    // A state that is still on its way from the server is out of date now.
    this.epoch++;
    this.pending = {};
    for (const key of [...LEGACY_KEYS, ...TOUR_PAGES.map((page) => `tour.${page}`)]) {
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
    this.counters.set({});
    this.used.set({});
    this.restarted.set(true);
    this.stopFollowing();
    this.cardHidden.set(false);
    this.tourSkipped.set(false);
    this.eligibleForTour.set(true);
    this.loadFailed.set(false);
    this.ready.set(true);
    this.changed();
  }

  private entry(page: TourPage): TourEntry {
    return this.tourMap()[page] ?? NEW_ENTRY;
  }

  private setEntry(page: TourPage, change: Partial<TourEntry>): void {
    this.tourMap.update((map) => ({ ...map, [page]: { ...(map[page] ?? NEW_ENTRY), ...change } }));
    this.changed();
  }

  private applyState(state: GuideState): void {
    this.tourMap.set(state.tourMap);
    this.cardHidden.set(state.cardHidden);
    this.tourSkipped.set(state.tourSkipped);
    this.restarted.set(state.restarted);
    this.counters.set(state.counters);
  }

  /** The state as it is written to the server and to the cache. */
  snapshot(): GuideState {
    return {
      tourMap: this.tourMap(),
      cardHidden: this.cardHidden(),
      tourSkipped: this.tourSkipped(),
      restarted: this.restarted(),
      counters: this.counters()
    };
  }

  /** Something changed: keep the copy in this browser and write the whole state to the server soon. */
  private changed(): void {
    if (!this.ready() || !this.userId()) {
      return;
    }
    this.writeCache();
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.cancelSave();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const state = this.snapshot() as unknown as Record<string, unknown>;
        this.injector.get(FitSyncDataService).putGuideState(state).subscribe({
          // The copy in this browser holds the change; the next change writes the whole state again.
          error: () => undefined
        });
      } catch {
        // No data service, nothing to write to.
      }
    }, GUIDE_SAVE_DEBOUNCE_MS);
  }

  private cancelSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /** The state this browser cached, or what v2 and v3 kept key by key, or null for a browser that knows nothing. */
  private readCache(): GuideState | null {
    const cached = this.readJson<unknown>('state');
    if (cached) {
      return parseGuideState(cached);
    }
    const legacyMap = this.readJson<TourMap>('tour-map') ?? {};
    const legacy = {
      tourMap: { ...legacyMap } as Record<string, unknown>,
      cardHidden: this.read('card-hidden') === '1',
      tourSkipped: this.read('tour-skipped') === '1',
      restarted: this.read('restarted') === '1',
      counters: this.readJson<Record<string, number>>('counters') ?? {}
    };
    for (const page of TOUR_PAGES) {
      if (this.read(`tour.${page}`) === '1') {
        legacy.tourMap[page] = { ...NEW_ENTRY, ...(legacyMap[page] ?? {}), seen: true };
      }
    }
    const any = legacy.cardHidden || legacy.tourSkipped || legacy.restarted || Object.keys(legacy.tourMap).length > 0 || Object.keys(legacy.counters).length > 0;
    return any ? parseGuideState(legacy) : null;
  }

  private writeCache(): void {
    this.write('state', JSON.stringify(this.snapshot()));
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

  /** The profile's `createdAt` is within 14 days. An account whose age is unknown is not new: no spotlight on a guess. */
  private accountIsNew(): boolean {
    const created = this.createdAt ? Date.parse(this.createdAt) : NaN;
    return Number.isFinite(created) && Date.now() - created <= TOUR_ACCOUNT_AGE_DAYS * DAY_MS;
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
      // Storage can be blocked; the state then lives on the server and in memory.
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

/**
 * Publishes the surface a page is showing to the "?" in the top bar, for as long as the page lives. `source` is read in a
 * signal context, so a tabbed page can return the open tab's surface; `fullScreen` says the page has put its own "?" in a
 * full-screen view. Call it in an injection context (a constructor or field initialiser).
 */
export function publishSurface(source: () => TourPage | null, fullScreen: () => boolean = () => false): void {
  const guide = inject(GuideService);
  let last: TourPage | null = null;
  effect(() => {
    last = source();
    guide.publishSurface(last);
    guide.fullScreen.set(fullScreen());
  });
  inject(DestroyRef).onDestroy(() => {
    guide.clearSurface(last);
    guide.fullScreen.set(false);
  });
}

/** Counts one visit of a surface for the skip condition "opened twice"; call it where the page is created. */
export function markVisit(page: TourPage): void {
  inject(GuideService).noteVisit(page);
}
