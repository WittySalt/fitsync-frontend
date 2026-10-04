import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { AccountDataService, AccountPreferences } from '../../../core/account-data.service';
import { FitSyncDataService, normalizeFocusAreas } from '../../../core/fitsync-data.service';
import { Exercise, SportActivityOption, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { PlanCoverage } from './plan-coverage';
import { coverageFromRaw, draftFromRaw, proposalFromRaw } from './plan-flow.mappers';
import { CARDIO_PLACES, CardioPlace, DEFAULT_PROFILE, DraftDay, DraftMove, DraftPlan, PlanProfile } from './plan-draft';
import { HabitActivity, habitsFromInsight } from './plan-week-proposal';
import { isBodyweight, muscleLineOf } from '../plan-editor/moves/moves-model';
import { equipmentNames, levelName } from './plan-profile';
import { buildSaveRequest } from './plan-save';
import { TemplateDay } from './plan-flow.templates';
import type { StarterTemplate } from '../../dashboard/brief/no-plan/first-sessions';

/** Everything the flow reads when it opens, each part optional so one failed read never blocks the page. */
export interface PlanFlowContext {
  profile: PlanProfile;
  /** True when the profile could be read; false means the defaults are in use. */
  profileKnown: boolean;
  habits: HabitActivity[];
  sports: SportActivityOption[];
  currentPlanName: string | null;
  lastCardio: LastCardio | null;
  preferences: AccountPreferences | null;
}

export interface LastCardio {
  /** Where the last session was done, when the session carries it. */
  location?: CardioPlace | null;
  distanceKm: number | null;
  minutes: number | null;
  startedAt: string;
}

function placeOf(session: object): CardioPlace | null {
  const raw = String((session as { location?: unknown }).location ?? '').toUpperCase();
  return (CARDIO_PLACES as readonly string[]).includes(raw) ? (raw as CardioPlace) : null;
}

export function profileFromPreferences(preferences: AccountPreferences | null | undefined): PlanProfile {
  const training = preferences?.training;
  if (!training) {
    return { ...DEFAULT_PROFILE };
  }
  return {
    fitnessLevel: levelName(training.fitnessLevel || DEFAULT_PROFILE.fitnessLevel),
    weeklyWorkoutDays: training.weeklyWorkoutDays ?? DEFAULT_PROFILE.weeklyWorkoutDays,
    preferredDurationMinutes: training.preferredDurationMinutes ?? DEFAULT_PROFILE.preferredDurationMinutes,
    equipment: equipmentNames(training.equipmentInventory ?? []),
    focusAreas: normalizeFocusAreas(training.focusAreas)
  };
}

export function exerciseToMove(exercise: Exercise, timed: boolean): DraftMove {
  const meta = [exercise.primaryMuscleGroup, exercise.equipment]
    .filter(Boolean)
    .map((part) => part.toLowerCase().replace(/_/g, ' '))
    .join(' · ');
  return {
    exerciseId: exercise.exerciseId ?? '',
    name: exercise.name,
    meta,
    imageUrl: exercise.imageUrls?.[0] ?? exercise.images?.[0]?.url ?? null,
    timed,
    sets: timed ? 2 : 3,
    reps: timed ? null : 10,
    durationSeconds: timed ? 40 : null,
    weightKg: null,
    restSeconds: timed ? 15 : 75,
    tempoSeconds: null,
    notes: '',
    bodyweight: isBodyweight(exercise.equipment),
    primaryGroups: exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup.toUpperCase()] : [],
    secondaryGroups: (exercise.secondaryMuscleGroups ?? []).map((group) => group.toUpperCase())
  };
}

