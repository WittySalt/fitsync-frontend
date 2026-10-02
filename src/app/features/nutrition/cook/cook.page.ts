import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { CookAddNowComponent } from './cook-add-now.component';
import { CookAlertComponent } from './cook-alert.component';
import { CookAlsoTimingComponent, TimingChip } from './cook-also-timing.component';
import { CookBannerComponent } from './cook-banner.component';
import { CookCustomTimersComponent, CustomTimerView, NewTimer } from './cook-custom-timers.component';
import { clockText } from './cook-format';
import { CookFinishedComponent } from './cook-finished.component';
import { minutesCooked } from './cook-finish-figures';
import { CookIngredientsComponent } from './cook-ingredients.component';
import { addedCount, hasAssignments, ingredientsOf, parseServings, scaleFactor, splitAtPhrase, splitIngredients, topGroups, turnSubject } from './cook-recipe';
import { CookRecipeService } from './cook-recipe.service';
import { CookSessionService } from './cook-session.service';
import { CookStepsComponent } from './cook-steps.component';
import { CookTimerComponent } from './cook-timer.component';
import { CookWakeLock } from './cook-wake-lock';
import { addMinute, adjustStage, pauseTimer, remainingSeconds, resumeTimer, segmentFills, setRemaining, stageName, startStage } from './cook-timer';
import { CookRecipe } from './cook.models';

type Status = 'loading' | 'error' | 'ready';

/**
 * Cook mode: a dark full-screen walk through a recipe, one step at a time, with what to add now,
 * a timer per step and the screen kept awake. On a computer the steps are on the left and the
 * ingredients on the right; on a phone they sit in a sheet under the step.
 */
