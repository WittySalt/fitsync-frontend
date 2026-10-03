import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { DayKind } from '../fitsync.models';
import { CoachSurfaceCode } from './coach.models';

/** The part of the app the coach is currently looking at. */
export type SurfaceId = 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'profile' | 'coach' | 'other';

export interface SuggestedQuestion {
  text: string;
  /** True when the question asks the coach to build something rather than explain something. */
  generative: boolean;
}

export interface Surface {
  id: SurfaceId;
  /** What the dock header says it is looking at, for example "Nutrition, this week". */
  label: string;
  /** Recommendation types this surface shows inline; the dock shows these first. */
  inlineTypes: string[];
  suggestions: SuggestedQuestion[];
  /** The code sent to the server with a question, or null for a surface the server does not know. */
  code: CoachSurfaceCode | null;
}

/**
 * Maps the active route onto a surface: what the coach is looking at, which insights belong here,
 * and which questions to offer.
 *
 * This table is what makes the assistant app-wide rather than a box floating over the app. The
 * suggested questions are deliberately narrow: every one of them is answerable from the facts the
 * coach can actually read, because a question outside that envelope is the fastest route to a
 * confident wrong answer in front of an assessor.
 */
@Injectable({ providedIn: 'root' })
export class CoachContextService {
  private readonly router = inject(Router);
  // Passed explicitly so the subscription is tied to this service's injector whatever context the
  // field initialiser happens to run in; the dev server's hot reload re-instantiates services
  // outside the usual construction path and toSignal raised NG0203 there.
  private readonly injector = inject(Injector);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url, injector: this.injector }
  );

  private readonly kindOfToday = signal<DayKind | null>(null);

  /** What kind of day today is, or null while the weekly insight has not said. */
  readonly todayKind = this.kindOfToday.asReadonly();

  readonly surface = computed<Surface>(() => surfaceFor(this.url(), this.kindOfToday()));

  /** Set by the pages that load the weekly insight, so the suggested questions can follow it. */
  setTodayKind(kind: DayKind | null): void {
    this.kindOfToday.set(kind);
  }
}

const SURFACES: Record<SurfaceId, Surface> = {
  dashboard: {
    id: 'dashboard',
    label: 'Home, today',
    inlineTypes: ['NUTRITION_GAP', 'STREAK_NUDGE', 'LOGGING_REMINDER', 'COLD_START'],
    suggestions: [
      { text: 'How is my day going?', generative: false },
      { text: 'Build me a session for today', generative: true },
      { text: 'What should I eat tonight?', generative: false }
    ],
    code: 'HOME'
  },
  workout: {
    id: 'workout',
    label: 'Workout, this week',
    inlineTypes: ['WEEKLY_ADHERENCE', 'PERSONAL_RECORD'],
    suggestions: [
      { text: 'Should I train today?', generative: false },
      { text: 'Build me a session for today', generative: true },
      { text: 'How is my week going?', generative: false }
    ],
    code: 'WORKOUT'
  },
  nutrition: {
    id: 'nutrition',
    label: 'Nutrition, this week',
    inlineTypes: ['NUTRITION_GAP'],
    suggestions: [
      { text: 'How did I eat this week?', generative: false },
      { text: 'Which nutrient am I lowest in?', generative: false },
      { text: 'What could I cook tonight that fits?', generative: false }
    ],
    code: 'NUTRITION'
  },
  progress: {
    id: 'progress',
    label: 'Progress, this week',
    inlineTypes: ['WEEKLY_NARRATIVE', 'GOAL_PACE'],
    suggestions: [
      { text: 'Am I on pace for my goal?', generative: false },
      { text: 'What changed this week?', generative: false }
    ],
    code: 'PROGRESS'
  },
  profile: {
    id: 'profile',
    label: 'Your profile',
    inlineTypes: ['GOAL_PACE'],
    suggestions: [
      { text: 'Is my target realistic?', generative: false },
      { text: 'Am I on pace for my goals?', generative: false }
    ],
    code: 'PROFILE'
  },
  coach: {
    id: 'coach',
    label: 'Coach workspace',
    inlineTypes: [],
    suggestions: [
      { text: 'Build me a session for today', generative: true },
      { text: 'Should I train today?', generative: false }
    ],
    code: null
  },
  other: {
    id: 'other',
    label: 'FitSync',
    inlineTypes: [],
    suggestions: [
      { text: 'How is my day going?', generative: false },
      { text: 'Build me a session for today', generative: true }
    ],
    code: null
  }
};

const BUILD_SESSION: SuggestedQuestion = { text: 'Build me a session for today', generative: true };
const WEEK_QUESTION: SuggestedQuestion = { text: 'How is my week going?', generative: false };
const YESTERDAY_QUESTION: SuggestedQuestion = { text: 'What did I train yesterday?', generative: false };

/**
 * The questions worth asking depend on what today is for: a runner wants last time's distance, not
 * a lifting prompt. A rest day offers no session to build, since the coach never pushes. Open and
 * unknown days keep each surface's own questions.
 */
const SUGGESTIONS_BY_TODAY_KIND: Partial<Record<DayKind, SuggestedQuestion[]>> = {
  STRENGTH: [{ text: 'What should I lift today?', generative: false }, BUILD_SESSION, WEEK_QUESTION],
  CARDIO: [{ text: 'How far did I run last time?', generative: false }, BUILD_SESSION, WEEK_QUESTION],
  MOBILITY: [{ text: 'How long was my last mobility session?', generative: false }, BUILD_SESSION, WEEK_QUESTION],
  SPORT: [{ text: 'How long did I play last time?', generative: false }, WEEK_QUESTION, YESTERDAY_QUESTION],
  REST: [YESTERDAY_QUESTION, WEEK_QUESTION, { text: 'When is my next session?', generative: false }]
};

function withTodayKind(surface: Surface, kind: DayKind | null): Surface {
  const suggestions = kind && (surface.id === 'dashboard' || surface.id === 'workout') ? SUGGESTIONS_BY_TODAY_KIND[kind] : undefined;
  return suggestions ? { ...surface, suggestions } : surface;
}

export function surfaceFor(url: string, todayKind: DayKind | null = null): Surface {
  return withTodayKind(surfaceForUrl(url), todayKind);
}

function surfaceForUrl(url: string): Surface {
  const path = url.split('?')[0].split('#')[0];
  if (path.startsWith('/dashboard') || path === '/' || path === '') {
    return SURFACES.dashboard;
  }
  if (path.startsWith('/workout')) {
    return SURFACES.workout;
  }
  if (path.startsWith('/nutrition')) {
    return SURFACES.nutrition;
  }
  if (path.startsWith('/progress') || path.startsWith('/body')) {
    return SURFACES.progress;
  }
  if (path.startsWith('/me') || path.startsWith('/settings')) {
    return SURFACES.profile;
  }
  if (path.startsWith('/coach')) {
    return SURFACES.coach;
  }
  return SURFACES.other;
}
