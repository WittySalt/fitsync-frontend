import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { CookAddNowComponent } from './cook-add-now.component';
import { CookAlertComponent } from './cook-alert.component';
import { CookAlsoTimingComponent, TimingChip } from './cook-also-timing.component';
import { CookBannerComponent } from './cook-banner.component';
import { clockText } from './cook-format';
import { CookIngredientsComponent } from './cook-ingredients.component';
import {
  hasAssignments,
  ingredientsOf,
  parseServings,
  scaleFactor,
  splitAtPhrase,
  turnSubject,
  usedCount,
  usedIds
} from './cook-recipe';
import { CookRecipeService } from './cook-recipe.service';
import { CookSessionService } from './cook-session.service';
import { CookStepsComponent } from './cook-steps.component';
import { CookTimerComponent } from './cook-timer.component';
import { CookWakeLock } from './cook-wake-lock';
import { addMinute, adjustStage, pauseTimer, remainingSeconds, resumeTimer, segmentFills, stageName, startStage } from './cook-timer';
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
  private recipeId = '';
  private resolveLeave: ((value: boolean) => void) | null = null;

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
  protected readonly used = computed(() => usedIds(this.steps(), this.index()));
  protected readonly usedTotal = computed(() => {
    const recipe = this.recipe();
    return recipe ? usedCount(recipe, this.index()) : 0;
  });
  protected readonly sheetLabel = computed(() => {
    const total = this.recipe()?.ingredients.length ?? 0;
    return this.assigned() ? `${this.usedTotal()} of ${total} ingredients used` : `${total} ingredients`;
  });
  protected readonly text = computed(() => {
    const step = this.step();
    return step ? splitAtPhrase(step.text, step.timer?.phrase ?? '') : { before: '', match: '', after: '' };
  });
  protected readonly timer = computed(() => this.session.data()?.timers[this.index()] ?? null);
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
          step: live.step,
          label: stageName(live.state) ?? `Step ${live.step + 1}`,
          time: clockText(remainingSeconds(live.state, now)),
          share: 1 - (fills[live.state.stage] ?? fills[0])
        };
      });
  });
  protected readonly runningCount = computed(() => this.session.liveTimers().length);
  protected readonly leaveMessage = computed(() => {
    const count = this.runningCount();
    return count === 1 ? 'A timer is still running.' : 'Your timers are still running.';
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
          { recipeId: this.recipeId, name: recipe.name, servings: this.servings() },
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
      this.close();
    } else {
      this.session.goTo(this.index() + 1);
    }
  }

  /** Leaves cook mode; the guard asks about running timers. */
  protected close(): void {
    void this.router.navigateByUrl('/nutrition');
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

  protected addMinute(): void {
    this.act((state) => addMinute(state));
  }

  /** The action of the green bar: the second side starts where it is, anything else opens the step. */
  protected answerAlert(): void {
    const alert = this.alert();
    if (!alert) {
      return;
    }
    if (alert.kind === 'turn') {
      this.session.act(alert.step, startStage);
    } else {
      this.session.goTo(alert.step);
    }
  }

  /** Called by the route guard. With timers running it asks first; with none it simply lets go. */
  confirmLeave(): boolean | Promise<boolean> {
    if (!this.session.hasLive()) {
      this.session.leave(false);
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
