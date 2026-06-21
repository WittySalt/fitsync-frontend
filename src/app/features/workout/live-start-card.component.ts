import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { LiveTrackerGoal, LiveTrackerStartEvent } from './live-tracker.models';
import { WorkoutLiveService } from './workout-live.service';

type StartMode = 'FREE' | 'GOAL';
type GoalType = 'MINUTES' | 'CALORIES';

const CUSTOM_NAME = 'Custom…';
type SessionNameValue = { name: string; customName: string };

@Component({
  selector: 'app-live-start-card',
  imports: [ReactiveFormsModule],
  templateUrl: './live-start-card.component.html',
  styleUrl: './live-start-card.component.scss'
})
export class LiveStartCardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  private readonly workoutLive = inject(WorkoutLiveService);

  @Output() started = new EventEmitter<LiveTrackerStartEvent>();
  @Output() backfilled = new EventEmitter<void>();

  readonly startMode = signal<StartMode>('FREE');
  readonly pastWorkoutOpen = signal(false);
  readonly starting = signal(false);
  readonly savingPastWorkout = signal(false);

  readonly workoutTypes = ['STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY', 'CUSTOM'];
  readonly namePresets = [
    'Morning Strength',
    'Evening Strength',
    'Quick Cardio',
    'HIIT Session',
    'Mobility Flow',
    'Full Body',
    'Upper Body',
    'Lower Body',
    CUSTOM_NAME
  ] as const;

  readonly startForm = this.fb.nonNullable.group(
    {
      name: [this.namePresets[0] as string, [Validators.required, Validators.maxLength(120)]],
      customName: ['', [Validators.maxLength(120)]],
      workoutType: ['STRENGTH', Validators.required],
      goalType: ['MINUTES' as GoalType, Validators.required],
      targetMinutes: [30, [Validators.min(1), Validators.max(600)]],
      targetCalories: [300, [Validators.min(1), Validators.max(5000)]]
    },
    { validators: customNameRequiredValidator }
  );

  readonly pastWorkoutForm = this.fb.nonNullable.group(
    {
      name: [this.namePresets[0] as string, [Validators.required, Validators.maxLength(120)]],
      customName: ['', [Validators.maxLength(120)]],
      workoutType: ['STRENGTH', Validators.required],
      durationMinutes: [45, [Validators.required, Validators.min(1), Validators.max(600)]],
      caloriesBurned: [350, [Validators.required, Validators.min(0), Validators.max(5000)]],
      perceivedExertion: [7, [Validators.min(1), Validators.max(10)]],
      notes: ['', Validators.maxLength(300)]
    },
    { validators: customNameRequiredValidator }
  );

  selectMode(mode: StartMode): void {
    this.startMode.set(mode);
  }

  togglePastWorkout(): void {
    this.pastWorkoutOpen.update((open) => !open);
  }

  startWorkout(): void {
    this.startForm.markAllAsTouched();
    if (this.startForm.invalid || this.starting()) {
      return;
    }

    this.starting.set(true);
    const raw = this.startForm.getRawValue();
    this.workoutLive.startAdHoc({
      name: this.resolveSessionName(raw),
      workoutType: raw.workoutType
    })
      .pipe(finalize(() => this.starting.set(false)))
      .subscribe({
        next: (session) => {
          this.toast.success('Workout started.');
          this.started.emit({ session, goal: this.buildGoal() });
        },
        error: () => this.toast.error('Unable to start a workout. Please retry.')
      });
  }

  savePastWorkout(): void {
    this.pastWorkoutForm.markAllAsTouched();
    if (this.pastWorkoutForm.invalid || this.savingPastWorkout()) {
      return;
    }

    this.savingPastWorkout.set(true);
    const raw = this.pastWorkoutForm.getRawValue();
    this.dataService.saveWorkoutSession({
      name: this.resolveSessionName(raw),
      workoutType: raw.workoutType,
      durationMinutes: raw.durationMinutes,
      caloriesBurned: raw.caloriesBurned,
      perceivedExertion: raw.perceivedExertion,
      notes: raw.notes
    })
      .pipe(finalize(() => this.savingPastWorkout.set(false)))
      .subscribe({
        next: () => {
          this.pastWorkoutOpen.set(false);
          this.pastWorkoutForm.reset({
            name: this.namePresets[0],
            customName: '',
            workoutType: 'STRENGTH',
            durationMinutes: 45,
            caloriesBurned: 350,
            perceivedExertion: 7,
            notes: ''
          });
          this.toast.success('Workout logged.');
          this.backfilled.emit();
        },
        error: () => this.toast.error('Unable to log workout. Check your connection and try again.')
      });
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  isCustomNameSelected(name: string): boolean {
    return name === CUSTOM_NAME;
  }

  customNameInvalid(form: typeof this.startForm | typeof this.pastWorkoutForm): boolean {
    return form.controls.customName.touched && form.hasError('customNameRequired');
  }

  customNameTooLong(form: typeof this.startForm | typeof this.pastWorkoutForm): boolean {
    return form.controls.customName.touched && form.controls.customName.hasError('maxlength');
  }

  private buildGoal(): LiveTrackerGoal | null {
    if (this.startMode() !== 'GOAL') {
      return null;
    }
    const raw = this.startForm.getRawValue();
    if (raw.goalType === 'CALORIES') {
      return { type: 'CALORIES', target: raw.targetCalories };
    }
    return { type: 'MINUTES', target: raw.targetMinutes };
  }

  private resolveSessionName(value: SessionNameValue): string {
    return value.name === CUSTOM_NAME ? value.customName.trim() : value.name;
  }
}

function customNameRequiredValidator(control: AbstractControl): ValidationErrors | null {
  const name = control.get('name')?.value;
  const customName = String(control.get('customName')?.value ?? '').trim();
  return name === CUSTOM_NAME && !customName ? { customNameRequired: true } : null;
}
