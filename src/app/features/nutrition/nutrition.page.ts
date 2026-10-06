import { Component, Injector, OnInit, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SpotlightDirective } from '../../core/guide/spotlight.directive';
import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';
import { DiaryDayComponent } from './diary/diary-day.component';
import { DiaryWeekComponent } from './diary/diary-week.component';
import { AddRequest, LOADING, Load, RangeDay } from './diary/diary.models';
import { whole } from './diary/diary-figures';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { dayLabel, weekOf } from './diary/diary-time';
import { NutritionDiaryService } from './diary/nutrition-diary.service';
import { MealBuilderComponent } from './meal-builder.component';
import { RecipeSection, RecipesTabComponent } from './recipes/recipes-tab.component';

/** The meal types a deep link may preselect in the meal builder. */
const LINKABLE_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

/**
 * The Nutrition page: a head like the Workout page's (title, date and target, the coach reading, a
 * week card), then the Diary, with Recipes as a second tab. Insights will join them when it is built.
 * The meal builder opens from a meal's Add, or from a link that names a meal type.
 */
@Component({
  selector: 'app-nutrition-page',
  imports: [SpotlightDirective, InsightPanelComponent, DiaryWeekComponent, DiaryDayComponent, MealBuilderComponent, RecipesTabComponent],
  templateUrl: './nutrition.page.html',
  styleUrl: './nutrition.page.scss'
})
export class NutritionPage implements OnInit {
  private readonly diary = inject(NutritionDiaryService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly userTimezone = inject(UserTimezoneService);
  private readonly builder = viewChild(MealBuilderComponent);
  // The meal type a link or an Add button asked for, held until the builder exists to take it.
  private pendingMealType: string | null = null;
  private pendingQuickAdd = false;

  readonly today = this.userTimezone.dateKey();
  readonly dates = weekOf(this.today);

  readonly tab = signal<'diary' | 'recipes'>('diary');
  /** The Recipes section to open on, from a link, and the meal being picked for, from a meal's Add menu. */
  readonly recipeSection = signal<RecipeSection>('library');
  readonly logTo = signal<string | null>(null);
  readonly view = signal<'diary' | 'log'>('diary');
  readonly selectedDate = signal(this.today);
  readonly range = signal<Load<RangeDay[]>>(LOADING);
  /** Raised to make the Diary reload, for example after a meal was saved. */
  readonly refresh = signal(0);

  /** Whether any day of the week has a meal, for the words of the spotlight. */
  readonly anyLogged = computed(() => this.days().some((day) => day.logged));
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
    const query = this.route.snapshot.queryParamMap;
    const requested = (query.get('log') ?? '').toUpperCase();
    const section = query.get('section');
    if (query.get('tab') === 'recipes') {
      this.tab.set('recipes');
      this.recipeSection.set(section === 'mine' || section === 'saved' ? section : 'library');
    }
    const logTo = (query.get('logTo') ?? '').toUpperCase();
    this.logTo.set(LINKABLE_MEAL_TYPES.includes(logTo) ? logTo : null);
    if (LINKABLE_MEAL_TYPES.includes(requested)) {
      this.pendingMealType = requested;
      this.view.set('log');
    }
    effect(() => {
      const builder = this.builder();
      if (builder && this.pendingMealType !== null) {
        const mealType = this.pendingMealType;
        this.pendingMealType = null;
        const quick = this.pendingQuickAdd;
        this.pendingQuickAdd = false;
        // Set after the builder has rendered, so the form does not change under a view that was already checked.
        untracked(() =>
          afterNextRender(
            () => {
              builder.setMealType(mealType);
              if (quick) {
                builder.openQuickAdd(mealType);
              }
            },
            { injector: this.injector }
          )
        );
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

  setTab(tab: 'diary' | 'recipes'): void {
    this.tab.set(tab);
    this.logTo.set(null);
    if (tab === 'diary') {
      this.view.set('diary');
    }
  }

  /** A meal's Add menu: Quick add opens the builder with its quick form, the others go to Recipes for that meal. */
  startFrom(request: AddRequest): void {
    if (request.source === 'quick') {
      this.pendingQuickAdd = true;
      this.startLog(request.slot);
      return;
    }
    this.logTo.set(LINKABLE_MEAL_TYPES.includes(request.slot) ? request.slot : null);
    this.recipeSection.set(request.source === 'saved' ? 'saved' : 'library');
    this.tab.set('recipes');
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
