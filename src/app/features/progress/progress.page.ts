import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
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
import { UserTimezoneService } from '../../core/user-timezone.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { shortDateLabel } from '../../shared/date-label';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { BodyPage } from '../body/body.page';
import { ActivityHeatmapComponent } from './activity-heatmap.component';
import { AnalyticsComparisonCardComponent } from './analytics-comparison-card.component';
import { AnalyticsTrendChartsComponent } from './analytics-trend-charts.component';
import { EnergyCardComponent } from './energy/energy-card.component';
import { GoalOverlay, NO_OVERLAY, applyOverlay, isPending, settle } from './goal-overlay';
import { DEFAULT_RANGE_DAYS, DateRange, rangeForDays, sameRange } from './progress-range';
import { ProgressRangeComponent } from './progress-range.component';
import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';

interface GoalOption {
  value: string;
  label: string;
}

type ProgressTab = 'overview' | 'body' | 'goals';

/** How long to wait before asking the progress service again for a goal that was just saved, and
 *  how many times to ask. The service learns of a change from an event, so it can be a moment late. */
const GOAL_REFRESH_DELAY_MS = 1500;
const GOAL_REFRESH_TRIES = 3;
const DAY_MS = 86_400_000;

@Component({
  selector: 'app-progress-page',
  imports: [
    ConfirmDialogComponent,
    InsightPanelComponent,
    ActivityHeatmapComponent,
    AnalyticsComparisonCardComponent,
    AnalyticsTrendChartsComponent,
    BodyPage,
    EnergyCardComponent,
    NgTemplateOutlet,
    ProgressRangeComponent,
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
  private readonly injector = inject(Injector);
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly editor = viewChild<ElementRef<HTMLFormElement>>('goalEditor');

  readonly selectedTab = signal<ProgressTab>('overview');
  readonly accountData = signal<AccountCenterData | null>(null);
  readonly goals = signal<Goal[]>([]);
  /** Goals just saved or deleted, laid over the list until the progress service has caught up. */
  private readonly overlay = signal<GoalOverlay>(NO_OVERLAY);
  readonly shownGoals = computed(() => applyOverlay(this.goals(), this.overlay()));
  readonly activeGoals = computed(() => this.shownGoals().filter((goal) => goal.status === 'ACTIVE'));
  readonly inactiveGoals = computed(() => this.shownGoals().filter((goal) => goal.status !== 'ACTIVE'));
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingGoal = signal(false);
  readonly goalSaveError = signal<string | null>(null);
  readonly editingGoalType = signal<GoalType | null>(null);
  readonly confirmingDelete = signal<GoalType | null>(null);
  readonly deletingGoal = signal(false);
  readonly hasGoals = computed(() => this.shownGoals().length > 0);

  // One range for the Overview tab. A preset is a number of days back from today in the profile's
  // zone; a custom range is two dates picked under "More".
  private readonly rangeChoice = signal<{ days: number } | { custom: DateRange }>({ days: DEFAULT_RANGE_DAYS });
  private readonly userTimezone = inject(UserTimezoneService);
  readonly activeDays = computed(() => {
    const choice = this.rangeChoice();
    return 'days' in choice ? choice.days : null;
  });
  readonly range = computed<DateRange>(
    () => {
      const choice = this.rangeChoice();
      return 'days' in choice ? rangeForDays(choice.days, this.userTimezone.dateKey()) : choice.custom;
    },
    { equal: sameRange }
  );

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

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.refreshTimer));
  }

  ngOnInit(): void {
    this.initSelectedTab();
    this.load();
  }

  selectTab(tab: ProgressTab): void {
    this.selectedTab.set(tab);
  }

  choosePreset(days: number): void {
    this.rangeChoice.set({ days });
  }

  chooseCustomRange(range: DateRange): void {
    this.rangeChoice.set({ custom: range });
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
        this.overlay.update((overlay) => settle(goals, overlay));
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
    // The editor opens below the list, so the focus goes to it, and the page scrolls with it.
    afterNextRender(() => this.editor()?.nativeElement.querySelector<HTMLElement>('select, input')?.focus(), { injector: this.injector });
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
        // The progress service learns of the change from an event, so its list can still hold the
        // old value. What was saved is shown until the list agrees with it.
        this.overlay.update((overlay) => ({
          saved: [...overlay.saved.filter((saved) => saved.goalType !== goal.goalType), this.savedAsGoal(goal)],
          removed: new Set([...overlay.removed].filter((type) => type !== goal.goalType))
        }));
        this.savingGoal.set(false);
        this.editingGoalType.set(null);
        this.toast.success('Goal updated.');
        this.refreshAfterGoalChange();
      },
      error: (error: Error) => {
        const message = error.message || 'Unable to save goal.';
        this.savingGoal.set(false);
        this.goalSaveError.set(message);
        this.toast.error(message);
      }
    });
  }

  askDeleteGoal(goalType: string): void {
    this.confirmingDelete.set(goalType as GoalType);
  }

  cancelDeleteGoal(): void {
    if (!this.deletingGoal()) {
      this.confirmingDelete.set(null);
    }
  }

  confirmDeleteGoal(): void {
    const goalType = this.confirmingDelete();
    if (!goalType || this.deletingGoal()) {
      return;
    }
    this.deletingGoal.set(true);
    this.accountDataService.deleteGoal(goalType).subscribe({
      next: () => {
        // The server only marks the goal as deleted, and the progress list drops it a moment
        // later, so it is taken off the page now and kept off until the list agrees.
        this.overlay.update((overlay) => ({
          saved: overlay.saved.filter((saved) => saved.goalType !== goalType),
          removed: new Set([...overlay.removed, goalType])
        }));
        this.accountData.update((data) =>
          data ? { ...data, user: { ...data.user, activeGoals: data.user.activeGoals.filter((goal) => goal.goalType !== goalType) } } : data
        );
        if (this.editingGoalType() === goalType) {
          this.cancelGoalEdit();
        }
        this.deletingGoal.set(false);
        this.confirmingDelete.set(null);
        this.toast.success('Goal deleted.');
        this.refreshAfterGoalChange();
      },
      error: () => {
        this.deletingGoal.set(false);
        this.confirmingDelete.set(null);
        this.toast.error('Unable to delete goal. Please retry.');
      }
    });
  }

  goalProgress(goal: Goal): number {
    return Math.round(Math.min(Math.max(goal.progressRatio, 0), 1) * 100);
  }

  goalLabel(goal: { goalType: string }): string {
    return goal.goalType
      .toLowerCase()
      .split('_')
      .map((part: string) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  goalStatus(goal: Goal): string {
    if (goal.status === 'PAUSED') {
      return 'Paused';
    }
    if (goal.status === 'COMPLETED') {
      return 'Completed';
    }
    const status = goal.onTrack === false ? 'Needs attention' : 'On track';
    return goal.daysRemaining == null ? status : `${status} · ${goal.daysRemaining} days left`;
  }

  goalDate(goal: Goal): string {
    return shortDateLabel(goal.targetDate) || 'No target date';
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

  /** A saved goal in the shape of the progress list, with the progress it had before the change. */
  private savedAsGoal(saved: UserGoal): Goal {
    const before = this.goals().find((goal) => goal.goalType === saved.goalType);
    const today = this.userTimezone.dateKey();
    return {
      goalId: saved.goalId,
      goalType: saved.goalType,
      targetValue: saved.targetValue ?? 0,
      targetUnit: saved.targetUnit ?? '',
      targetDate: saved.targetDate ?? '',
      status: saved.status,
      progressRatio: before?.progressRatio ?? 0,
      onTrack: before?.onTrack ?? null,
      expired: before?.expired ?? null,
      currentValue: before?.currentValue ?? null,
      daysRemaining: saved.targetDate ? Math.round((Date.parse(saved.targetDate) - Date.parse(today)) / DAY_MS) : null,
      lastEvaluatedAt: before?.lastEvaluatedAt ?? null
    };
  }

  private refreshAfterGoalChange(): void {
    this.loadAccountData();
    this.refreshGoals(GOAL_REFRESH_TRIES);
  }

  // Reads the goals again without the loading state, and again after a short wait while the list
  // still disagrees with what was saved. A failed read leaves the saved values on the page.
  private refreshGoals(retriesLeft: number): void {
    clearTimeout(this.refreshTimer);
    this.dataService.getProgressGoals().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.overlay.update((overlay) => settle(goals, overlay));
        if (isPending(this.overlay()) && retriesLeft > 0) {
          this.refreshTimer = setTimeout(() => this.refreshGoals(retriesLeft - 1), GOAL_REFRESH_DELAY_MS);
        }
      }
    });
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
