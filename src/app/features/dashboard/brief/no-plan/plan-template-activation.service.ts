import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { Exercise, WorkoutPlan, WorkoutPlanExerciseInput, WorkoutPlanRequest } from '../../../../core/fitsync.models';
import { StarterTemplate } from './first-sessions';

type TemplateExercise = StarterTemplate['exercises'][number];
interface ResolvedExercise {
  template: TemplateExercise;
  exercise: Exercise;
}

/** Raised when none of a template's exercises exist in the catalogue, so no plan can be built. */
export class NoTemplateExercisesError extends Error {
  constructor() {
    super('None of this template\'s exercises are available yet.');
    this.name = 'NoTemplateExercisesError';
  }
}

export interface ActivatedTemplate {
  plan: WorkoutPlan;
  /** How many of the template's exercises the catalogue could not match and were left out. */
  skipped: number;
}

/**
 * Turns a starter template into a real active plan: it looks each exercise up in the catalogue,
 * creates the plan from the ones it finds and activates it. The steps and the request mirror what
 * the Workout page does for "Use this template".
 */
@Injectable({ providedIn: 'root' })
export class PlanTemplateActivationService {
  private readonly dataService = inject(FitSyncDataService);

  activate(template: StarterTemplate): Observable<ActivatedTemplate> {
    return this.resolveExercises(template).pipe(
      switchMap((resolved) => {
        if (!resolved.length) {
          return throwError(() => new NoTemplateExercisesError());
        }
        const skipped = template.exercises.length - resolved.length;
        return this.dataService.createWorkoutPlan(this.toRequest(template, resolved)).pipe(
          switchMap((plan) => {
            if (!plan.planId) {
              return throwError(() => new Error('Created plan did not include an id.'));
            }
            return this.dataService.activateWorkoutPlan(plan.planId);
          }),
          map((plan) => ({ plan, skipped }))
        );
      })
    );
  }

  private resolveExercises(template: StarterTemplate): Observable<ResolvedExercise[]> {
    const lookups = template.exercises.map((exercise) =>
      this.dataService
        .getExercises({ q: exercise.code ?? exercise.name, size: 20 })
        .pipe(catchError(() => of([] as Exercise[])))
    );
    return forkJoin(lookups).pipe(
      map((results) =>
        results
          .map((exercises, index) => this.match(template.exercises[index], exercises))
          .filter((entry): entry is ResolvedExercise => entry !== null)
      )
    );
  }

  private match(templateExercise: TemplateExercise, exercises: Exercise[]): ResolvedExercise | null {
    const code = this.normalize(templateExercise.code ?? '');
    const name = this.normalize(templateExercise.name);
    const exercise =
      exercises.find((candidate) => code && this.normalize(candidate.code) === code) ??
      exercises.find((candidate) => this.normalize(candidate.name) === name) ??
      exercises.find((candidate) => this.normalize(candidate.name).includes(name));
    return exercise?.exerciseId ? { template: templateExercise, exercise } : null;
  }

  private toRequest(template: StarterTemplate, resolved: ResolvedExercise[]): WorkoutPlanRequest {
    const exercises: WorkoutPlanExerciseInput[] = resolved.map(({ template: exerciseTemplate, exercise }, index) => ({
      exerciseId: exercise.exerciseId!,
      sequence: index + 1,
      targetSets: exerciseTemplate.targetSets,
      targetReps: exerciseTemplate.targetReps,
      targetWeightKg: null,
      targetDurationSeconds: exerciseTemplate.targetDurationSeconds ?? null,
      targetDistanceKm: null,
      restSeconds: exerciseTemplate.restSeconds,
      notes: '',
      setTargets: []
    }));
    return {
      name: template.name,
      description: template.description,
      goalFocus: template.goalFocus,
      workoutType: template.workoutType,
      difficulty: template.difficulty,
      estimatedDurationMinutes: template.estimatedDurationMinutes,
      exercises
    };
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  }
}
