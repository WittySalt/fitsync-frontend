import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, OnInit, output, signal, untracked, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer } from 'rxjs';

import { FitSyncDataService, HomeDashboardData } from '../../../core/fitsync-data.service';
import { DayMeal, NutritionSummary, UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { BRIEF_NOW } from '../brief/brief-time';
import { TodayBodyComponent } from './today-body.component';
import { TodayFoodComponent, UsualMealLog } from './today-food.component';
import { TodayGoalsComponent } from './today-goals.component';
import { defaultTodayTab, localDateKey, readRememberedTab, rememberTab, TODAY_TABS, TodayTab, tabIndexForKey } from './today-tab';

/** A horizontal drag of at least this many pixels moves to the neighbouring tab. */
const SWIPE_THRESHOLD_PX = 48;
/** A drag counts as horizontal only when it runs this many times farther across than down. */
const SWIPE_HORIZONTAL_RATIO = 2;

type MealsState = 'loading' | 'ready' | 'failed';

@Component({
  selector: 'app-today-card',
  imports: [TodayBodyComponent, TodayFoodComponent, TodayGoalsComponent],
  templateUrl: './today-card.component.html',
  styleUrl: './today-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayCardComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clock = inject(BRIEF_NOW);
  private readonly toast = inject(ToastService);

  /** The dashboard snapshot, or null while it loads or when it failed. */
  readonly dashboard = input<HomeDashboardData | null>(null);
  /** Today's nutrition summary, or null while it loads or when it failed. */
  readonly nutrition = input<NutritionSummary | null>(null);
  readonly loading = input(false);
  readonly dashboardFailed = input(false);
  readonly nutritionFailed = input(false);
  readonly retryDashboard = output<void>();
  readonly retryNutrition = output<void>();

  readonly tabs = TODAY_TABS;
  readonly now = signal(this.clock());

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly meals = signal<DayMeal[]>([]);
  readonly mealsState = signal<MealsState>('loading');
  readonly usualMeals = signal<UsualMeal[]>([]);
  /** True while a copy of a usual meal is being saved. */
  readonly logging = signal(false);
  // A tab picked earlier today wins over the rule, so it is read before anything is decided.
  private readonly picked = signal<TodayTab | null>(readRememberedTab(this.clock()));
  private readonly decided = signal<TodayTab | null>(null);
  private swipeStart: { x: number; y: number } | null = null;

  readonly activeTab = computed<TodayTab>(() => this.picked() ?? this.decided() ?? 'food');
  readonly foodMeals = this.meals.asReadonly();
  readonly foodLoading = computed(
    () => this.mealsState() === 'loading' || (this.nutrition() === null && !this.nutritionFailed())
  );
  readonly foodFailed = computed(() => this.mealsState() === 'failed' || this.nutritionFailed());
  readonly dashboardLoading = computed(() => this.loading() || (this.dashboard() === null && !this.dashboardFailed()));

  constructor() {
    // The opening tab is worked out once, when the dashboard and the day's meals have both
    // arrived. It is never revisited, so the card cannot turn a page the person is reading.
    effect(() => {
      const dashboard = this.dashboard();
      const mealsState = this.mealsState();
      if (dashboard === null || mealsState === 'loading' || untracked(() => this.decided() !== null)) {
        return;
      }
      const metric = dashboard.latestBodyMetric;
      const hasWeight = metric != null && metric.weightKg > 0;
      const now = untracked(() => this.now());
      this.decided.set(
        defaultTodayTab({
          // A weight with no date is treated as taken today, so it never makes the card open on Body.
          latestWeightOn: hasWeight ? (metric.measuredAt ?? localDateKey(now)) : null,
          mealsLoggedToday: untracked(() => this.meals().length),
          now
        })
      );
    });
  }

  ngOnInit(): void {
    this.loadMeals();
    this.loadUsualMeals();
  }

  loadMeals(): void {
    this.mealsState.set('loading');
    this.dataService
      .getMealsForDay(this.now())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => {
          this.meals.set(meals);
          this.mealsState.set('ready');
        },
        error: () => this.mealsState.set('failed')
      });
  }

  // The usual meals only add suggestions, so a failure leaves the card as it is without them.
  private loadUsualMeals(): void {
    // The call is deferred so that any failure, even one thrown before a request exists, is caught.
    defer(() => this.dataService.getUsualMeals())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => this.usualMeals.set(meals),
        error: () => this.usualMeals.set([])
      });
  }

  logUsual(request: UsualMealLog): void {
    if (this.logging()) {
      return;
    }
    this.logging.set(true);
    this.dataService
      .copyMeal(request.mealId, request.mealType, (request.consumedAt ?? this.clock()).toISOString())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logging.set(false);
          this.refreshAfterLogging();
        },
        error: () => {
          this.logging.set(false);
          this.toast.error('Unable to log the meal. Please retry.');
        }
      });
  }

  // The meals are read again without the loading state, so the slot the person is looking at stays
  // on screen, and the budget is asked for again through the page.
  private refreshAfterLogging(): void {
    this.now.set(this.clock());
    this.dataService
      .getMealsForDay(this.now())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => this.meals.set(meals),
        error: () => this.toast.error('The meal was logged, but today could not be refreshed.')
      });
    this.retryNutrition.emit();
  }

  retryFood(): void {
    if (this.mealsState() === 'failed') {
      this.loadMeals();
    }
    if (this.nutritionFailed()) {
      this.retryNutrition.emit();
    }
  }

  select(tab: TodayTab): void {
    this.picked.set(tab);
    rememberTab(this.clock(), tab);
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    const target = tabIndexForKey(event.key, index, this.tabs.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.select(this.tabs[target].key);
    this.tabButtons()[target]?.nativeElement.focus();
  }

  onPointerDown(event: PointerEvent): void {
    this.swipeStart = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  }

  onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (start === null) {
      return;
    }
    const across = event.clientX - start.x;
    const down = event.clientY - start.y;
    if (Math.abs(across) < SWIPE_THRESHOLD_PX || Math.abs(across) < Math.abs(down) * SWIPE_HORIZONTAL_RATIO) {
      return;
    }
    const index = this.tabs.findIndex((tab) => tab.key === this.activeTab());
    const neighbour = this.tabs[index + (across < 0 ? 1 : -1)];
    if (neighbour) {
      this.select(neighbour.key);
    }
  }

  onPointerCancel(): void {
    this.swipeStart = null;
  }
}
