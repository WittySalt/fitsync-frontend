import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { FitSyncDataService } from '../../core/fitsync-data.service';

@Component({
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss'
})
export class OnboardingPage {
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(FitSyncDataService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    heightCm: [165, [Validators.required, Validators.min(80), Validators.max(240)]],
    weightKg: [72, [Validators.required, Validators.min(20), Validators.max(350)]],
    goalType: ['WEIGHT', Validators.required],
    targetValue: [68, [Validators.required, Validators.min(1)]],
    weeklyWorkoutDays: [4, [Validators.required, Validators.min(1), Validators.max(7)]],
    dietaryPattern: ['NONE', Validators.required],
    calorieTrackingMode: ['FLEXIBLE', Validators.required],
    workoutReminderEnabled: [true],
    mealReminderEnabled: [true]
  });

  submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.error.set('Please fix the highlighted fields before continuing.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.dataService.saveOnboarding(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: Error) => {
        this.error.set(error.message || 'Unable to save onboarding data. Please check the backend connection.');
        this.submitting.set(false);
      }
    });
  }
}
