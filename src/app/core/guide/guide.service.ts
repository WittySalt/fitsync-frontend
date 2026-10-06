import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { AUTH_STORAGE_KEYS } from '../auth/auth.config';
import { subjectFromAccessToken } from '../auth/jwt-role';
import { FitSyncDataService } from '../fitsync-data.service';
import { Goal } from '../fitsync.models';

/** The four steps of the Getting started card, in the order a new account takes them. */
export const GUIDE_STEP_IDS = ['targets', 'plan', 'meal', 'session'] as const;
export type GuideStepId = (typeof GUIDE_STEP_IDS)[number];

/** The pages that carry a first-visit spotlight, in the order the tour meets them. */
export const TOUR_PAGES = ['workout', 'nutrition', 'progress', 'me'] as const;
export type TourPage = (typeof TOUR_PAGES)[number];

/** A spotlight is for new accounts. After this many days the account is left alone unless the person restarts the guide. */
export const TOUR_ACCOUNT_AGE_DAYS = 14;

const DAY_MS = 24 * 3600 * 1000;
const PREFIX = 'fitsync.guide';
/** A goal of one of these types counts as a target for step 1. */
const TARGET_GOAL_TYPES = ['WEIGHT', 'WORKOUT_FREQUENCY'];

export type GuideProgress = Record<GuideStepId, boolean>;

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
 *   fitsync.guide.{userId}.tour.{page}   the spotlight of that page was shown and closed
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
  private readonly seenPages = signal<readonly TourPage[]>([]);

  /** True once the person is known, so the stored flags have been read. */
  readonly ready = signal(false);
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
    this.seenPages.set(TOUR_PAGES.filter((page) => this.read(`tour.${page}`) === '1'));
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
      plan: data.getWorkoutPlans('ACTIVE').pipe(
        map((plans) => plans.some((plan) => plan.status === 'ACTIVE')),
        catchError(() => of(false))
      ),
      session: data.getWorkoutSessionPage({ size: 1, status: 'COMPLETED' }).pipe(
        map((page) => page.sessions.length > 0),
        catchError(() => of(false))
      ),
      meal: data.hasLoggedMeal().pipe(catchError(() => of(false)))
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

  hideCard(): void {
    this.cardHidden.set(true);
    this.write('card-hidden', '1');
  }

  /** Whether the spotlight of a page is due: new account (or restarted), not seen, not skipped. */
  spotlightDue(page: TourPage): boolean {
    return this.ready() && this.eligibleForTour() && !this.tourSkipped() && !this.seenPages().includes(page);
  }

  markSeen(page: TourPage): void {
    if (this.seenPages().includes(page)) {
      return;
    }
    this.seenPages.update((pages) => [...pages, page]);
    this.write(`tour.${page}`, '1');
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
    for (const key of ['card-hidden', 'tour-skipped', ...TOUR_PAGES.map((page) => `tour.${page}`)]) {
      this.remove(key);
    }
    this.write('restarted', '1');
    this.cardHidden.set(false);
    this.tourSkipped.set(false);
    this.seenPages.set([]);
    this.eligibleForTour.set(true);
    this.ready.set(true);
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
