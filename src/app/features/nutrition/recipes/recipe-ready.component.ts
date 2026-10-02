import { Component, ElementRef, HostListener, Injector, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { LOADING, Load } from '../diary/diary.models';
import { MAX_SERVINGS, MIN_SERVINGS, clampServings, cookFigures, gramsText, ingredientGrams, stepServings, timersTotalText, topGroupsOf } from './recipes-figures';
import { RecipeCoverComponent } from './recipe-cover.component';
import { RecipeDetail } from './recipes.models';
import { RecipesService } from './recipes.service';
import { StepperComponent } from './stepper.component';

/**
 * "Ready to cook": the screen between a Cook button and cook mode. The servings to cook, how long
 * the recipe's own timers add up to, and a list to tick for what is already on the counter. The
 * ticks only help the cook and are not kept; starting never waits for them. A dialog on a computer,
 * a sheet from the bottom on a phone.
 */
@Component({
  selector: 'app-recipe-ready',
  imports: [FoodIconComponent, RecipeCoverComponent, StatePanelComponent, StepperComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <div #panel class="panel" role="dialog" aria-modal="true" aria-labelledby="ready-title" tabindex="-1">
      @let s = recipe();
      @if (s.status === 'loading') {
        <h2 id="ready-title" class="sr-only">Ready to cook</h2>
        <div class="skeleton" aria-busy="true"></div>
      } @else if (s.status === 'error') {
        <h2 id="ready-title" class="sr-only">Ready to cook</h2>
        <app-state-panel title="Recipe unavailable" message="The recipe could not load. Please retry." actionLabel="Retry" [error]="true" (action)="load()" />
        <button class="quiet" type="button" (click)="closed.emit()">Close</button>
      } @else {
        @let r = s.data;
        <div class="title">
          <app-recipe-cover [imageUrl]="r.imageUrl" [groups]="groups()" [width]="64" [height]="64" [radius]="14" [glyph]="18" />
          <div class="titles">
            <span class="eyebrow">Ready to cook</span>
            <h2 id="ready-title">{{ r.name }}</h2>
          </div>
        </div>
        <div class="row">
          <span class="label">Servings</span>
          <app-stepper downLabel="Fewer servings" upLabel="More servings" [canDown]="servings() > min" [canUp]="servings() < max" (down)="step(-1)" (up)="step(1)">
            <span aria-live="polite">{{ servings() }} of {{ r.servings }}</span>
          </app-stepper>
        </div>
        <dl class="figures">
          <div><dd>{{ figures().steps }}</dd><dt>steps</dt></div>
          <div><dd>{{ total() }}</dd><dt>of timers</dt></div>
          <div><dd>{{ figures().timers }}</dd><dt>{{ figures().timers === 1 ? 'timer' : 'timers' }}</dt></div>
        </dl>
        @if (r.ingredients.length > 0) {
          <div class="head">
            <h3>Have you got everything?</h3>
            <span class="count" aria-live="polite">{{ ticked().size }} of {{ r.ingredients.length }} ticked</span>
            <button type="button" class="all" (click)="tickAll(r)">{{ ticked().size === r.ingredients.length ? 'Clear all' : 'Tick all' }}</button>
          </div>
          <ul>
            @for (ingredient of r.ingredients; track ingredient.ingredientId) {
              @let on = ticked().has(ingredient.ingredientId);
              <li [class.on]="on">
                <label>
                  <input type="checkbox" class="sr-only" [checked]="on" (change)="tick(ingredient.ingredientId)" />
                  <span class="box" aria-hidden="true">
                    @if (on) {
                      <svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    }
                  </span>
                  <app-food-icon [group]="ingredient.foodGroup" [categoryCode]="ingredient.categoryCode" [size]="30" />
                  <span class="name">{{ ingredient.name }}</span>
                  <span class="grams">{{ amount(r, ingredient.ingredientId) }}</span>
                </label>
              </li>
            }
          </ul>
        }
        <button class="start" type="button" (click)="start(r)">Start cooking</button>
        <p class="note">You can start without ticking everything.</p>
      }
    </div>
  `,
  styleUrl: './recipe-ready.component.scss'
})
export class RecipeReadyComponent implements OnInit {
  private readonly service = inject(RecipesService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly recipeId = input.required<string>();
  /** The servings the stepper starts at. */
  readonly initialServings = input(1);
  readonly closed = output<void>();

  protected readonly min = MIN_SERVINGS;
  protected readonly max = MAX_SERVINGS;
  protected readonly recipe = signal<Load<RecipeDetail>>(LOADING);
  protected readonly servings = signal(1);
  protected readonly ticked = signal<ReadonlySet<string>>(new Set());
  protected readonly figures = computed(() => {
    const state = this.recipe();
    return cookFigures(state.status === 'ready' ? state.data : { steps: [] });
  });
  protected readonly total = computed(() => timersTotalText(this.figures().timerSeconds));
  protected readonly groups = computed(() => {
    const state = this.recipe();
    return state.status === 'ready' ? topGroupsOf(state.data) : [];
  });

  ngOnInit(): void {
    this.servings.set(clampServings(this.initialServings()));
    this.load();
    // Focus moves into the dialog so the keyboard works there at once.
    afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: this.injector });
  }

  protected load(): void {
    this.recipe.set(LOADING);
    this.service.get(this.recipeId()).subscribe({
      next: (data) => {
        this.recipe.set({ status: 'ready', data });
      },
      error: () => this.recipe.set({ status: 'error', message: 'The recipe could not load. Please retry.' })
    });
  }

  protected step(direction: 1 | -1): void {
    this.servings.set(stepServings(this.servings(), direction));
  }

  protected tick(id: string): void {
    this.ticked.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected tickAll(recipe: RecipeDetail): void {
    const all = recipe.ingredients.length;
    this.ticked.set(this.ticked().size === all ? new Set() : new Set(recipe.ingredients.map((ingredient) => ingredient.ingredientId)));
  }

  protected amount(recipe: RecipeDetail, id: string): string {
    const ingredient = recipe.ingredients.find((entry) => entry.ingredientId === id);
    return ingredient ? gramsText(ingredientGrams(ingredient, recipe.servings, this.servings(), false)) : '';
  }

  protected start(recipe: RecipeDetail): void {
    void this.router.navigate(['/nutrition/recipes', recipe.id, 'cook'], { queryParams: { servings: this.servings() } });
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.closed.emit();
  }
}
