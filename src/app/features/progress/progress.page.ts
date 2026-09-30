import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  AccountCenterData,
  AccountDataService,
  GoalStatus,
  GoalType,
  UpsertUserGoalRequest,
  UserGoal
} from '../../core/account-data.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { BodyPage } from '../body/body.page';
import { ActivityHeatmapComponent } from './activity-heatmap.component';
import { AnalyticsComparisonCardComponent } from './analytics-comparison-card.component';
import { AnalyticsTrendChartsComponent } from './analytics-trend-charts.component';
import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';

interface GoalOption {
  value: string;
  label: string;
}

type ProgressTab = 'overview' | 'body' | 'goals';

@Component({
  selector: 'app-progress-page',
  imports: [
    InsightPanelComponent,
    ActivityHeatmapComponent,
    AnalyticsComparisonCardComponent,
    AnalyticsTrendChartsComponent,
    BodyPage,
    ReactiveFormsModule,
    StatePanelComponent
  ],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss'
})
export class ProgressPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly accountDataService = inject(AccountDataService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly selectedTab = signal<ProgressTab>('overview');
  readonly accountData = signal<AccountCenterData | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingGoal = signal(false);
  readonly goalSaveError = signal<string | null>(null);
  readonly editingGoalType = signal<GoalType | null>(null);
  readonly hasGoals = computed(() => this.goals().length > 0);
  readonly goalTypeOptions = this.options([
    ['WEIGHT', 'Weight'],
    ['CALORIES', 'Calories'],
    ['PROTEIN', 'Protein'],
    ['CARBS', 'Carbs'],
    ['FAT', 'Fat'],
    ['WORKOUT_FREQUENCY', 'Workout frequency'],
    ['STEPS', 'Steps']
  ]);
  readonly goalStatusOptions = this.options([
    ['ACTIVE', 'Active'],
    ['PAUSED', 'Paused'],
    ['COMPLETED', 'Completed'],
    ['CANCELLED', 'Cancelled']
  ]);
  readonly goalForm = this.fb.group({
    goalType: ['WEIGHT'],
    targetValue: ['', [Validators.min(0)]],
    targetUnit: ['', [Validators.maxLength(20)]],
    targetDate: [''],
    status: ['ACTIVE'],
    notes: ['', [Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.initSelectedTab();
    this.load();
  }

  selectTab(tab: ProgressTab): void {
    this.selectedTab.set(tab);
  }

  private initSelectedTab(): void {
    // `/body` is kept as a backward-compatible alias that opens the Body tab.
    if (this.router.url.split('?')[0] === '/body') {
      this.selectedTab.set('body');
      return;
    }
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'overview' || tab === 'body' || tab === 'goals') {
      this.selectedTab.set(tab);
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.loadAccountData();
    this.loadProgressGoals();
  }

  loadProgressGoals(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dataService.getProgressGoals().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });
  }

  private loadAccountData(): void {
    this.accountDataService.getAccountCenter().subscribe({
      next: (accountData) => {
        this.accountData.set(accountData);
      },
      error: (error: Error) => {
        this.goalSaveError.set(error.message);
      }
    });
  }

  activeGoal(goalType: string): UserGoal | undefined {
    return this.accountData()?.user.activeGoals.find((goal) => goal.goalType === goalType);
  }

  startGoalCreate(): void {
    this.startGoalEdit('WEIGHT');
  }

  startGoalEdit(goalType: string): void {
    const typedGoalType = goalType as GoalType;
    const goal = this.activeGoal(typedGoalType);
    this.goalForm.patchValue({
      goalType: typedGoalType,
      targetValue: toFormNumber(goal?.targetValue),
      targetUnit: goal?.targetUnit ?? this.defaultGoalUnit(typedGoalType),
      targetDate: goal?.targetDate ?? '',
      status: goal?.status ?? 'ACTIVE',
      notes: goal?.notes ?? ''
    });
    this.goalSaveError.set(null);
    this.editingGoalType.set(typedGoalType);
  }

  cancelGoalEdit(): void {
    this.goalForm.reset({
      goalType: 'WEIGHT',
      targetValue: '',
      targetUnit: this.defaultGoalUnit('WEIGHT'),
      targetDate: '',
      status: 'ACTIVE',
      notes: ''
    });
    this.goalSaveError.set(null);
    this.editingGoalType.set(null);
  }

  saveGoal(): void {
    if (this.goalForm.invalid) {
      this.goalForm.markAllAsTouched();
      return;
    }

    const value = this.goalForm.getRawValue();
    const goalType = value.goalType as GoalType;
    const request: UpsertUserGoalRequest = {
      targetValue: toNullableNumber(value.targetValue),
      targetUnit: nullableText(value.targetUnit),
      targetDate: nullableText(value.targetDate),
      status: value.status as GoalStatus,
      notes: nullableText(value.notes)
    };

    this.savingGoal.set(true);
    this.goalSaveError.set(null);
    this.accountDataService.updateGoal(goalType, request).subscribe({
      next: (goal) => {
        this.accountData.update((data) => {
          if (!data) {
            return data;
          }
          const activeGoals = [...data.user.activeGoals.filter((current) => current.goalType !== goal.goalType), goal]
            .sort((left, right) => left.goalType.localeCompare(right.goalType));
          return { ...data, user: { ...data.user, activeGoals } };
        });
        this.savingGoal.set(false);
        this.editingGoalType.set(null);
        this.toast.success('Goal updated.');
        this.refreshAfterGoalSave();
      },
      error: (error: Error) => {
        const message = error.message || 'Unable to save goal.';
        this.savingGoal.set(false);
        this.goalSaveError.set(message);
        this.toast.error(message);
      }
    });
  }

  goalProgress(goal: Goal): number {
    return Math.round(Math.min(Math.max(goal.progressRatio, 0), 1) * 100);
  }

  goalLabel(goal: Goal): string {
    return goal.goalType
      .toLowerCase()
      .split('_')
      .map((part: string) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  goalStatus(goal: Goal): string {
    const status = goal.onTrack === false ? 'Needs attention' : 'On track';
    return goal.daysRemaining == null ? status : `${status} - ${goal.daysRemaining} days left`;
  }

  formatGoalValue(goal: Goal): string {
    const suffix = goal.targetUnit ? ` ${goal.targetUnit}` : '';
    return `${this.formatNumber(goal.targetValue)}${suffix}`;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-SG', {
      maximumFractionDigits: 1
    }).format(value);
  }

  private refreshAfterGoalSave(): void {
    this.loadAccountData();
    this.loadProgressGoals();
  }

  private defaultGoalUnit(goalType: GoalType): string {
    const units: Record<GoalType, string> = {
      WEIGHT: this.accountData()?.user.preferences.app.preferredUnits === '100002' ? 'lb' : 'kg',
      CALORIES: 'kcal',
      PROTEIN: 'g',
      CARBS: 'g',
      FAT: 'g',
      WORKOUT_FREQUENCY: 'sessions/week',
      STEPS: 'steps'
    };
    return units[goalType];
  }

  private options(entries: string[][]): GoalOption[] {
    return entries.map(([value, label]) => ({ value, label }));
  }
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

function toFormNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
