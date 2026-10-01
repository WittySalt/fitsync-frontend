import { Component, Injector, OnInit, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';
import { DiaryDayComponent } from './diary/diary-day.component';
import { DiaryWeekComponent } from './diary/diary-week.component';
import { LOADING, Load, RangeDay } from './diary/diary.models';
import { whole } from './diary/diary-figures';
import { dayLabel, toIsoDate, weekOf } from './diary/diary-time';
import { NutritionDiaryService } from './diary/nutrition-diary.service';
import { MealBuilderComponent } from './meal-builder.component';

/** The meal types a deep link may preselect in the meal builder. */
const LINKABLE_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

/**
 * The Nutrition page: a head like the Workout page's (title, date and target, the coach reading, a
 * week card), then the Diary. Recipes and Insights will join the Diary as tabs when they are built.
 * The meal builder opens from a meal's Add, or from a link that names a meal type.
 */
@Component({
  selector: 'app-nutrition-page',
  imports: [InsightPanelComponent, DiaryWeekComponent, DiaryDayComponent, MealBuilderComponent],
  templateUrl: './nutrition.page.html',
  styleUrl: './nutrition.page.scss'
})
export class NutritionPage implements OnInit {
  private readonly diary = inject(NutritionDiaryService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly builder = viewChild(MealBuilderComponent);
  // The meal type a link or an Add button asked for, held until the builder exists to take it.
  private pendingMealType: string | null = null;

  readonly today = toIsoDate(new Date());
  readonly dates = weekOf(this.today);

  /** The tabs of the page. The bar shows only when there is more than the Diary to switch to. */
  readonly tabs = signal<readonly string[]>(['diary']);
  readonly view = signal<'diary' | 'log'>('diary');
  readonly selectedDate = signal(this.today);
  readonly range = signal<Load<RangeDay[]>>(LOADING);
  /** Raised to make the Diary reload, for example after a meal was saved. */
  readonly refresh = signal(0);

  readonly days = computed(() => {
    const state = this.range();
    return state.status === 'ready' ? state.data : [];
  });

  readonly targetCalories = computed(() => this.days().find((day) => day.targetCalories !== null)?.targetCalories ?? null);

  readonly headLine = computed(() => {
    const target = this.targetCalories();
    return target !== null ? `${dayLabel(this.today)} · ${whole(target)} kcal a day` : dayLabel(this.today);
  });

  constructor() {
    // The link is read once. Only a known meal type opens the builder; anything else is ignored.
    const requested = (this.route.snapshot.queryParamMap.get('log') ?? '').toUpperCase();
    if (LINKABLE_MEAL_TYPES.includes(requested)) {
      this.pendingMealType = requested;
      this.view.set('log');
    }
    effect(() => {
      const builder = this.builder();
      if (builder && this.pendingMealType !== null) {
        const mealType = this.pendingMealType;
        this.pendingMealType = null;
        // Set after the builder has rendered, so the form does not change under a view that was already checked.
        untracked(() => afterNextRender(() => builder.setMealType(mealType), { injector: this.injector }));
      }
    });
  }

  ngOnInit(): void {
    this.loadRange();
  }

  loadRange(): void {
    this.range.set(LOADING);
    this.diary.getRange(this.dates[0], this.dates[this.dates.length - 1]).subscribe({
      next: (days) => this.range.set({ status: 'ready', data: days }),
      error: () => this.range.set({ status: 'error', message: 'The week could not load. Please retry.' })
    });
  }

  /** The week card reloads quietly after a change, so the tiles do not flash. */
  refreshRange(): void {
    this.diary.getRange(this.dates[0], this.dates[this.dates.length - 1]).subscribe({
      next: (days) => this.range.set({ status: 'ready', data: days }),
      error: () => undefined
    });
  }

  showDay(date: string): void {
    this.selectedDate.set(date);
    this.view.set('diary');
  }

  startLog(mealType: string): void {
    this.pendingMealType = LINKABLE_MEAL_TYPES.includes(mealType) ? mealType : null;
    this.view.set('log');
  }

  backToDiary(): void {
    this.view.set('diary');
  }

  refreshAfterMealSave(): void {
    this.selectedDate.set(this.today);
    this.view.set('diary');
    this.refresh.update((value) => value + 1);
    this.refreshRange();
  }
}