@Component({
  selector: 'app-cook-page',
  imports: [
    CookAddNowComponent,
    CookAlertComponent,
    CookAlsoTimingComponent,
    CookBannerComponent,
    CookCustomTimersComponent,
    CookFinishedComponent,
    CookIngredientsComponent,
    CookStepsComponent,
    CookTimerComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './cook.page.html',
  styleUrl: './cook.page.scss'
})
export class CookPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipes = inject(CookRecipeService);
  protected readonly session = inject(CookSessionService);
  protected readonly wake = new CookWakeLock();

  protected readonly status = signal<Status>('loading');
  protected readonly recipe = signal<CookRecipe | null>(null);
  protected readonly servings = signal(1);
  protected readonly sheetOpen = signal(false);
  protected readonly leaving = signal(false);
  /** True from Finish cooking on: the finish card is on screen. */
  protected readonly finishing = signal(false);
  protected readonly minutes = signal(1);
  /** The All ingredients section under the step starts closed. */
  protected readonly listOpen = signal(false);
  private recipeId = '';
  private resolveLeave: ((value: boolean) => void) | null = null;
  /** Set by Finish cooking, so leaving afterwards ends the session instead of keeping it. */
  private finished = false;

  protected readonly steps = computed(() => this.recipe()?.steps ?? []);
  protected readonly index = computed(() => Math.min(this.session.step(), Math.max(0, this.steps().length - 1)));
  protected readonly step = computed(() => this.steps()[this.index()] ?? null);
  protected readonly isLast = computed(() => this.index() >= this.steps().length - 1);
  protected readonly factor = computed(() => scaleFactor(this.servings(), this.recipe()?.servings ?? 1));
  protected readonly assigned = computed(() => {
    const recipe = this.recipe();
    return !!recipe && hasAssignments(recipe);
  });
  protected readonly nowIngredients = computed(() => {
    const recipe = this.recipe();
    const step = this.step();
    return recipe && step ? ingredientsOf(step, recipe.ingredients) : [];
  });
  /** The ingredients ticked as added, from the session so the ticks survive a reload. */
  protected readonly added = computed<ReadonlySet<string>>(() => new Set(this.session.data()?.added ?? []));
  protected readonly lists = computed(() => {
    const recipe = this.recipe();
    return recipe ? splitIngredients(recipe) : { inSteps: [], loose: [] };
  });
  protected readonly addedTotal = computed(() => {
    const recipe = this.recipe();
    return recipe ? addedCount(recipe, this.session.data()?.added ?? []) : 0;
  });
  protected readonly addedLabel = computed(() => `${this.addedTotal()} of ${this.recipe()?.ingredients.length ?? 0} added`);
  protected readonly sheetLabel = computed(() => `${this.addedTotal()} of ${this.recipe()?.ingredients.length ?? 0} ingredients added`);
  protected readonly text = computed(() => {
    const step = this.step();
    return step ? splitAtPhrase(step.text, step.timer?.phrase ?? '') : { before: '', match: '', after: '' };
  });
  protected readonly timer = computed(() => this.session.data()?.timers[this.index()] ?? null);
  /** The timers the cook added to this step. */
  protected readonly customs = computed<CustomTimerView[]>(() => {
    const now = this.session.now();
    return (this.session.data()?.customs ?? [])
      .filter((custom) => custom.step === this.index())
      .map((custom) => ({
        id: custom.id,
        name: custom.name,
        clock: clockText(remainingSeconds(custom.state, now)),
        minutesLeft: Math.max(1, Math.ceil(remainingSeconds(custom.state, now) / 60)),
        phase: custom.state.phase
      }));
  });
  protected readonly subject = computed(() => {
    const recipe = this.recipe();
    const step = this.step();
    return recipe && step ? turnSubject(step, recipe.ingredients) : null;
  });
  protected readonly alert = computed(() => this.session.alerts()[0] ?? null);
  protected readonly chips = computed<TimingChip[]>(() => {
    const now = this.session.now();
    return this.session
      .liveTimers()
      .filter((live) => live.step !== this.index() && live.state.phase !== 'turn')
      .map((live) => {
        const fills = segmentFills(live.state, now);
        return {
          key: live.key,
          step: live.step,
          label: live.name !== null ? live.name || `Step ${live.step + 1} timer` : (stageName(live.state) ?? `Step ${live.step + 1}`),
          time: clockText(remainingSeconds(live.state, now)),
          share: 1 - (fills[live.state.stage] ?? fills[0])
        };
      });
  });
  protected readonly runningCount = computed(() => this.session.liveTimers().length);
  protected readonly leaveMessage = computed(() => {
    const count = this.runningCount();
    return count === 1 ? 'The timer keeps running in a bar at the bottom of the screen.' : 'Timers keep running in a bar at the bottom of the screen.';
  });
  protected readonly leaveTitle = computed(() => {
    const count = this.runningCount();
    return `${count} ${count === 1 ? 'timer is' : 'timers are'} still running`;
  });

  ngOnInit(): void {
    this.recipeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.servings.set(parseServings(this.route.snapshot.queryParamMap.get('servings')));
    this.load();
  }

  ngOnDestroy(): void {
    this.wake.release();
    if (this.session.viewing()) {
      this.session.leave(true);
    }
  }

  protected load(): void {
    this.status.set('loading');
    this.recipes.getRecipe(this.recipeId).subscribe({
      next: (recipe) => {
        if (recipe.steps.length === 0) {
          this.status.set('error');
          return;
        }
        this.recipe.set(recipe);
        this.session.open(
          { recipeId: this.recipeId, name: recipe.name, servings: this.servings(), imageUrl: recipe.imageUrl },
          recipe.steps.map((step) => step.timer)
        );
        this.wake.hold();
        this.status.set('ready');
      },
      error: () => this.status.set('error')
    });
  }

  protected jump(index: number): void {
    this.session.goTo(index);
    this.sheetOpen.set(false);
  }

  protected back(): void {
    if (this.index() > 0) {
      this.session.goTo(this.index() - 1);
    }
  }

  protected next(): void {
    if (this.isLast()) {
      this.finish();
    } else {
      this.session.goTo(this.index() + 1);
    }
  }

  /**
   * Leaves cook mode for the recipe it came from; the guard asks about running timers. The cook
   * page takes the place of the recipe in the history, so the browser's Back button goes on to
   * where the cook was before, and it asks the same question.
   */
  protected close(): void {
    void this.router.navigateByUrl(this.recipeId ? `/nutrition/recipes/${this.recipeId}` : '/nutrition', { replaceUrl: true });
  }

  /** Finish cooking: the card that thanks the cook and offers to log the meal. */
  protected finish(): void {
    this.finished = true;
    const started = this.session.data()?.startedAt ?? Date.now();
    this.minutes.set(minutesCooked(started, Date.now()));
    this.finishing.set(true);
  }

  protected readonly groups = computed(() => {
    const recipe = this.recipe();
    return recipe ? topGroups(recipe) : [];
  });

  protected markAll(on: boolean): void {
    this.session.setAdded(
      this.nowIngredients().map((ingredient) => ingredient.id),
      on
    );
  }

  protected toggleAdded(id: string): void {
    this.session.toggleAdded(id);
  }

  protected addTimer(timer: NewTimer): void {
    this.session.addCustom(this.index(), timer.name, timer.minutes);
  }

  protected pauseCustom(id: number): void {
    this.session.actCustom(id, pauseTimer);
  }

  protected resumeCustom(id: number): void {
    this.session.actCustom(id, resumeTimer);
  }

  protected minuteCustom(id: number): void {
    this.session.actCustom(id, (state) => addMinute(state));
  }

  protected retimeCustom(id: number, seconds: number): void {
    this.session.actCustom(id, (state, now) => setRemaining(state, now, seconds));
  }

  protected removeCustom(id: number): void {
    this.session.removeCustom(id);
  }

  protected act(change: Parameters<CookSessionService['act']>[1]): void {
    this.session.act(this.index(), change);
  }

  protected adjust(direction: 1 | -1): void {
    this.act((state) => adjustStage(state, direction));
  }

  protected start(): void {
    this.act(startStage);
  }

  protected pause(): void {
    this.act(pauseTimer);
  }

  protected resume(): void {
    this.act(resumeTimer);
  }

  protected retime(seconds: number): void {
    this.act((state, now) => setRemaining(state, now, seconds));
  }

  protected addMinute(): void {
    this.act((state) => addMinute(state));
  }

  /** The action of the green bar: the second side starts where it is, anything else opens the step. */
  protected answerAlert(): void {
    const alert = this.alert();
    if (!alert) {
      return;
    }
    if (alert.kind === 'turn' && alert.name === null) {
      this.session.act(alert.step, startStage);
    } else {
      this.session.goTo(alert.step);
    }
  }

  /** Called by the route guard. With timers running it asks first; with none it simply lets go. */
  confirmLeave(): boolean | Promise<boolean> {
    if (!this.session.hasLive()) {
      // Without timers the session stays for the Continue cooking banner, unless the cook finished.
      this.session.leave(!this.finished);
      return true;
    }
    this.leaving.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolveLeave = resolve;
    });
  }

  protected answerLeave(keepTimers: boolean): void {
    this.leaving.set(false);
    this.session.leave(keepTimers);
    this.resolveLeave?.(true);
    this.resolveLeave = null;
  }
}
