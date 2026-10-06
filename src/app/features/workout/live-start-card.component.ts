import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { SportActivityOption, WorkoutSessionFormValue } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { LiveTrackerGoal, LiveTrackerStartEvent } from './live-tracker.models';
import { freeTimerSegments } from './segments/segment-timer';
import { WorkoutLiveService } from './workout-live.service';

type StartMode = 'FREE' | 'GOAL';
type GoalType = 'MINUTES' | 'CALORIES';

const CUSTOM_NAME = 'Custom…';
const SPORTS_TYPE = 'SPORTS';
const DISTANCE_MEASURE = 'TIME_AND_DISTANCE';
type SessionNameValue = { name: string; customName: string };

@Component({
  selector: 'app-live-start-card',
  imports: [ReactiveFormsModule],
  templateUrl: './live-start-card.component.html',
  styleUrl: './live-start-card.component.scss',
  host: { '(document:keydown.escape)': 'closeSheets()' }
})
export class LiveStartCardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  private readonly workoutLive = inject(WorkoutLiveService);

  @Output() started = new EventEmitter<LiveTrackerStartEvent>();
  @Output() backfilled = new EventEmitter<void>();

  readonly startMode = signal<StartMode>('FREE');
  readonly freeOpen = signal(false);
  readonly pastWorkoutOpen = signal(false);
  readonly starting = signal(false);
  readonly savingPastWorkout = signal(false);

  readonly workoutTypes = ['STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY', 'CUSTOM'];
  // The live tracker cannot start a sport session, so only the past workout form offers the type.
  readonly pastWorkoutTypes = ['STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY', SPORTS_TYPE, 'CUSTOM'];
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
      notes: ['', Validators.maxLength(300)],
      sportActivity: [''],
      distanceKm: [null as number | null, [Validators.min(0), Validators.max(1000)]]
    },
    { validators: pastWorkoutValidator }
  );

  readonly sportActivities = signal<SportActivityOption[]>([]);
  readonly sportsLoadFailed = signal(false);
  private sportsRequested = false;

  // Reactive form values are not signals, so the fields that decide what the form shows are mirrored.
  private readonly pastType = toSignal(this.pastWorkoutForm.controls.workoutType.valueChanges, {
    initialValue: this.pastWorkoutForm.controls.workoutType.value
  });
  private readonly pastSportCode = toSignal(this.pastWorkoutForm.controls.sportActivity.valueChanges, {
    initialValue: this.pastWorkoutForm.controls.sportActivity.value
  });

  readonly isSportSession = computed(() => this.pastType() === SPORTS_TYPE);
  readonly chosenSport = computed(() => this.sportActivities().find((sport) => sport.code === this.pastSportCode()) ?? null);
  readonly showDistance = computed(
    () => this.pastType() === 'CARDIO' || (this.isSportSession() && this.chosenSport()?.measure === DISTANCE_MEASURE)
  );

  constructor() {
    this.pastWorkoutForm.controls.workoutType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      if (type === SPORTS_TYPE) {
        this.loadSports();
      }
      this.clearHiddenDistance();
    });
    this.pastWorkoutForm.controls.sportActivity.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.clearHiddenDistance());
  }

  selectMode(mode: StartMode): void {
    this.startMode.set(mode);
  }

  /** The free workout sheet asks for the name and the type; the Workout page itself does not. */
  openFree(): void {
    this.pastWorkoutOpen.set(false);
    this.freeOpen.set(true);
  }

  togglePastWorkout(): void {
    this.freeOpen.set(false);
    this.pastWorkoutOpen.update((open) => !open);
  }

  /** The Today card's foot link: opens the form, and leaves it open when pressed twice. */
  openPastWorkout(): void {
    this.freeOpen.set(false);
    this.pastWorkoutOpen.set(true);
  }

  closeSheets(): void {
    this.freeOpen.set(false);
    this.pastWorkoutOpen.set(false);
  }

  startWorkout(): void {
    this.startForm.markAllAsTouched();
    if (this.startForm.invalid || this.starting()) {
      return;
    }

    this.starting.set(true);
    const raw = this.startForm.getRawValue();
    const goal = this.buildGoal();
    const segments = freeTimerSegments(raw.workoutType, goal?.type === 'MINUTES' ? goal.target : null);
    this.workoutLive.startAdHoc({
      name: this.resolveSessionName(raw),
      workoutType: raw.workoutType,
      ...(segments.length ? { segments } : {})
    })
      .pipe(finalize(() => this.starting.set(false)))
      .subscribe({
        next: (session) => {
          this.freeOpen.set(false);
          this.toast.success('Workout started.');
          this.started.emit({ session, goal });
        },
        error: () => this.toast.error('Unable to start a workout. Please retry.')
      });
  }

  savePastWorkout(): void {
    this.pastWorkoutForm.markAllAsTouched();
    if (this.isSportSession() && this.sportsLoadFailed()) {
      this.toast.error('Sports could not be loaded. Try again in a moment.');
      return;
    }
    if (this.pastWorkoutForm.invalid || this.savingPastWorkout()) {
      return;
    }
    // A preselected sport is only known by its code until the list has arrived.
    if (this.isSportSession() && !this.chosenSport()) {
      this.toast.error('Sports are still loading. Try again in a moment.');
      return;
    }

    this.savingPastWorkout.set(true);
    this.dataService.saveWorkoutSession(this.buildPastWorkout())
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
            notes: '',
            sportActivity: '',
            distanceKm: null
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

  sportInvalid(): boolean {
    return this.pastWorkoutForm.controls.sportActivity.touched && this.pastWorkoutForm.hasError('sportRequired');
  }

  distanceInvalid(): boolean {
    const control = this.pastWorkoutForm.controls.distanceKm;
    return control.touched && (control.hasError('min') || control.hasError('max'));
  }

  typeLabel(type: string): string {
    return type === SPORTS_TYPE ? 'Sport' : this.formatLabel(type);
  }

  private loadSports(): void {
    if (this.sportsRequested && !this.sportsLoadFailed()) {
      return;
    }
    this.sportsRequested = true;
    this.sportsLoadFailed.set(false);
    this.dataService.getExerciseMetadata().subscribe((metadata) => {
      const sports = metadata?.sportActivities ?? [];
      this.sportActivities.set(sports);
      const code = this.pastWorkoutForm.controls.sportActivity.value;
      if (code && !sports.some((sport) => sport.code === code)) {
        this.pastWorkoutForm.controls.sportActivity.setValue('');
      }
      this.sportsLoadFailed.set(sports.length === 0);
      this.clearHiddenDistance();
    });
  }

  private clearHiddenDistance(): void {
    const distance = this.pastWorkoutForm.controls.distanceKm;
    if (!this.showDistance() && distance.value !== null) {
      distance.setValue(null);
    }
  }

  private buildPastWorkout(): WorkoutSessionFormValue {
    const raw = this.pastWorkoutForm.getRawValue();
    const sport = this.isSportSession() ? this.chosenSport() : null;
    const request: WorkoutSessionFormValue = {
      name: sport ? sport.label : this.resolveSessionName(raw),
      workoutType: raw.workoutType,
      durationMinutes: raw.durationMinutes,
      caloriesBurned: raw.caloriesBurned,
      perceivedExertion: raw.perceivedExertion,
      notes: raw.notes
    };
    if (sport) {
      request.sportActivity = sport.code;
    }
    if (this.showDistance() && raw.distanceKm !== null) {
      request.distanceKm = Math.round(raw.distanceKm * 100) / 100;
    }
    return request;
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

// A sport session is named after its sport, so the name controls only matter for the other types.
function pastWorkoutValidator(control: AbstractControl): ValidationErrors | null {
  if (control.get('workoutType')?.value === SPORTS_TYPE) {
    return control.get('sportActivity')?.value ? null : { sportRequired: true };
  }
  return customNameRequiredValidator(control);
}