@Injectable({ providedIn: 'root' })
export class PlanFlowApi {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountDataService);
  private readonly data = inject(FitSyncDataService);
  private readonly base = '/api/v1/workouts/plans';

  load(): Observable<PlanFlowContext> {
    return forkJoin({
      user: this.account.getCurrentUser().pipe(catchError(() => of(null))),
      insight: this.data.getWeeklyTrainingInsight().pipe(catchError(() => of(null as WeeklyTrainingInsight | null))),
      metadata: this.data.getExerciseMetadata(),
      active: this.data.getActivePlan().pipe(catchError(() => of(null))),
      cardio: this.data
        .getWorkoutSessionPage({ workoutType: 'CARDIO', status: 'COMPLETED', size: 1 })
        .pipe(catchError(() => of(null)))
    }).pipe(
      map(({ user, insight, metadata, active, cardio }) => {
        const last = cardio?.sessions?.[0];
        return {
          profile: profileFromPreferences(user?.preferences),
          profileKnown: !!user?.preferences?.training,
          habits: habitsFromInsight(insight),
          sports: metadata?.sportActivities ?? [],
          currentPlanName: active?.name ?? null,
          lastCardio: last ? { location: placeOf(last), distanceKm: last.distanceKm ?? null, minutes: last.durationMinutes, startedAt: last.startedAt } : null,
          preferences: user?.preferences ?? null
        };
      })
    );
  }

  /** The server's draft week for a profile, or null when it cannot give one. */
  proposal(profile: PlanProfile): Observable<DraftDay[] | null> {
    const body = {
      fitnessLevel: profile.fitnessLevel,
      weeklyWorkoutDays: profile.weeklyWorkoutDays,
      preferredDurationMinutes: profile.preferredDurationMinutes,
      equipment: profile.equipment,
      focusAreas: profile.focusAreas
    };
    return this.http.post<unknown>(`${this.base}/proposal`, body).pipe(
      map((raw) => proposalFromRaw(raw)),
      switchMap((days) => (days ? this.enrich(days) : of(days))),
      catchError(() => of(null))
    );
  }

  /** Muscle coverage of the draft, or null when the endpoint is missing or fails. */
  coverage(plan: DraftPlan, profile: PlanProfile): Observable<PlanCoverage | null> {
    return this.http.post<unknown>(`${this.base}/coverage`, buildSaveRequest(plan, profile)).pipe(
      map((raw) => coverageFromRaw(raw)),
      catchError(() => of(null))
    );
  }

  /** One saved plan, opened for editing. */
  loadPlan(planId: string): Observable<DraftPlan | null> {
    return this.http.get<unknown>(`${this.base}/${planId}`).pipe(
      map((raw) => draftFromRaw(raw)),
      switchMap((draft) => (draft ? this.enrich(draft.days).pipe(map((days) => ({ ...draft, days }))) : of(draft)))
    );
  }

  /** Creates or updates the plan and makes it current when asked. Emits the saved plan's id. */
  save(plan: DraftPlan, profile: PlanProfile, makeCurrent: boolean): Observable<string> {
    const body = buildSaveRequest(plan, profile);
    const request = plan.planId
      ? this.http.put<{ planId?: string | null }>(`${this.base}/${plan.planId}`, body)
      : this.http.post<{ planId?: string | null }>(this.base, body);
    return request.pipe(
      map((saved) => saved?.planId ?? plan.planId ?? ''),
      switchMap((planId) => {
        if (!planId) {
          throw new Error('The saved plan came back without an id.');
        }
        return makeCurrent ? this.data.activateWorkoutPlan(planId).pipe(map(() => planId)) : of(planId);
      })
    );
  }

  /** Writes the five profile fields back to the preferences, leaving everything else as it was. */
  saveProfile(profile: PlanProfile, preferences: AccountPreferences | null): Observable<AccountPreferences | null> {
    if (!preferences) {
      return of(null);
    }
    const next: AccountPreferences = {
      ...preferences,
      training: {
        ...preferences.training,
        fitnessLevel: profile.fitnessLevel,
        weeklyWorkoutDays: profile.weeklyWorkoutDays,
        preferredDurationMinutes: profile.preferredDurationMinutes,
        equipmentInventory: profile.equipment,
        focusAreas: profile.focusAreas
      }
    };
    return this.account.updatePreferences(next);
  }

  /**
   * The server sends a move's name and image but not its muscles or equipment, so the exercises of
   * a draft are read from the catalogue once each and the line under the name, the muscle groups
   * and the bodyweight flag are filled in. A lookup that fails leaves the move as it was.
   */
  enrich(days: DraftDay[]): Observable<DraftDay[]> {
    const ids = [...new Set(days.flatMap((day) => day.moves).filter((move) => move.exerciseId && move.bodyweight === undefined).map((move) => move.exerciseId))];
    if (ids.length === 0) {
      return of(days);
    }
    return forkJoin(ids.map((id) => this.data.getExercise(id).pipe(catchError(() => of(null))))).pipe(
      map((found) => {
        const byId = new Map(found.filter((entry): entry is NonNullable<typeof entry> => !!entry?.exerciseId).map((entry) => [entry.exerciseId!, entry]));
        return days.map((day) => ({
          ...day,
          moves: day.moves.map((move) => {
            const exercise = byId.get(move.exerciseId);
            if (!exercise) {
              return move;
            }
            return {
              ...move,
              meta: move.meta || muscleLineOf(exercise),
              imageUrl: move.imageUrl ?? exercise.images?.[0]?.url ?? exercise.imageUrls?.[0] ?? null,
              bodyweight: isBodyweight(exercise.equipment),
              primaryGroups: exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup.toUpperCase()] : [],
              secondaryGroups: (exercise.secondaryMuscleGroups ?? []).map((group) => group.toUpperCase())
            };
          })
        }));
      })
    );
  }

  /** Resolves a starter template's rows to catalogue moves. Rows the catalogue does not know are dropped. */
  resolveTemplate(template: StarterTemplate): Observable<TemplateDay> {
    const lookups = template.exercises.map((row) =>
      this.data.getExercises({ q: row.code ?? row.name, size: 20 }).pipe(catchError(() => of([] as Exercise[])))
    );
    return forkJoin(lookups).pipe(
      map((results) => {
        const moves: DraftMove[] = [];
        results.forEach((candidates, index) => {
          const row = template.exercises[index];
          const found = matchTemplateExercise(row.code, row.name, candidates);
          if (found?.exerciseId) {
            moves.push(templateRowToMove(found, row));
          }
        });
        return {
          name: template.name,
          workoutType: template.workoutType,
          estimatedDurationMinutes: template.estimatedDurationMinutes,
          moves
        };
      })
    );
  }

  /** The catalogue's mobility set, for a mobility day created empty. */
  mobilityFlow(count = 6): Observable<DraftMove[]> {
    return this.data.getExercises({ exerciseType: 'MOBILITY', size: count }).pipe(
      map((exercises) => exercises.filter((exercise) => !!exercise.exerciseId).slice(0, count).map((exercise) => exerciseToMove(exercise, true))),
      catchError(() => of([] as DraftMove[]))
    );
  }
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds the catalogue exercise a template row means, by code first and then by name. */
export function matchTemplateExercise(code: string | undefined, name: string, candidates: readonly Exercise[]): Exercise | null {
  const wantedCode = normalise(code ?? '');
  const wantedName = normalise(name);
  return (
    candidates.find((item) => wantedCode && normalise(item.code) === wantedCode) ??
    candidates.find((item) => normalise(item.name) === wantedName) ??
    candidates.find((item) => normalise(item.name).includes(wantedName)) ??
    null
  );
}

export function templateRowToMove(
  exercise: Exercise,
  row: { targetSets: number | null; targetReps: number | null; targetDurationSeconds?: number | null; restSeconds: number | null }
): DraftMove {
  const timed = (row.targetDurationSeconds ?? 0) > 0 && !row.targetReps;
  return {
    ...exerciseToMove(exercise, timed),
    sets: row.targetSets,
    reps: timed ? null : row.targetReps,
    durationSeconds: timed ? (row.targetDurationSeconds ?? null) : null,
    restSeconds: row.restSeconds
  };
}
