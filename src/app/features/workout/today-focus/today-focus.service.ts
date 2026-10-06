import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { ExerciseHistoryEntry, NextTraining, WeeklyTrainingInsight, WorkoutSession, WorkoutSessionQuery } from '../../../core/fitsync.models';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FocusFacts, FocusTarget, MoveFacts, addDays } from './today-focus';

const HISTORY_DAYS = 60;
const NO_SESSIONS: WorkoutSession[] = [];

/**
 * Reads what a day's companion needs from the endpoints the Workout and Progress pages already
 * call: the catalogue entry and history of each move, and the completed sessions. A read that
 * fails leaves its part empty, so the companion shows what it has rather than nothing.
 */
@Injectable({ providedIn: 'root' })
export class TodayFocusService {
  private readonly data = inject(FitSyncDataService);

  load(target: FocusTarget, insight: WeeklyTrainingInsight | null, next: NextTraining | null): Observable<FocusFacts> {
    const empty: FocusFacts = { insight, next, moves: [], history: NO_SESSIONS, runs: NO_SESSIONS };
    switch (target.kind) {
      case 'strength':
        return this.moves(target).pipe(map((moves) => ({ ...empty, moves })));
      case 'cardio':
        return this.sessions({ status: 'COMPLETED', workoutType: 'CARDIO', size: 3 }).pipe(map((runs) => ({ ...empty, runs })));
      case 'sport':
        return this.sessions({ status: 'COMPLETED', from: `${addDays(target.today, -HISTORY_DAYS)}T00:00:00Z`, size: 100 }).pipe(
          map((history) => ({ ...empty, history }))
        );
      default:
        return of(empty);
    }
  }

  private sessions(query: WorkoutSessionQuery): Observable<WorkoutSession[]> {
    return this.data.getWorkoutSessionPage(query).pipe(
      map((page) => page.sessions),
      catchError(() => of(NO_SESSIONS))
    );
  }

  private moves(target: FocusTarget): Observable<MoveFacts[]> {
    const ids = [...new Set(target.moves.map((move) => move.exerciseId).filter((id): id is string => !!id))];
    if (ids.length === 0) {
      return of([]);
    }
    return forkJoin(
      ids.map((exerciseId) =>
        forkJoin({
          detail: this.data.getExercise(exerciseId).pipe(catchError(() => of(null))),
          history: this.data.getExerciseHistory(exerciseId, { size: 30 }).pipe(catchError(() => of([] as ExerciseHistoryEntry[])))
        }).pipe(
          map(({ detail, history }) => ({
            exerciseId,
            primary: detail?.primaryMuscleGroup ? [detail.primaryMuscleGroup.toUpperCase()] : [],
            secondary: (detail?.secondaryMuscleGroups ?? []).map((group) => group.toUpperCase()),
            history
          }))
        )
      )
    );
  }
}
