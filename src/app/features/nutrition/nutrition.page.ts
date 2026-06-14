import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodSearchResult } from '../../core/fitsync.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-nutrition-page',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './nutrition.page.html',
  styleUrl: './nutrition.page.scss'
})
export class NutritionPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);

  readonly foods = signal<FoodSearchResult[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly saveMessage = this.dataService.lastSavedMessage;

  readonly mealForm = this.fb.nonNullable.group({
    mealType: ['LUNCH', Validators.required],
    foodName: ['', [Validators.required, Validators.maxLength(120)]],
    calories: [420, [Validators.required, Validators.min(0)]],
    proteinGrams: [32, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    this.dataService.getFoods().subscribe((foods) => {
      this.foods.set(foods);
      this.loading.set(false);
    });
  }

  saveMeal(): void {
    this.mealForm.markAllAsTouched();

    if (this.mealForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.dataService.saveMeal(this.mealForm.getRawValue()).subscribe({
      next: () => this.submitting.set(false),
      error: () => {
        this.dataService.lastSavedMessage.set('Unable to save meal. Check authentication and backend availability.');
        this.submitting.set(false);
      }
    });
  }
}
