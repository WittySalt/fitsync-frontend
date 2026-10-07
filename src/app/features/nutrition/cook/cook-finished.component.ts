import { Component, ElementRef, HostListener, Injector, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodGroup } from '../../../shared/food/food-groups';
import { DiarySummary, LOADING, Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { mealTypeByClock } from '../diary/diary-time';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { RecipeCoverComponent } from '../recipes/recipe-cover.component';
import { clampServings, scaled, servingsLabel } from '../recipes/recipes-figures';
import { RecipesService } from '../recipes/recipes.service';
import { CookLogComponent } from './cook-log.component';

/**
 * The end of cooking. It follows the Workout celebration: the card rises over the blurred screen, the
 * green tick pops, three figures say what the cooking was. Below is the moment that closes the loop,
 * logging what was eaten, with one filled green button at a time: Log first, then Done once it is
 * logged. "Not now" leaves without logging.
 */
@Component({
  selector: 'app-cook-finished',
  imports: [CookLogComponent, FoodGlyphComponent, RecipeCoverComponent],
  template: `
    <div #shell class="shell" [class.reduced]="reduced()" role="dialog" aria-modal="true" aria-labelledby="cook-finished-title" tabindex="-1">
      <article class="card">
        <header class="hero">
          <div class="photo">
            <app-recipe-cover [imageUrl]="imageUrl()" [groups]="groups()" [height]="132" />
            <span class="fade" aria-hidden="true"></span>
          </div>
          <span class="tick" aria-hidden="true"><app-food-glyph name="CHECK" [size]="32" [strokeWidth]="3" /></span>
          <div class="titles">
            <h2 id="cook-finished-title">Cooked</h2>
            <span class="name">{{ name() }}</span>
            @if (leftLine(); as line) {
              <span class="name" data-test="left-line">{{ line }}</span>
            }
          </div>
          <div class="facts" role="group" aria-label="Cooking summary">
            <div><strong>{{ minutes() }}</strong>&ngsp;<span>min</span></div>
            <div><strong>{{ steps() }}</strong>&ngsp;<span>{{ steps() === 1 ? 'step' : 'steps' }}</span></div>
            <div><strong>{{ servingsCooked() }}</strong>&ngsp;<span>{{ servingsCooked() === 1 ? 'serving' : 'servings' }}</span></div>
          </div>
        </header>

        @if (firstCook()) {
          <section class="earned" aria-label="Earned today">
            <span class="eyebrow">Earned today</span>
            <div class="item">
              <span class="mark" aria-hidden="true"><app-food-glyph name="STAR" [size]="18" [strokeWidth]="2.2" /></span>
              <span class="text">
                <strong>First time cooking this</strong>
                <span>It now shows under Cooked recently</span>
              </span>
            </div>
          </section>
        }

        <app-cook-log
          [summary]="today()"
          [added]="added()"
          [servingsCooked]="servingsCooked()"
          [(servings)]="eaten"
          [(mealType)]="mealType"
          [busy]="busy()"
          [error]="error()"
          [reducedMotion]="reduced()"
          (undo)="undo()"
        />

        @if (logged()) {
          <button type="button" class="primary" (click)="done.emit()">Done</button>
        } @else {
          <button type="button" class="primary" [disabled]="busy()" (click)="log()">{{ busy() ? 'Logging' : logLabel() }}</button>
          <button type="button" class="quiet" [disabled]="busy()" (click)="done.emit()">Not now</button>
        }
      </article>
    </div>
  `,
  styleUrl: './cook-finished.component.scss'
})
export class CookFinishedComponent implements OnInit {
  private readonly recipes = inject(RecipesService);
  private readonly diary = inject(NutritionDiaryService);
  private readonly injector = inject(Injector);
  private readonly userTimezone = inject(UserTimezoneService);
  private readonly shell = viewChild<ElementRef<HTMLElement>>('shell');

  readonly recipeId = input.required<string>();
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly groups = input<readonly FoodGroup[]>([]);
  /** Minutes actually cooked, from the cook session. */
  readonly minutes = input(1);
  readonly steps = input(0);
  /** The servings the cook made; the servings eaten start here. */
  readonly servingsCooked = input(1);
  readonly kcalPerServing = input<number | null>(null);
  /** True when the recipe had never been cooked before this cook (its cook count was 0). */
  readonly firstCook = input(false);
  /** Overrides the browser's reduced-motion setting, for tests. */
  readonly reducedMotion = input<boolean | null>(null);
  /** Leave for the recipe page: after Done, or Not now. */
  readonly done = output<void>();

  protected readonly today = signal<Load<DiarySummary>>(LOADING);
  protected readonly eaten = signal(1);
  protected readonly mealType = signal<string>(mealTypeByClock(new Date()));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly logged = signal(false);
  private mealId: string | null = null;

  protected readonly added = computed(() => {
    const per = this.kcalPerServing();
    return this.logged() && per !== null ? scaled(per, this.eaten()) : null;
  });
  /** "Cooked 4 servings · 3 left", once a serving has been logged and some are left to eat later. */
  protected readonly leftLine = computed(() => {
    const left = this.servingsCooked() - this.eaten();
    return this.logged() && left > 0 ? `Cooked ${servingsLabel(this.servingsCooked())} · ${left} left` : '';
  });
  protected readonly logLabel = computed(() => {
    const per = this.kcalPerServing();
    const text = `Log ${servingsLabel(this.eaten())}`;
    return per === null ? text : `${text} · ${whole(scaled(per, this.eaten()))} kcal`;
  });
  protected readonly reduced = computed(() => this.reducedMotion() ?? prefersReducedMotion());

  ngOnInit(): void {
    this.eaten.set(clampServings(this.servingsCooked()));
    this.loadToday();
    if (!this.reduced() && typeof navigator !== 'undefined') {
      navigator.vibrate?.(35);
    }
    afterNextRender(() => this.shell()?.nativeElement.focus(), { injector: this.injector });
  }

  protected log(): void {
    if (this.busy() || this.logged()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.recipes.logRecipe(this.recipeId(), { servings: this.eaten(), mealType: this.mealType(), consumedAt: new Date() }).subscribe({
      next: ({ mealId }) => {
        this.busy.set(false);
        // A reply without an id still counts as logged; only the undo has nothing to remove then.
        this.mealId = mealId || null;
        this.logged.set(true);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('That meal was not logged. Please try again.');
      }
    });
  }

  protected undo(): void {
    if (!this.logged() || this.busy()) {
      return;
    }
    const id = this.mealId;
    const finish = () => {
      this.busy.set(false);
      this.mealId = null;
      this.logged.set(false);
    };
    this.busy.set(true);
    this.error.set(null);
    if (!id) {
      finish();
      return;
    }
    this.diary.deleteMeal(id).subscribe({
      next: finish,
      error: () => {
        this.busy.set(false);
        this.error.set('That could not be undone. Please try again.');
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected leave(): void {
    if (!this.busy()) {
      this.done.emit();
    }
  }

  private loadToday(): void {
    this.today.set(LOADING);
    this.diary.getSummary(this.userTimezone.dateKey()).subscribe({
      next: (data) => this.today.set({ status: 'ready', data }),
      error: () => this.today.set({ status: 'error', message: 'Today could not load.' })
    });
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
