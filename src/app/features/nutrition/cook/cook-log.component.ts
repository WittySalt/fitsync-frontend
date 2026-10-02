import { Component, OnDestroy, computed, effect, input, model, output, signal, untracked } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { DiarySummary, Load } from '../diary/diary.models';
import { MAX_SERVINGS, MIN_SERVINGS, stepServings } from '../recipes/recipes-figures';
import { StepperComponent } from '../recipes/stepper.component';
import { kcalText, pastTarget, ringShare } from './cook-finish-figures';

export const RING_MS = 800;
const SIZE = 64;
const RADIUS = SIZE / 2 - 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Log what you ate" on the finish card: a ring of today's calories against the target, the servings
 * eaten and the meal by the clock. Once the meal is logged the ring runs to its new share and the
 * number counts up, a "+kcal" line appears, and a tinted row says where it went with Undo. Past the
 * target the ring and the line turn amber. Nothing here is ever red.
 */
@Component({
  selector: 'app-cook-log',
  imports: [FoodGlyphComponent, StepperComponent],
  template: `
    <h3 class="eyebrow">Log what you ate</h3>
    @let s = summary();
    @if (s.status === 'loading') {
      <div class="today skeleton" aria-busy="true"></div>
    } @else if (s.status === 'error') {
      <p class="note" role="status">Today could not load. Logging still works.</p>
    } @else {
      <div class="today" [class.over]="over()">
        @if (hasTarget()) {
          <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" aria-hidden="true">
            <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" class="track" />
            <circle
              [attr.cx]="size / 2"
              [attr.cy]="size / 2"
              [attr.r]="radius"
              class="arc"
              [attr.stroke-dasharray]="dash()"
              [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
            />
            <text [attr.x]="size / 2" [attr.y]="size / 2" class="percent">{{ percent() }}%</text>
          </svg>
        }
        <div class="figures">
          <span class="label">Today</span>
          <strong class="eaten" aria-live="polite">{{ eatenText() }}@if (target(); as t) {<span class="of"> of {{ kcal(t) }} kcal</span>} @else {<span class="of"> kcal</span>}</strong>
          @if (added() !== null) {
            <span class="plus">+{{ kcal(added() ?? 0) }} kcal</span>
          }
        </div>
      </div>
    }
    @if (added() === null) {
      <div class="row">
        <span class="label strong">Servings eaten</span>
        <app-stepper downLabel="Fewer servings eaten" upLabel="More servings eaten" [canDown]="servings() > min" [canUp]="servings() < max" (down)="step(-1)" (up)="step(1)">
          <span aria-live="polite">{{ servings() }} of {{ recipeServings() }}</span>
        </app-stepper>
      </div>
      <div class="row meal">
        <span>{{ mealLabel() }} · {{ clock() }}</span>
        <button type="button" class="link" [attr.aria-expanded]="changing()" (click)="changing.set(!changing())">Change</button>
      </div>
      @if (changing()) {
        <div class="slots" role="group" aria-label="Meal">
          @for (slot of slots; track slot.key) {
            <button type="button" [class.on]="slot.key === mealType()" [attr.aria-pressed]="slot.key === mealType()" (click)="pick(slot.key)">{{ slot.label }}</button>
          }
        </div>
      }
    } @else {
      @if (past() > 0) {
        <p class="past">{{ kcal(past()) }} kcal past today's target</p>
      }
      <div class="logged" role="status">
        <app-food-glyph name="CHECK" [size]="16" [strokeWidth]="2.8" />
        <strong>Logged to {{ mealLabel().toLowerCase() }}</strong>
        <button type="button" class="undo" [disabled]="busy()" (click)="undo.emit()">
          <app-food-glyph name="UNDO" [size]="14" [strokeWidth]="2.2" />Undo
        </button>
      </div>
    }
    @if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }
  `,
  styleUrl: './cook-log.component.scss'
})
export class CookLogComponent implements OnDestroy {
  /** Today's totals and targets before this meal. */
  readonly summary = input.required<Load<DiarySummary>>();
  /** The calories of this meal once it is logged, or null before. */
  readonly added = input<number | null>(null);
  readonly recipeServings = input(1);
  readonly servings = model(1);
  readonly mealType = model('DINNER');
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly reducedMotion = input(false);
  readonly undo = output<void>();

  protected readonly size = SIZE;
  protected readonly radius = RADIUS;
  protected readonly min = MIN_SERVINGS;
  protected readonly max = MAX_SERVINGS;
  protected readonly slots = MEAL_SLOTS;
  protected readonly kcal = kcalText;
  protected readonly changing = signal(false);
  protected readonly clock = signal(clockOf(new Date()));
  /** The calories shown on the ring and in the number; it runs to a new value when a meal is logged or undone. */
  protected readonly shown = signal(0);

  protected readonly base = computed(() => {
    const state = this.summary();
    return state.status === 'ready' ? state.data.totalCalories : 0;
  });
  protected readonly target = computed(() => {
    const state = this.summary();
    return state.status === 'ready' && state.data.targetCalories !== null && state.data.targetCalories > 0 ? state.data.targetCalories : null;
  });
  protected readonly hasTarget = computed(() => this.target() !== null);
  protected readonly final = computed(() => this.base() + (this.added() ?? 0));
  protected readonly over = computed(() => pastTarget(this.shown(), this.target()) > 0);
  protected readonly past = computed(() => pastTarget(this.final(), this.target()));
  protected readonly percent = computed(() => Math.round(ringShare(this.shown(), this.target()) * 100));
  protected readonly dash = computed(() => `${(CIRCUMFERENCE * ringShare(this.shown(), this.target())).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`);
  protected readonly eatenText = computed(() => kcalText(this.shown()));
  protected readonly mealLabel = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.mealType())?.label ?? 'Snack');

  private frame: number | null = null;
  private lastAdded: number | null = null;

  constructor() {
    effect(() => {
      const target = this.final();
      const added = this.added();
      untracked(() => {
        // The day as it stood is drawn straight away; only logging or undoing a meal runs the ring.
        if (added !== this.lastAdded) {
          this.lastAdded = added;
          this.run(target);
        } else {
          this.stop();
          this.shown.set(target);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected step(direction: 1 | -1): void {
    this.servings.set(stepServings(this.servings(), direction));
  }

  protected pick(slot: string): void {
    this.mealType.set(slot);
    this.changing.set(false);
  }

  private run(target: number): void {
    this.stop();
    const from = this.shown();
    if (this.reducedMotion() || from === target || typeof requestAnimationFrame === 'undefined') {
      this.shown.set(target);
      return;
    }
    const began = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / RING_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.shown.set(from + (target - from) * eased);
      this.frame = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }
}

function clockOf(moment: Date): string {
  return `${String(moment.getHours()).padStart(2, '0')}:${String(moment.getMinutes()).padStart(2, '0')}`;
}
