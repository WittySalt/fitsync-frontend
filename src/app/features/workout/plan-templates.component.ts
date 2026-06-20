import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, WorkoutPlan, WorkoutPlanExerciseInput, WorkoutPlanRequest } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';

interface TemplateExercise {
  code?: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationSeconds?: number | null;
  restSeconds: number | null;
}

interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number;
  exercises: TemplateExercise[];
}

export const WORKOUT_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'full-body-beginner',
    name: 'Full-body beginner',
    description: 'Three simple strength moves to build a reliable base.',
    goalFocus: 'GENERAL_FITNESS',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 35,
    exercises: [
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 3, targetReps: 10, restSeconds: 75 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 3, targetReps: 8, restSeconds: 75 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 3, targetReps: null, targetDurationSeconds: 30, restSeconds: 60 }
    ]
  },
  {
    id: 'upper-lower-split',
    name: 'Upper-lower split',
    description: 'A simple strength split built from seeded squat, press, and core movements.',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 50,
    exercises: [
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 4, targetReps: 8, restSeconds: 120 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 4, targetReps: 8, restSeconds: 90 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 3, targetReps: null, targetDurationSeconds: 45, restSeconds: 75 }
    ]
  },
  {
    id: 'hiit-starter',
    name: 'HIIT starter',
    description: 'Short conditioning blocks with bodyweight-friendly movements.',
    goalFocus: 'ENDURANCE',
    workoutType: 'HIIT',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 25,
    exercises: [
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 4, targetReps: 10, restSeconds: 45 },
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 4, targetReps: 12, restSeconds: 45 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 4, targetReps: null, targetDurationSeconds: 30, restSeconds: 45 }
    ]
  },
  {
    id: 'mobility-reset',
    name: 'Mobility reset',
    description: 'Low impact movement for recovery days and desk-weary hips.',
    goalFocus: 'MOBILITY',
    workoutType: 'MOBILITY',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 20,
    exercises: [
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 2, targetReps: null, targetDurationSeconds: 30, restSeconds: 45 },
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 2, targetReps: 8, restSeconds: 60 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 2, targetReps: 6, restSeconds: 60 }
    ]
  }
];

@Component({
  selector: 'app-plan-templates',
  templateUrl: './plan-templates.component.html',
  styleUrl: './plan-templates.component.scss'
})
export class PlanTemplatesComponent {
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);

  @Output() planActivated = new EventEmitter<WorkoutPlan>();

  readonly templates = WORKOUT_PLAN_TEMPLATES;
  readonly selectedTemplate = signal<PlanTemplate | null>(WORKOUT_PLAN_TEMPLATES[0] ?? null);
  readonly applyingTemplateId = signal<string | null>(null);

  selectTemplate(template: PlanTemplate): void {
    this.selectedTemplate.set(template);
  }

  useTemplate(template: PlanTemplate): void {
    if (this.applyingTemplateId()) {
      return;
    }

    this.applyingTemplateId.set(template.id);
    this.resolveTemplateExercises(template).pipe(
      switchMap((resolved) => {
        if (!resolved.length) {
          this.toast.error('None of this template\'s exercises are available yet.');
          return of(null);
        }

        const skipped = template.exercises.length - resolved.length;
        if (skipped > 0) {
          this.toast.info(`${skipped} template exercise${skipped === 1 ? '' : 's'} unavailable and skipped.`);
        }

        return this.dataService.createWorkoutPlan(this.toWorkoutPlanRequest(template, resolved)).pipe(
          switchMap((plan) => {
            if (!plan.planId) {
              throw new Error('Created plan did not include an id.');
            }
            return this.dataService.activateWorkoutPlan(plan.planId);
          })
        );
      }),
      finalize(() => this.applyingTemplateId.set(null))
    ).subscribe({
      next: (plan) => {
        if (!plan) {
          return;
        }
        this.toast.success('Template activated for today.');
        this.planActivated.emit(plan);
      },
      error: () => this.toast.error('Unable to use this template. Please retry.')
    });
  }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private resolveTemplateExercises(template: PlanTemplate) {
    const lookups = template.exercises.map((exercise) => {
      const query = exercise.code ?? exercise.name;
      return this.dataService.getExercises({ q: query, size: 20 }).pipe(
        catchError(() => of([] as Exercise[]))
      );
    });

    return forkJoin(lookups).pipe(
      map((results) => results
        .map((exercises, index) => this.matchExercise(template.exercises[index], exercises))
        .filter(Boolean) as Array<{ template: TemplateExercise; exercise: Exercise }>)
    );
  }

  private matchExercise(templateExercise: TemplateExercise, exercises: Exercise[]) {
    const code = this.normalize(templateExercise.code ?? '');
    const name = this.normalize(templateExercise.name);
    const exercise = exercises.find((candidate) => code && this.normalize(candidate.code) === code)
      ?? exercises.find((candidate) => this.normalize(candidate.name) === name)
      ?? exercises.find((candidate) => this.normalize(candidate.name).includes(name));
    if (!exercise?.exerciseId) {
      return null;
    }
    return { template: templateExercise, exercise };
  }

  private toWorkoutPlanRequest(
    template: PlanTemplate,
    resolved: Array<{ template: TemplateExercise; exercise: Exercise }>
  ): WorkoutPlanRequest {
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
